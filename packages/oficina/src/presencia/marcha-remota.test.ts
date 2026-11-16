import { describe, expect, it } from 'vitest';
import { avanzarMarchaRemota, crearMarchaRemota, VELOCIDAD_PASEO } from './marcha-remota';

describe('marcha de una persona remota', () => {
  it('quieta: la marcha decae a 0 y la fase no avanza', () => {
    const m = crearMarchaRemota(2, 3);
    m.marcha = 1;
    for (let i = 0; i < 60; i++) avanzarMarchaRemota(m, 2, 3, 1 / 30);
    expect(m.marcha).toBeLessThan(0.01);
    const fase = m.fase;
    avanzarMarchaRemota(m, 2, 3, 1 / 30);
    expect(m.fase).toBeCloseTo(fase, 2);
  });

  it('a paso de paseo: la marcha sube a ~1 y la fase avanza', () => {
    const m = crearMarchaRemota(0, 0);
    let x = 0;
    for (let i = 0; i < 90; i++) {
      x += VELOCIDAD_PASEO / 30;
      avanzarMarchaRemota(m, x, 0, 1 / 30);
    }
    expect(m.marcha).toBeGreaterThan(0.9);
    expect(m.fase).toBeGreaterThan(1);
  });

  it('un salto grande (reconexión) no dispara la marcha', () => {
    const m = crearMarchaRemota(0, 0);
    avanzarMarchaRemota(m, 40, 0, 1 / 30);
    expect(m.marcha).toBeLessThan(1.001);
    expect(Number.isFinite(m.fase)).toBe(true);
    expect(m.marcha).toBeLessThanOrEqual(1);
  });

  it('dt 0 no divide por cero', () => {
    const m = crearMarchaRemota(0, 0);
    avanzarMarchaRemota(m, 1, 0, 0);
    expect(Number.isFinite(m.marcha)).toBe(true);
    expect(Number.isFinite(m.fase)).toBe(true);
  });
});
