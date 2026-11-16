import { describe, expect, it } from 'vitest';
import { celdaAtlas, geometriaQuads, quadTocado } from './quads';

describe('geometriaQuads', () => {
  it('une los rectángulos en una sola geometría con su celda del atlas', () => {
    const g = geometriaQuads([
      { x: 0, y: 1, z: 0, ancho: 2, alto: 1, giro: 0, inclinacion: 0, uv: [0, 0.5, 0.5, 1] },
      { x: 5, y: 1, z: -2, ancho: 1, alto: 1, giro: Math.PI, inclinacion: 0, uv: [0.5, 0, 1, 0.5] },
    ]);
    expect(g.getIndex()!.count).toBe(12);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    expect(pos.count).toBe(8);
    // Primer rectángulo: esquinas en x ∈ [−1, 1], y ∈ [0,5, 1,5], cara hacia +z.
    const xs = [0, 1, 2, 3].map((i) => pos.getX(i));
    expect(Math.min(...xs)).toBeCloseTo(-1);
    expect(Math.max(...xs)).toBeCloseTo(1);
    expect(g.getAttribute('normal').getZ(0)).toBeCloseTo(1);
    // El segundo, girado 180°, mira hacia −z.
    expect(g.getAttribute('normal').getZ(4)).toBeCloseTo(-1);
    const us = [4, 5, 6, 7].map((i) => uv.getX(i));
    expect(Math.min(...us)).toBeCloseTo(0.5);
    expect(Math.max(...us)).toBeCloseTo(1);
    g.dispose();
  });

  it('la celda i de un atlas de columnas × filas va de izquierda a derecha y de arriba abajo', () => {
    expect(celdaAtlas(0, 4, 4)).toEqual([0, 0.75, 0.25, 1]);
    expect(celdaAtlas(5, 4, 4)).toEqual([0.25, 0.5, 0.5, 0.75]);
    expect(celdaAtlas(15, 4, 4)).toEqual([0.75, 0, 1, 0.25]);
  });

  it('el triángulo tocado dice qué rectángulo fue', () => {
    expect(quadTocado(0)).toBe(0);
    expect(quadTocado(1)).toBe(0);
    expect(quadTocado(2)).toBe(1);
    expect(quadTocado(11)).toBe(5);
  });
});
