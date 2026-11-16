import { describe, expect, it } from 'vitest';
import {
  crearResorte,
  resorteCritico,
  resorteSub,
  suavizarAnguloExp,
  suavizarExp,
} from './resorte';

/** Simula `segundos` con pasos de `dt` y devuelve el resorte final. */
function simular(
  paso: (r: ReturnType<typeof crearResorte>, dt: number) => void,
  segundos: number,
  dt: number,
  x0 = 0,
) {
  const r = crearResorte(x0);
  const n = Math.round(segundos / dt);
  for (let i = 0; i < n; i++) paso(r, dt);
  return r;
}

describe('crearResorte', () => {
  it('nace en reposo en la posición dada', () => {
    expect(crearResorte()).toEqual({ x: 0, v: 0 });
    expect(crearResorte(2)).toEqual({ x: 2, v: 0 });
  });
});

describe('resorteCritico', () => {
  it('converge al objetivo sin rebasarlo', () => {
    const r = crearResorte(0);
    let maximo = 0;
    for (let i = 0; i < 600; i++) {
      resorteCritico(r, 1, 0, 0.1, 1 / 60);
      maximo = Math.max(maximo, r.x);
    }
    expect(r.x).toBeCloseTo(1, 4);
    expect(Math.abs(r.v)).toBeLessThan(1e-3);
    expect(maximo).toBeLessThanOrEqual(1 + 1e-6);
  });

  it('a la media vida queda a ~60 % de la distancia inicial (definición de Holden con v0 = 0)', () => {
    const r = simular((s, dt) => resorteCritico(s, 1, 0, 0.2, dt), 0.2, 1 / 240);
    // restante = 0,25·(1 + 2·ln 2) ≈ 0,60; el valor de la fuente, no exactamente 0,5
    expect(1 - r.x).toBeCloseTo(0.25 * (1 + 2 * Math.LN2), 2);
  });

  it('da casi el mismo resultado con dt de 1/30 y de 1/144', () => {
    const a = simular((s, dt) => resorteCritico(s, 1, 0, 0.15, dt), 0.5, 1 / 30);
    const b = simular((s, dt) => resorteCritico(s, 1, 0, 0.15, dt), 0.5, 1 / 144 / 1);
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.01);
  });

  it('con dt = 0 no cambia nada', () => {
    const r = { x: 0.3, v: -2 };
    resorteCritico(r, 1, 0, 0.1, 0);
    expect(r.x).toBeCloseTo(0.3, 12);
    expect(r.v).toBeCloseTo(-2, 12);
  });

  it('con un dt enorme no explota', () => {
    const r = crearResorte(0);
    resorteCritico(r, 5, 0, 0.1, 100);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(r.x).toBeCloseTo(5, 6);
  });

  it('con velocidad de meta sigue a un objetivo que se mueve', () => {
    const r = crearResorte(0);
    for (let i = 0; i < 600; i++) resorteCritico(r, 1 * (i / 60), 1, 0.1, 1 / 60);
    // tras 10 s el objetivo está en 10; el resorte lo sigue con un retraso finito
    expect(Math.abs(r.x - 10)).toBeLessThan(0.5);
    expect(r.v).toBeCloseTo(1, 1);
  });
});

describe('resorteSub', () => {
  it('subamortiguado rebasa el objetivo y se asienta', () => {
    const r = crearResorte(0);
    let maximo = 0;
    for (let i = 0; i < 60; i++) {
      resorteSub(r, 1, 20, 0.3, 1 / 60);
      maximo = Math.max(maximo, r.x);
    }
    expect(maximo).toBeGreaterThan(1.1);
    for (let i = 0; i < 600; i++) resorteSub(r, 1, 20, 0.3, 1 / 60);
    expect(r.x).toBeCloseTo(1, 4);
    expect(Math.abs(r.v)).toBeLessThan(1e-3);
  });

  it('si la razón es >= 1 no rebasa (cae al crítico)', () => {
    for (const razon of [1, 1.5]) {
      const r = crearResorte(0);
      let maximo = 0;
      for (let i = 0; i < 300; i++) {
        resorteSub(r, 1, 20, razon, 1 / 60);
        maximo = Math.max(maximo, r.x);
      }
      expect(maximo).toBeLessThanOrEqual(1 + 1e-6);
      expect(r.x).toBeCloseTo(1, 3);
    }
  });

  it('es independiente de la tasa de cuadros', () => {
    const a = simular((s, dt) => resorteSub(s, 1, 15, 0.4, dt), 0.6, 1 / 30);
    const b = simular((s, dt) => resorteSub(s, 1, 15, 0.4, dt), 0.6, 1 / 144);
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.01);
  });

  it('con dt = 0 no cambia y con dt enorme no explota', () => {
    const r = { x: 0.3, v: -2 };
    resorteSub(r, 1, 20, 0.3, 0);
    expect(r.x).toBeCloseTo(0.3, 12);
    expect(r.v).toBeCloseTo(-2, 12);
    resorteSub(r, 1, 20, 0.3, 100);
    expect(Number.isFinite(r.x) && Number.isFinite(r.v)).toBe(true);
    expect(Math.abs(r.x - 1)).toBeLessThan(1e-6);
  });

  it('con frecuencia 0 no produce NaN', () => {
    const r = { x: 0.3, v: 1 };
    resorteSub(r, 1, 0, 0.3, 0.1);
    expect(Number.isFinite(r.x) && Number.isFinite(r.v)).toBe(true);
  });
});

describe('suavizarExp', () => {
  it('a la media vida queda exactamente a la mitad', () => {
    expect(suavizarExp(0, 1, 0.3, 0.3)).toBeCloseTo(0.5, 4);
  });

  it('converge al objetivo', () => {
    let x = 0;
    for (let i = 0; i < 300; i++) x = suavizarExp(x, 4, 0.1, 1 / 60);
    expect(x).toBeCloseTo(4, 4);
  });

  it('no depende de la tasa de cuadros', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 30; i++) a = suavizarExp(a, 1, 0.2, 1 / 30);
    for (let i = 0; i < 144; i++) b = suavizarExp(b, 1, 0.2, 1 / 144);
    expect(a).toBeCloseTo(b, 6);
  });

  it('dt = 0 no cambia; media vida 0 salta al objetivo; dt grande no pasa del objetivo', () => {
    expect(suavizarExp(2, 5, 0.2, 0)).toBe(2);
    expect(suavizarExp(2, 5, 0, 0.01)).toBeCloseTo(5, 6);
    expect(suavizarExp(2, 5, 0.2, 1000)).toBeCloseTo(5, 9);
  });
});

describe('suavizarAnguloExp', () => {
  it('toma el camino corto a través de ±π', () => {
    const siguiente = suavizarAnguloExp(3, -3, 0.2, 0.05);
    expect(siguiente).toBeGreaterThan(3); // sube hacia π, no baja por 0
  });

  it('converge al ángulo equivalente', () => {
    let a = 3;
    for (let i = 0; i < 300; i++) a = suavizarAnguloExp(a, -3, 0.1, 1 / 60);
    const dif = Math.atan2(Math.sin(a - -3), Math.cos(a - -3));
    expect(Math.abs(dif)).toBeLessThan(1e-4);
  });

  it('dt = 0 no cambia', () => {
    expect(suavizarAnguloExp(1, -2, 0.2, 0)).toBe(1);
  });
});
