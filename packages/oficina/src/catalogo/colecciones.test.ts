import { describe, it, expect } from 'vitest';
import { CONJUNTOS, COLECCIONES, TOPS_NUEVOS, aplicarConjunto } from './colecciones';
import { catalogoBase } from './base';
import { resolverAtuendo } from '../vestuario/resolver';
import { atuendoPorRol } from '../vestuario/roles';
describe('colecciones de ropa', () => {
  it('24 conjuntos únicos en seis colecciones de cuatro, con siluetas diferentes', () => {
    expect(CONJUNTOS).toHaveLength(24);
    expect(new Set(CONJUNTOS.map((c) => c.id)).size).toBe(24);
    expect(COLECCIONES).toHaveLength(6);
    for (const c of COLECCIONES)
      expect(CONJUNTOS.filter((a) => a.coleccion === c.id)).toHaveLength(4);
    expect(TOPS_NUEVOS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(CONJUNTOS.map((c) => JSON.stringify(c.atuendo))).size).toBe(24);
  });
  it('todos resuelven completos sin avisos y mantienen piel, pelo y cara', () => {
    for (const skin of catalogoBase.pieles)
      for (const c of CONJUNTOS) {
        const a = { ...atuendoPorRol('', 1), skin };
        const b = aplicarConjunto(a, c.id);
        const avisos: string[] = [];
        const r = resolverAtuendo({ ...catalogoBase, paquetes: [] }, b, (m) => avisos.push(m));
        expect(avisos).toEqual([]);
        expect(r.top).toBe(c.atuendo.top);
        expect(r.skin).toBe(skin);
        expect(r.hair).toBe(a.hair);
        expect(r.face).toBe(a.face);
        expect(r.top).not.toBe('fundador');
      }
  });
  it('un id desconocido no altera el atuendo', () => {
    const a = atuendoPorRol('', 1);
    expect(aplicarConjunto(a, 'nada')).toBe(a);
  });
});
