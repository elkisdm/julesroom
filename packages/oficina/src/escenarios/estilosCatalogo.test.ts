import { describe, it, expect } from 'vitest';
import { ESTILOS_CATALOGO, variantesConCatalogo } from './estilosCatalogo';
import { resolverVariante } from './variantes';
describe('estilos completos del catálogo', () => {
  it('seis paletas con piso, pared, madera, metal y acentos, sin duplicar ids', () => {
    expect(ESTILOS_CATALOGO).toHaveLength(6);
    expect(new Set(ESTILOS_CATALOGO.map((v) => v.id)).size).toBe(6);
    for (const v of ESTILOS_CATALOGO) {
      for (const k of ['cemento', 'ladrillo', 'roble', 'acero', 'salvia'])
        expect(v.paleta.materiales?.[k]).toMatch(/^#[a-f0-9]{6}$/i);
      expect(v.paleta.emisivos).toBeDefined();
    }
  });
  it('agrega estilos sin mutar variantes y los resuelve manteniendo el fallback antiguo', () => {
    const base = [{ id: 'base', nombre: 'Base', paleta: { hora: 10 } }];
    const r = variantesConCatalogo(base);
    expect(base).toHaveLength(1);
    expect(r).toHaveLength(7);
    expect(variantesConCatalogo(r)).toHaveLength(7);
    expect(resolverVariante(base, 'catalogo-onix').variante.id).toBe('catalogo-onix');
    expect(resolverVariante(base, 'inexistente').variante.id).toBe('base');
  });
});
