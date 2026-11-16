import { describe, expect, it } from 'vitest';
import { ajustar, girar, huella, radianes } from './rejilla';

describe('rejilla', () => {
  it('ajusta al múltiplo más cercano', () => {
    expect(ajustar(1.3, 0.5)).toBe(1.5);
    expect(ajustar(1.2, 0.5)).toBe(1);
  });

  it('nunca devuelve -0', () => {
    expect(Object.is(ajustar(-0.1, 0.5), 0)).toBe(true);
  });

  it('gira en cuartos de vuelta y da la vuelta completa', () => {
    expect(girar(3, 1)).toBe(0);
    expect(girar(0, -1)).toBe(3);
    expect(girar(1, 1)).toBe(2);
  });

  it('radianes: un cuarto de vuelta es π/2', () => {
    expect(radianes(0)).toBe(0);
    expect(radianes(1)).toBeCloseTo(Math.PI / 2);
  });

  it('huella: caja centrada; en giros impares intercambia ancho y fondo', () => {
    const a = huella({ tipo: 'sofa-tres', x: 2, z: 3, giro: 0 });
    const b = huella({ tipo: 'sofa-tres', x: 2, z: 3, giro: 1 });
    expect(a.x1 - a.x0).toBeCloseTo(b.z1 - b.z0);
    expect(a.z1 - a.z0).toBeCloseTo(b.x1 - b.x0);
    expect((a.x0 + a.x1) / 2).toBeCloseTo(2);
    expect((a.z0 + a.z1) / 2).toBeCloseTo(3);
  });

  it('huella: un tipo desconocido lanza', () => {
    expect(() => huella({ tipo: 'nada', x: 0, z: 0, giro: 0 })).toThrow(/nada/);
  });
});
