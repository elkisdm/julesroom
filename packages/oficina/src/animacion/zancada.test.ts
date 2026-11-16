import { describe, expect, it } from 'vitest';
import {
  PARAMETROS_ZANCADA,
  avanzarFase,
  calcularZancada,
  crearSalidaZancada,
  longitudZancada,
} from './zancada';

const A = PARAMETROS_ZANCADA.muslo;
const B = PARAMETROS_ZANCADA.pantorrilla;
const ALTURA_PELVIS = A + B; // 0,62 m en reposo
const BETA = PARAMETROS_ZANCADA.apoyoFraccion;
const VELOCIDADES = [0.3, 0.6, 1.15, 1.6];

/** Cinemática directa del pie: x hacia delante respecto de la pelvis, y sobre el suelo. */
function pie(cadera: number, rodilla: number, pelvisY: number) {
  return {
    x: -(A * Math.sin(cadera) + B * Math.sin(cadera + rodilla)),
    y: ALTURA_PELVIS + pelvisY - (A * Math.cos(cadera) + B * Math.cos(cadera + rodilla)),
  };
}

interface Cuadro {
  fase: number;
  apoyo: 0 | 1;
  x: [number, number]; // x del pie respecto de la pelvis
  y: [number, number]; // altura del pie
  cadera: [number, number];
  rodilla: [number, number];
}

/** Recorre `segundos` a velocidad constante y devuelve un registro por cuadro. */
function recorrer(velocidad: number, dt: number, segundos: number): Cuadro[] {
  const salida = crearSalidaZancada();
  const cuadros: Cuadro[] = [];
  let fase = 0.123;
  for (let i = 0; i < Math.round(segundos / dt); i++) {
    fase = avanzarFase(fase, velocidad, dt);
    calcularZancada(fase, velocidad, salida);
    const p0 = pie(salida.cadera[0], salida.rodilla[0], salida.pelvisY);
    const p1 = pie(salida.cadera[1], salida.rodilla[1], salida.pelvisY);
    cuadros.push({
      fase,
      apoyo: salida.apoyo,
      x: [p0.x, p1.x],
      y: [p0.y, p1.y],
      cadera: [salida.cadera[0], salida.cadera[1]],
      rodilla: [salida.rodilla[0], salida.rodilla[1]],
    });
  }
  return cuadros;
}

const cuadro = (cuadros: Cuadro[], i: number): Cuadro => {
  const c = cuadros[i];
  if (!c) throw new Error(`Cuadro inexistente: ${i}`);
  return c;
};

describe('longitudZancada', () => {
  it('crece suavemente con la velocidad y vale 0 en reposo', () => {
    expect(longitudZancada(0)).toBe(0);
    let anterior = 0;
    for (let v = 0.05; v <= 2; v += 0.05) {
      const l = longitudZancada(v);
      expect(l).toBeGreaterThan(anterior);
      expect(l - anterior).toBeLessThan(0.15);
      anterior = l;
    }
  });
});

describe('avanzarFase', () => {
  it('avanza por distancia: v·dt / longitudZancada, en ciclos', () => {
    const v = 1.15;
    const esperado = (v * 0.1) / longitudZancada(v);
    expect(avanzarFase(0, v, 0.1)).toBeCloseTo(esperado, 10);
  });

  it('con velocidad 0 la fase se congela y con dt = 0 no cambia', () => {
    expect(avanzarFase(0.37, 0, 0.1)).toBe(0.37);
    expect(avanzarFase(0.37, 1.15, 0)).toBe(0.37);
  });

  it('se mantiene en [0, 1)', () => {
    let fase = 0.9;
    for (let i = 0; i < 1000; i++) {
      fase = avanzarFase(fase, 1.6, 0.1);
      expect(fase).toBeGreaterThanOrEqual(0);
      expect(fase).toBeLessThan(1);
    }
  });
});

