import { describe, expect, it } from 'vitest';
import { escenarioTrading } from '../escenarios/trading';
import { conSueloExtra } from '../escenarios/personalizacion';
import { espacioD2 } from './espacioD2';
describe('espacio libre para la dinámica', () => {
  it('acepta suelo real y rechaza exterior y una altura sin apoyo', () => {
    const libre = espacioD2(escenarioTrading, 0);
    expect(libre({ x: 0, y: 0, z: 6 })).toBe(true);
    expect(libre({ x: 100, y: 0, z: 6 })).toBe(false);
    expect(libre({ x: 0, y: 10, z: 6 })).toBe(false);
  });
  it('respeta los objetos añadidos al mundo después de cargar la plantilla', () => {
    const p = { x: 0, y: 0, z: 6 };
    const mundo = conSueloExtra(
      escenarioTrading,
      [{ id: 'mueble-d2', tipo: 'mueble', x0: -0.5, x1: 0.5, z0: 5.5, z1: 6.5, y0: 0, y1: 2 }],
      [],
    );
    expect(espacioD2(escenarioTrading, 0)(p)).toBe(true);
    expect(espacioD2(mundo, 0)(p)).toBe(false);
  });
});
