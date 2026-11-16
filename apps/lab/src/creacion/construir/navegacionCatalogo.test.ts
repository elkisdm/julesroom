import { describe, it, expect } from 'vitest';
import { filtrarCatalogo, recordarReciente } from './navegacionCatalogo';
const lista = [
  { id: 'uno', nombre: 'Café térmico', categoria: 'cocina' },
  { id: 'dos', nombre: 'Sofá', categoria: 'asientos' },
];
describe('búsqueda y recientes', () => {
  it('busca sin acentos ni mayúsculas y combina categoría', () => {
    expect(filtrarCatalogo(lista, 'CAFE', '')).toEqual([lista[0]]);
    expect(filtrarCatalogo(lista, 'cafe', 'asientos')).toEqual([]);
    expect(filtrarCatalogo(lista, '', 'asientos')).toEqual([lista[1]]);
  });
  it('recientes se deduplican, ordenan y limitan; descarta ids que ya no existen', () => {
    expect(recordarReciente(['dos', 'uno'], 'uno', 2)).toEqual(['uno', 'dos']);
    expect(recordarReciente(['dos', 'uno'], 'tres', 2)).toEqual(['tres', 'dos']);
    expect(filtrarCatalogo(lista, '', 'recientes', ['nada', 'dos'])).toEqual([lista[1]]);
    expect(filtrarCatalogo(lista, '', 'recientes', [])).toEqual([]);
  });
});
