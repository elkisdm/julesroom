import { expect, it } from 'vitest';
import { encuadrarPizarra } from './encuadre';
it('encuadra el tablero completo a 1440, 390 y 320, en cualquier orientación', () => {
  for (const [ancho, alto] of [
    [1440, 900],
    [390, 844],
    [320, 640],
  ]) {
    for (const giro of [0, Math.PI / 3, Math.PI]) {
      const e = encuadrarPizarra({ x: 2, y: 3.9, z: 4, giro }, ancho!, alto!, 50);
      const d = Math.hypot(e.posicion.x - e.objetivo.x, e.posicion.z - e.objetivo.z);
      expect(((d * Math.tan((25 * Math.PI) / 180) * ancho!) / alto!) * 2).toBeGreaterThan(6.16);
      expect(d * Math.tan((25 * Math.PI) / 180) * 2).toBeGreaterThan(3.8);
      expect(e.objetivo.y).toBeGreaterThan(3.9);
    }
  }
});
