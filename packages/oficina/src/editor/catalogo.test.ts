import { describe, expect, it } from 'vitest';
import { CATALOGO_OBJETOS, CATEGORIAS, tipoObjeto } from './catalogo';

describe('catálogo de objetos', () => {
  it('los tipos son únicos, con medidas positivas y categoría declarada', () => {
    const ids = CATALOGO_OBJETOS.map((t) => t.tipo);
    expect(new Set(ids).size).toBe(ids.length);
    const cats = new Set(CATEGORIAS.map((c) => c.id));
    for (const t of CATALOGO_OBJETOS) {
      expect(t.ancho).toBeGreaterThan(0);
      expect(t.fondo).toBeGreaterThan(0);
      expect(t.alto).toBeGreaterThan(0);
      expect(cats.has(t.categoria)).toBe(true);
    }
    expect(CATALOGO_OBJETOS.length).toBeGreaterThanOrEqual(18);
  });

  it('los sentables son sofá, sillón, puff y banco; la alfombra es pisable', () => {
    const sentables = CATALOGO_OBJETOS.filter((t) => t.sentable).map((t) => t.tipo);
    expect(sentables).toEqual(expect.arrayContaining(['banco', 'puff', 'sillon', 'sofa-tres']));
    expect(tipoObjeto('alfombra')?.pisable).toBe(true);
    expect(tipoObjeto('alfombra')?.alto).toBe(0.02);
  });

  it('tipoObjeto devuelve undefined si no existe', () => {
    expect(tipoObjeto('nada')).toBeUndefined();
  });
});
