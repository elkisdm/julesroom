import { describe, expect, it } from 'vitest';
import { catalogoBase } from './base';
import { paqueteHalloween } from './halloween';
import { crearCatalogo, registrarPaquete } from './registro';
import type { PaqueteSkins } from '../tipos';

describe('catalogo', () => {
  it('catalogoBase declara zona en cada pieza y la calabaza excluye pelo, cara y lentes', () => {
    const catalogo = registrarPaquete(crearCatalogo(catalogoBase), paqueteHalloween);
    const calabaza = catalogo.piezas.find((p) => p.id === 'calabaza');
    expect(calabaza?.zona).toBe('cabeza');
    expect(calabaza?.excluye).toEqual(expect.arrayContaining(['pelo', 'expresion', 'cara']));
    expect(catalogo.piezas.every((p) => p.zona.length > 0)).toBe(true);
  });

  it('Halloween trae los 6 disfraces', () => {
    expect(paqueteHalloween.disfraces?.map((d) => d.nombre)).toEqual([
      'Vampiro',
      'Calabaza',
      'Bruja',
      'Esqueleto',
      'Momia',
      'Diablito',
    ]);
  });

  it('un paquete falso con capa-roja en zona espalda se registra sin tocar el motor', () => {
    const falso: PaqueteSkins = {
      id: 'falso',
      nombre: 'Falso',
      piezas: [{ id: 'capa-roja', nombre: 'Capa roja', zona: 'espalda' }],
    };
    const catalogo = registrarPaquete(crearCatalogo(catalogoBase), falso);
    expect(catalogo.piezas.find((p) => p.id === 'capa-roja')?.zona).toBe('espalda');
    expect(catalogo.paquetes).toContain('falso');
  });

  it('es inmutable: el catálogo original no cambia', () => {
    const original = crearCatalogo(catalogoBase);
    const antes = original.piezas.length;
    registrarPaquete(original, paqueteHalloween);
    expect(original.piezas).toHaveLength(antes);
  });

  it('ids duplicados lanzan un error descriptivo', () => {
    const base = crearCatalogo(catalogoBase);
    const duplicado: PaqueteSkins = {
      id: 'dup',
      nombre: 'Dup',
      piezas: [{ id: 'gorra', nombre: 'Otra gorra', zona: 'sombrero' }],
    };
    expect(() => registrarPaquete(base, duplicado)).toThrow(/gorra/);
    const dentro = registrarPaquete(base, paqueteHalloween);
    expect(() => registrarPaquete(dentro, paqueteHalloween)).toThrow(/halloween/i);
  });

  it('rechaza ids repetidos dentro del mismo paquete', () => {
    const base = crearCatalogo(catalogoBase);
    const interno: PaqueteSkins = {
      id: 'interno',
      nombre: 'Interno',
      piezas: [
        { id: 'x', nombre: 'X', zona: 'mano' },
        { id: 'x', nombre: 'X2', zona: 'mano' },
      ],
    };
    expect(() => registrarPaquete(base, interno)).toThrow(/x/);
  });
});
