import { describe, expect, it } from 'vitest';
import {
  PARAMETROS_CAMINATA as P,
  avanzarFaseCaminata,
  cadencia,
  calcularCaminata,
  crearSalidaCaminata,
  factorCarrera,
  largoZancada,
} from './caminata';

const LARGO = P.muslo + P.pantorrilla;

/** Cinemática directa: pie respecto del suelo bajo la pelvis (adelante, altura) de la pierna i. */
function pieMundo(fase: number, v: number, i: 0 | 1) {
  const s = calcularCaminata(fase, v, crearSalidaCaminata());
  const a = -s.cadera[i];
  const b = a - s.rodilla[i];
  const adelante = P.muslo * Math.sin(a) + P.pantorrilla * Math.sin(b);
  const abajo = P.muslo * Math.cos(a) + P.pantorrilla * Math.cos(b);
  const cadera = (i === 0 ? 1 : -1) * P.separacionCadera * Math.sin(s.pelvisGiro);
  const sube = (i === 0 ? -1 : 1) * P.separacionCadera * Math.sin(s.pelvisLadeo);
  return { x: cadera + adelante, y: LARGO + s.pelvisY + sube - abajo, salida: s };
}

describe('caminata por poses', () => {
  it('a velocidad 0 da la pose de pie', () => {
    const s = calcularCaminata(0.3, 0, crearSalidaCaminata());
    expect(s.pelvisY).toBeCloseTo(0, 6);
    expect(s.cadera[0]).toBeCloseTo(0, 6);
    expect(s.rodilla[1]).toBeCloseTo(0, 6);
    expect(s.hombro[0]).toBeCloseTo(0, 6);
    expect(s.pelvisGiro).toBeCloseTo(0, 6);
  });

  it.each([0.6, P.velCaminar, 3.6, P.velCorrer, 6])(
    'el pie apoyado no patina ni se hunde a %s m/s',
    (v) => {
      const dt = 1 / 240;
      const c = cadencia(v);
      for (const i of [0, 1] as const) {
        let previo: { x: number; y: number } | null = null;
        for (let k = 0; k < 240; k++) {
          const fase = (k * dt * c) % 1;
          const p = pieMundo(fase, v, i);
          // el cuerpo avanza v·t: el pie apoyado debe quedar quieto en el mundo
          const mundo = { x: p.x + v * k * dt, y: p.y };
          if (p.salida.apoyado[i]) {
            expect(Math.abs(mundo.y)).toBeLessThan(0.006);
            if (previo) expect(Math.abs(mundo.x - previo.x)).toBeLessThan(0.004);
            previo = mundo;
          } else {
            previo = null;
            expect(mundo.y).toBeGreaterThan(-0.006);
          }
        }
      }
    },
  );

  it('la rodilla nunca se dobla al revés', () => {
    const s = crearSalidaCaminata();
    for (let v = 0; v <= 7; v += 0.25)
      for (let f = 0; f < 1; f += 0.01) {
        calcularCaminata(f, v, s);
        expect(s.rodilla[0]).toBeGreaterThanOrEqual(0);
        expect(s.rodilla[1]).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(s.cadera[0] + s.pelvisY + s.hombro[1])).toBe(true);
      }
  });

  it('caminando el pie se levanta al menos 8 cm', () => {
    let max = 0;
    for (let f = 0; f < 1; f += 0.005) max = Math.max(max, pieMundo(f, P.velCaminar, 0).y);
    expect(max).toBeGreaterThan(0.08);
  });

  it('corriendo hay vuelo (los dos pies en el aire) y caminando no', () => {
    const s = crearSalidaCaminata();
    const vuela = (v: number) => {
      for (let f = 0; f < 1; f += 0.005) {
        calcularCaminata(f, v, s);
        if (!s.apoyado[0] && !s.apoyado[1]) return true;
      }
      return false;
    };
    expect(vuela(P.velCorrer)).toBe(true);
    expect(vuela(P.velCaminar * 0.8)).toBe(false);
  });

  it('la pelvis rebota: más baja tras el contacto que en la subida (caminando)', () => {
    const v = P.velCaminar * 0.9;
    const bajada = calcularCaminata(0.125, v, crearSalidaCaminata()).pelvisY;
    const subida = calcularCaminata(0.375, v, crearSalidaCaminata()).pelvisY;
    expect(subida - bajada).toBeGreaterThan(0.01);
  });

  it('la pose es continua al pasar de caminar a correr (sin saltos)', () => {
    const a = crearSalidaCaminata();
    const b = crearSalidaCaminata();
    for (const f of [0, 0.13, 0.31, 0.5, 0.77]) {
      for (let v = 0.5; v < 6.5; v += 0.01) {
        calcularCaminata(f, v, a);
        calcularCaminata(f, v + 0.01, b);
        for (const i of [0, 1] as const) {
          expect(Math.abs(a.cadera[i] - b.cadera[i])).toBeLessThan(0.03);
          expect(Math.abs(a.rodilla[i] - b.rodilla[i])).toBeLessThan(0.05);
          expect(Math.abs(a.hombro[i] - b.hombro[i])).toBeLessThan(0.02);
          expect(Math.abs(a.codo[i] - b.codo[i])).toBeLessThan(0.02);
        }
        expect(Math.abs(a.pelvisY - b.pelvisY)).toBeLessThan(0.005);
      }
    }
  });

  it('brazo opuesto a la pierna del mismo lado', () => {
    const s = calcularCaminata(0, P.velCaminar, crearSalidaCaminata());
    expect(s.cadera[0]).toBeLessThan(0); // pierna 0 adelante en su contacto
    expect(s.hombro[0]).toBeGreaterThan(0); // brazo 0 atrás
    expect(s.hombro[1]).toBeLessThan(0);
  });

  it('correr: torso más inclinado y codos más doblados que caminar', () => {
    const c = calcularCaminata(0.2, P.velCaminar, crearSalidaCaminata());
    const r = calcularCaminata(0.2, P.velCorrer, crearSalidaCaminata());
    expect(factorCarrera(P.velCorrer)).toBe(1);
    expect(factorCarrera(P.velCaminar)).toBe(0);
    expect(r.inclinacion).toBeGreaterThan(c.inclinacion + 0.1);
    expect(Math.min(r.codo[0], r.codo[1])).toBeGreaterThan(1);
  });

  it('la fase avanza por distancia y se congela a velocidad 0', () => {
    expect(avanzarFaseCaminata(0.4, 0, 0.1)).toBe(0.4);
    expect(avanzarFaseCaminata(0.4, 2, 0)).toBe(0.4);
    const v = 2;
    const dt = 0.05;
    const f = avanzarFaseCaminata(0, v, dt);
    expect(f * largoZancada(v)).toBeCloseTo(v * dt, 6);
  });

  it('cadencia monótona y continua', () => {
    let previa = cadencia(0);
    for (let v = 0; v < 8; v += 0.05) {
      const c = cadencia(v);
      expect(c).toBeGreaterThanOrEqual(previa - 1e-9);
      expect(c - previa).toBeLessThan(0.1);
      previa = c;
    }
  });
});
