import { describe, expect, it } from 'vitest';
import { leerDegradacion, planDegradacion } from './degradacion';

const red = { retardoMs: 100, jitterMs: 40, perdida: 0.2 };

describe('planDegradacion', () => {
  it('descarta cuando el azar cae bajo la pérdida', () => {
    expect(planDegradacion(() => 0.1, red).descartar).toBe(true);
  });

  it('entrega con retardo ± jitter', () => {
    const valores = [0.9, 1];
    expect(planDegradacion(() => valores.shift() as number, red)).toEqual({
      descartar: false,
      esperaMs: 140,
    });
    const bajos = [0.5, 0];
    expect(planDegradacion(() => bajos.shift() as number, red).esperaMs).toBe(60);
  });

  it('el retraso nunca es negativo', () => {
    const v = [0.9, 0];
    expect(
      planDegradacion(() => v.shift() as number, { retardoMs: 10, jitterMs: 50, perdida: 0 })
        .esperaMs,
    ).toBe(0);
  });
});

describe('leerDegradacion', () => {
  it('lee tres números', () => {
    expect(leerDegradacion('150,60,0.15')).toEqual({ retardoMs: 150, jitterMs: 60, perdida: 0.15 });
  });
  it('rechaza lo mal formado', () => {
    for (const t of [null, '', '1,2', 'a,b,c', '1,2,3', '-1,0,0'])
      expect(leerDegradacion(t)).toBeNull();
  });
});
