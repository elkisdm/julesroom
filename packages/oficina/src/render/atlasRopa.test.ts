import { describe, it, expect } from 'vitest';
import { PARAMETROS_ATLAS_ROPA, datosTorsoCanonicos } from './atlasRopa';
import { CONJUNTOS, TOPS_NUEVOS } from '../catalogo/colecciones';
import { catalogoBase } from '../catalogo/base';
import { crearAsignador } from './celdas';
describe('atlas de ropa ampliada', () => {
  it('cuadruplica las celdas sin aumentar píxeles del atlas', () => {
    const p = PARAMETROS_ATLAS_ROPA;
    expect(p.columnas * p.filas).toBe(512);
    expect(p.columnas * p.filas * p.celdaAncho * p.celdaAlto).toBe(128 * 128 * 136);
  });
  it('compartir fondos lisos permite recorrer todos los colores y siluetas', () => {
    const a = crearAsignador(512),
      colores = [...catalogoBase.coloresTop, ...CONJUNTOS.map((c) => c.atuendo.topColor)];
    for (const top of catalogoBase.tops)
      for (const topColor of colores) {
        const d = datosTorsoCanonicos({ top: top.id, topColor, print: '', face: 'feliz' });
        expect(() => a.asignar(JSON.stringify(d))).not.toThrow();
      }
    for (const top of TOPS_NUEVOS)
      expect(
        datosTorsoCanonicos({ top: top.id, topColor: '#222222', print: '', face: 'feliz' }).top,
      ).toBe('liso');
    expect(
      datosTorsoCanonicos({ top: 'polera', topColor: '#222222', print: 'X', face: 'feliz' }).print,
    ).toBe('X');
  });
});