describe('calcularZancada', () => {
  it.each(VELOCIDADES)('v = %f m/s: el pie de apoyo no patina (< 5 %)', (v) => {
    const dt = 1 / 120;
    const cuadros = recorrer(v, dt, 4);
    let comprobados = 0;
    for (let i = 1; i < cuadros.length; i++) {
      const prev = cuadro(cuadros, i - 1);
      const act = cuadro(cuadros, i);
      if (prev.apoyo !== act.apoyo) continue;
      const pierna = act.apoyo;
      // respecto de la pelvis el pie retrocede a -v; en el suelo queda quieto
      const velPieRespectoCuerpo = (act.x[pierna] - prev.x[pierna]) / dt;
      expect(Math.abs(velPieRespectoCuerpo + v)).toBeLessThan(0.05 * v);
      comprobados++;
    }
    expect(comprobados).toBeGreaterThan(100);
  });

  it.each(VELOCIDADES)('v = %f m/s: el pie de apoyo toca el suelo (< 1 cm)', (v) => {
    for (const c of recorrer(v, 1 / 120, 4)) {
      expect(Math.abs(c.y[c.apoyo])).toBeLessThan(0.01);
    }
  });

  it.each(VELOCIDADES)('v = %f m/s: ningún pie baja más de 1 cm bajo el suelo', (v) => {
    for (const c of recorrer(v, 1 / 120, 4)) {
      expect(Math.min(c.y[0], c.y[1])).toBeGreaterThan(-0.01);
    }
  });

  it('en balanceo el pie se levanta al menos 3 cm a 1,15 m/s y la rodilla se flexiona', () => {
    const cuadros = recorrer(1.15, 1 / 120, 4);
    expect(Math.max(...cuadros.map((c) => Math.max(c.y[0], c.y[1])))).toBeGreaterThanOrEqual(0.03);
    expect(Math.max(...cuadros.map((c) => Math.max(c.rodilla[0], c.rodilla[1])))).toBeGreaterThan(
      0.5,
    );
  });

  it('la rodilla nunca es negativa ni pasa de 2,4 rad y no hay NaN', () => {
    for (const v of [0, 0.05, 0.3, 1.15, 1.6, 2]) {
      for (const c of recorrer(v, 1 / 60, 3)) {
        for (const k of [0, 1] as const) {
          expect(c.rodilla[k]).toBeGreaterThanOrEqual(0);
          expect(c.rodilla[k]).toBeLessThanOrEqual(2.4);
          expect(Number.isFinite(c.cadera[k])).toBe(true);
        }
      }
    }
  });

  it('los ángulos no tienen saltos en la unión apoyo→balanceo ni balanceo→apoyo (60 Hz)', () => {
    // «Salto» = cambio brusco del paso angular entre cuadros consecutivos al cruzar la unión
    // (la velocidad angular del pie en el suelo, ≥ v·dt/L, ya es un paso legítimo por cuadro).
    for (const v of [0.6, 1.15]) {
      const cuadros = recorrer(v, 1 / 60, 8);
      let revisados = 0;
      for (let i = 2; i < cuadros.length; i++) {
        const [p, a, b] = [cuadro(cuadros, i - 2), cuadro(cuadros, i - 1), cuadro(cuadros, i)];
        for (const k of [0, 1] as const) {
          const ua = (a.fase + 0.5 * k) % 1;
          const ub = (b.fase + 0.5 * k) % 1;
          const cruzaBalanceo = ua < BETA && ub >= BETA;
          const cruzaApoyo = ub < ua; // la fase local dio la vuelta: el pie vuelve a apoyarse
          if (!cruzaBalanceo && !cruzaApoyo) continue;
          for (const ang of ['cadera', 'rodilla'] as const) {
            const salto = Math.abs(b[ang][k] - a[ang][k] - (a[ang][k] - p[ang][k]));
            expect(salto).toBeLessThan(0.05);
          }
          revisados++;
        }
      }
      expect(revisados).toBeGreaterThan(10);
    }
  });

  it('a 0,3 m/s el paso angular entre cuadros, incluso en la unión, es < 0,05 rad', () => {
    const cuadros = recorrer(0.3, 1 / 60, 12);
    let revisados = 0;
    for (let i = 1; i < cuadros.length; i++) {
      const act = cuadro(cuadros, i);
      const prev = cuadro(cuadros, i - 1);
      for (const k of [0, 1] as const) {
        const u = (act.fase + 0.5 * k) % 1;
        const d = Math.min(Math.abs(u - BETA), u, 1 - u);
        if (d > 0.02) continue;
        expect(Math.abs(act.cadera[k] - prev.cadera[k])).toBeLessThan(0.05);
        expect(Math.abs(act.rodilla[k] - prev.rodilla[k])).toBeLessThan(0.05);
        revisados++;
      }
    }
    expect(revisados).toBeGreaterThan(5);
  });

  it('la amplitud tiende a 0 cuando v → 0, sin saltos', () => {
    const salida = crearSalidaZancada();
    const amplitud = (v: number) => {
      let m = 0;
      for (let f = 0; f < 1; f += 0.01) {
        calcularZancada(f, v, salida);
        m = Math.max(m, Math.abs(salida.cadera[0]), salida.rodilla[0], Math.abs(salida.pelvisY));
      }
      return m;
    };
    expect(amplitud(0)).toBeCloseTo(0, 6);
    expect(amplitud(0.001)).toBeLessThan(0.02);
    expect(amplitud(0.01)).toBeLessThan(0.15);
    // barrido fino: sin saltos entre velocidades vecinas (misma fase)
    for (const f of [0.1, 0.35, 0.55, 0.8]) {
      let prev = -1;
      let previa = { c: 0, r: 0, p: 0 };
      for (let v = 0; v <= 0.4; v += 0.005) {
        calcularZancada(f, v, salida);
        const act = { c: salida.cadera[0], r: salida.rodilla[0], p: salida.pelvisY };
        if (prev >= 0) {
          expect(Math.abs(act.c - previa.c)).toBeLessThan(0.08);
          expect(Math.abs(act.r - previa.r)).toBeLessThan(0.08);
          expect(Math.abs(act.p - previa.p)).toBeLessThan(0.01);
        }
        prev = v;
        previa = act;
      }
    }
  });

  it('el brazo oscila en contrafase de la cadera de su lado', () => {
    const s = crearSalidaZancada();
    calcularZancada(0.2, 1.15, s);
    for (const k of [0, 1] as const) {
      expect(s.brazo[k]).toBeCloseTo(-PARAMETROS_ZANCADA.gananciaBrazo * s.cadera[k], 10);
    }
  });

  it('pelvisY es un desplazamiento <= 0 respecto de la altura de reposo', () => {
    const s = crearSalidaZancada();
    for (let f = 0; f < 1; f += 0.02) {
      calcularZancada(f, 1.15, s);
      expect(s.pelvisY).toBeLessThanOrEqual(1e-9);
      expect(s.pelvisY).toBeGreaterThan(-0.12);
    }
  });
});
