import { describe, expect, it } from 'vitest';
import { BoxGeometry } from 'three';
import type { Bloque } from './arquitectura';
import { fusionarPorCorte, geometriaBloque, prepararPieza } from './geometria';

const caja = (b: Partial<Bloque>): Bloque => ({
  material: 'hormigon',
  rol: 'muro',
  x0: 0,
  x1: 1,
  y0: 0,
  y1: 1,
  z0: 0,
  z1: 1,
  ...b,
});

describe('geometriaBloque', () => {
  it('pone la caja en su lugar con UV en metros del mundo (continuas entre cajas)', () => {
    const g = geometriaBloque(caja({ x0: 4, x1: 6, y0: 1, y1: 3, z0: -4, z1: -2 }));
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      expect(x).toBeGreaterThanOrEqual(4 - 1e-9);
      expect(x).toBeLessThanOrEqual(6 + 1e-9);
      const [u, v] = [uv.getX(i), uv.getY(i)];
      if (Math.abs(nor.getY(i)) > 0.9) expect([u, v]).toEqual([x, z]);
      else if (Math.abs(nor.getX(i)) > 0.9) expect([u, v]).toEqual([z, y]);
      else expect([u, v]).toEqual([x, y]);
    }
  });

  it('en planta la veta sigue el lado largo: una tabla a lo largo de z gira sus UV', () => {
    const g = geometriaBloque(caja({ x0: 0, x1: 0.14, z0: 0, z1: 5 }));
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(nor.getY(i)) > 0.9)
        expect([uv.getX(i), uv.getY(i)]).toEqual([pos.getZ(i), pos.getX(i)]);
    }
  });

  it('con pendiente cizalla la caja: sube en y a lo largo de z, con cortes a plomo', () => {
    const g = geometriaBloque(caja({ z0: 0, z1: 4, y0: 0, y1: 1, pendiente: 0.5 }));
    const pos = g.getAttribute('position');
    let maxY = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < pos.count; i++) {
      // y relativo a la recta de la pendiente: siempre entre 0 y 1.
      const relativo = pos.getY(i) - 0.5 * (pos.getZ(i) - 2);
      expect(relativo).toBeGreaterThanOrEqual(-1e-9);
      expect(relativo).toBeLessThanOrEqual(1 + 1e-9);
      maxY = Math.max(maxY, pos.getY(i));
      minY = Math.min(minY, pos.getY(i));
    }
    expect(maxY).toBeCloseTo(2, 9);
    expect(minY).toBeCloseTo(-1, 9);
  });
});

describe('fusionarPorCorte', () => {
  const clave = (g: { material: string; lado?: string }) => `${g.material}|${g.lado ?? ''}`;

  it('una geometría por (material, costado), con todas sus cajas y piezas', () => {
    const grupos = fusionarPorCorte(
      [
        caja({}),
        caja({ x0: 2, x1: 3 }),
        caja({ lado: 'este' }),
        caja({ lado: 'este', x0: 5, x1: 6 }),
        caja({ lado: 'oeste' }),
        caja({ material: 'vidrio' }),
      ],
      [{ material: 'vidrio', geometria: prepararPieza(new BoxGeometry(1, 1, 1)) }],
    );
    expect(grupos.map(clave).sort()).toEqual([
      'hormigon|',
      'hormigon|este',
      'hormigon|oeste',
      'vidrio|',
    ]);
    const vertices = (c: string) =>
      grupos.find((g) => clave(g) === c)?.geometria.getAttribute('position').count;
    expect(vertices('hormigon|')).toBe(2 * 36);
    expect(vertices('hormigon|este')).toBe(2 * 36);
    expect(vertices('hormigon|oeste')).toBe(36);
    expect(vertices('vidrio|')).toBe(2 * 36);
    for (const g of grupos) {
      expect(Object.keys(g.geometria.attributes).sort()).toEqual(['normal', 'position', 'uv']);
    }
  });

  it('una pieza suelta lleva su costado al grupo', () => {
    const [g] = fusionarPorCorte(
      [],
      [{ material: 'cobre', lado: 'norte', geometria: prepararPieza(new BoxGeometry(1, 1, 1)) }],
    );
    expect(g?.lado).toBe('norte');
  });
});
