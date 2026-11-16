import { describe, expect, it } from 'vitest';
import { distancia } from './proximidad';

describe('distancia en planta', () => {
  it('mide la separación entre avatar y agente', () => {
    expect(distancia({ x: 1, z: 2 }, { x: 4, z: 6 })).toBe(5);
  });
  it('vale cero en la misma posición', () => {
    expect(distancia({ x: 1, z: 2 }, { x: 1, z: 2 })).toBe(0);
  });
});
