import { describe, expect, it } from 'vitest';
import { encuadreFoto } from './encuadreFoto';
describe('encuadre de foto de grupo', () => {
  it('incluye cabezas y pies de veinte presentes incluso en pantalla vertical', () => {
    const puntos = Array.from({ length: 20 }, (_, i) => ({ x: i - 10, y: 0, z: i % 4 }));
    for (const aspecto of [16 / 10, 390 / 844]) {
      const e = encuadreFoto(puntos, aspecto, 45);
      for (const p of puntos) {
        const radio = Math.hypot(p.x - e.centro.x, p.y - e.centro.y, p.z - e.centro.z) + 2;
        expect(e.distancia * Math.sin(e.angulo)).toBeGreaterThan(radio);
      }
    }
  });
  it('tiene un encuadre seguro sin participantes', () => {
    expect(encuadreFoto([], 1, 45).distancia).toBeGreaterThan(0);
  });
});
