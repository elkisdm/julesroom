import { describe, expect, it } from 'vitest';
import { HUELLA, VUELO } from './arquitectura';
import { ALTO_MURO, ANCHO_SUELO, sombrasExteriores } from './contacto';

const dentroDeLaHuella = (x: number, z: number) =>
  x > HUELLA.x0 + 1e-6 && x < HUELLA.x1 - 1e-6 && z > HUELLA.z0 + 1e-6 && z < HUELLA.z1 - 1e-6;

/** Normal de un cuadro por el producto cruz de sus dos primeras aristas. */
function normal(e: [number, number, number][]) {
  const [a, b, c] = e as [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [
    u[1]! * v[2]! - u[2]! * v[1]!,
    u[2]! * v[0]! - u[0]! * v[2]!,
    u[0]! * v[1]! - u[1]! * v[0]!,
  ];
}

describe('sombrasExteriores', () => {
  const cuadros = sombrasExteriores();

  it('nada cae dentro de la casa: todo va por fuera de su huella', () => {
    for (const c of cuadros) {
      for (const [x, , z] of c.esquinas) expect(dentroDeLaHuella(x, z)).toBe(false);
    }
  });

  it('en el suelo, oscuro en la arista del muro y transparente lejos de ella', () => {
    const suelo = cuadros.filter((c) => c.esquinas.every(([, y]) => y < 0.05));
    expect(suelo).toHaveLength(3);
    for (const c of suelo) {
      c.esquinas.forEach(([x, , z], i) => {
        // Distancia de la esquina a la huella: 0 si está en la arista del muro.
        const d = Math.hypot(
          Math.max(HUELLA.x0 - x, 0, x - HUELLA.x1),
          Math.max(HUELLA.z0 - z, 0, z - HUELLA.z1),
        );
        expect(c.alfa[i]! > 0).toBe(d < 1e-6);
      });
      expect(normal(c.esquinas)[1]).toBeGreaterThan(0);
    }
    expect(ANCHO_SUELO).toBeGreaterThan(VUELO);
  });

  it('en los muros de los costados, bajo cada losa en voladizo, oscuro arriba y mirando afuera', () => {
    const muros = cuadros.filter((c) => c.esquinas.some(([, y]) => y > 0.05));
    expect(muros).toHaveLength(6);
    for (const c of muros) {
      const ys = c.esquinas.map(([, y]) => y);
      const techo = Math.max(...ys);
      expect(techo - Math.min(...ys)).toBeCloseTo(ALTO_MURO, 6);
      c.esquinas.forEach(([, y], i) => expect(c.alfa[i]! > 0).toBe(y === techo));
      // La cara mira hacia afuera de la casa (+x en el este, -x en el oeste).
      const x = c.esquinas[0]![0];
      expect(Math.sign(normal(c.esquinas)[0]!)).toBe(Math.sign(x));
    }
  });
});
