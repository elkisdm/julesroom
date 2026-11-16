import { describe, expect, it } from 'vitest';
import { ALTURA_ASIENTO } from '../render/casa/ambientes/asientos';
import type { AsientoAccion } from '../escenarios/tipos';
import {
  avanzarSentarse,
  crearSentarse,
  levantar,
  llegar,
  ocupado,
  PARAMETROS_SENTARSE,
  pedirSentarse,
  PELVIS_DE_PIE,
  PELVIS_SENTADA,
  posturaDe,
} from './sentarse';
import type { Sentarse } from './sentarse';

const asiento: AsientoAccion = {
  x: 2,
  z: 0,
  y: 0.45,
  yaw: Math.PI / 2,
  aproximacion: { x: 1, z: 0, y: 0 },
};
const cuerpo = () => ({ x: 1, z: 0, rumbo: 0 });

/** Avanza en cuadros de 1/60 s hasta que `listo` o se acaba el tiempo. */
function correr(s: Sentarse, c: ReturnType<typeof cuerpo>, listo: () => boolean, max = 5): number {
  let t = 0;
  while (!listo() && t < max) {
    avanzarSentarse(s, c, 1 / 60);
    t += 1 / 60;
  }
  return t;
}

describe('alturas del cuerpo', () => {
  it('coinciden con las del dibujo de los asientos', () => {
    expect(PELVIS_SENTADA).toBeCloseTo(ALTURA_ASIENTO, 6);
    expect(PELVIS_DE_PIE - PELVIS_SENTADA).toBeCloseTo(0.17, 6);
  });
});

describe('máquina de sentarse', () => {
  it('empieza libre y de pie', () => {
    const s = crearSentarse();
    expect(s.fase).toBe('libre');
    expect(posturaDe(s)).toBe('de-pie');
    expect(ocupado(s)).toBe(false);
  });

  it('pedir desde libre pasa a yendo; pedir de nuevo se rechaza', () => {
    const s = crearSentarse();
    expect(pedirSentarse(s, 'a', asiento)).toBe(true);
    expect(s.fase).toBe('yendo');
    expect(s.id).toBe('a');
    expect(pedirSentarse(s, 'b', asiento)).toBe(false);
    expect(s.id).toBe('a');
  });

  it('yendo no mueve el cuerpo (lo conduce la ruta)', () => {
    const s = crearSentarse();
    const c = cuerpo();
    pedirSentarse(s, 'a', asiento);
    avanzarSentarse(s, c, 0.5);
    expect(c).toEqual(cuerpo());
    expect(ocupado(s)).toBe(false);
  });

  it('recorre yendo → girando → sentándose → sentado y termina en el asiento mirando su yaw', () => {
    const s = crearSentarse();
    const c = cuerpo();
    pedirSentarse(s, 'a', asiento);
    llegar(s);
    expect(s.fase).toBe('girando');
    const fases = new Set<string>();
    correr(s, c, () => {
      fases.add(s.fase);
      return s.fase === 'sentado';
    });
    expect([...fases]).toEqual(['girando', 'sentandose', 'sentado']);
    avanzarSentarse(s, c, 1 / 60);
    expect(c.x).toBeCloseTo(asiento.x, 6);
    expect(c.z).toBeCloseTo(asiento.z, 6);
    expect(c.rumbo).toBeCloseTo(asiento.yaw, 6);
    expect(s.salida.altura).toBe(1);
    expect(posturaDe(s)).toBe('sentado');
  });

  it('girando toma el camino corto y no se pasa del rumbo', () => {
    const s = crearSentarse();
    const c = { x: 1, z: 0, rumbo: -Math.PI + 0.1 };
    pedirSentarse(s, 'a', { ...asiento, yaw: Math.PI - 0.1 });
    llegar(s);
    avanzarSentarse(s, c, 1 / 60);
    // −π+0,1 → π−0,1 es un giro de 0,2 rad por el lado corto (hacia −π), no de 6,08 por el largo.
    expect(c.rumbo).toBeGreaterThan(0);
    correr(s, c, () => s.fase !== 'girando');
    expect(c.rumbo).toBeCloseTo(Math.PI - 0.1, 6);
  });

  it('al sentarse la altura baja de 0 a 1 sin saltos y el cuerpo se desliza de la aproximación al asiento', () => {
    const s = crearSentarse();
    const c = cuerpo();
    pedirSentarse(s, 'a', asiento);
    llegar(s);
    correr(s, c, () => s.fase === 'sentandose');
    let anterior = s.salida.altura;
    let xAnterior = c.x;
    let pico = 0;
    while (s.fase === 'sentandose') {
      avanzarSentarse(s, c, 1 / 60);
      expect(Math.abs(s.salida.altura - anterior)).toBeLessThan(0.12);
      expect(Math.abs(c.x - xAnterior)).toBeLessThan(0.1);
      expect(c.x).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(c.x).toBeLessThanOrEqual(2 + 1e-9);
      pico = Math.max(pico, s.salida.inclinacionTorso);
      anterior = s.salida.altura;
      xAnterior = c.x;
    }
    expect(pico).toBeGreaterThan(0.1);
  });

  it('levantarse desde sentado vuelve a la aproximación y queda libre', () => {
    const s = crearSentarse();
    const c = cuerpo();
    pedirSentarse(s, 'a', asiento);
    llegar(s);
    correr(s, c, () => s.fase === 'sentado');
    levantar(s);
    expect(s.fase).toBe('levantandose');
    expect(posturaDe(s)).toBe('de-pie');
    const t = correr(s, c, () => s.fase === 'libre');
    expect(t).toBeLessThan(PARAMETROS_SENTARSE.duracionLevantarse + 0.1);
    expect(c.x).toBeCloseTo(1, 6);
    expect(c.z).toBeCloseTo(0, 6);
    expect(s.asiento).toBeNull();
    expect(s.salida.altura).toBe(0);
  });

  it('levantar a mitad de sentarse continúa por la misma altura', () => {
    const s = crearSentarse();
    const c = cuerpo();
    pedirSentarse(s, 'a', asiento);
    llegar(s);
    correr(s, c, () => s.fase === 'sentandose');
    for (let i = 0; i < 25; i++) avanzarSentarse(s, c, 1 / 60);
    const antes = s.salida.altura;
    expect(antes).toBeGreaterThan(0.05);
    expect(antes).toBeLessThan(1);
    levantar(s);
    avanzarSentarse(s, c, 1e-6);
    expect(s.fase).toBe('levantandose');
    expect(Math.abs(s.salida.altura - antes)).toBeLessThan(0.03);
  });

  it('levantar yendo o girando cancela sin transición', () => {
    for (const fase of ['yendo', 'girando'] as const) {
      const s = crearSentarse();
      pedirSentarse(s, 'a', asiento);
      if (fase === 'girando') llegar(s);
      levantar(s);
      expect(s.fase).toBe('libre');
      expect(s.asiento).toBeNull();
    }
  });

  it('levantar estando libre o ya levantándose no hace nada', () => {
    const s = crearSentarse();
    levantar(s);
    expect(s.fase).toBe('libre');
    const c = cuerpo();
    pedirSentarse(s, 'a', asiento);
    llegar(s);
    correr(s, c, () => s.fase === 'sentado');
    levantar(s);
    const t = s.t;
    levantar(s);
    expect(s.t).toBe(t);
  });

  it('no asigna memoria al avanzar (el estado conserva su identidad y su salida)', () => {
    const s = crearSentarse();
    const salida = s.salida;
    const c = cuerpo();
    pedirSentarse(s, 'a', asiento);
    llegar(s);
    correr(s, c, () => s.fase === 'sentado');
    levantar(s);
    correr(s, c, () => s.fase === 'libre');
    expect(s.salida).toBe(salida);
  });
});
