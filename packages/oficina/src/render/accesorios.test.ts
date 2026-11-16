import { describe, expect, it } from 'vitest';
import { paqueteFiestasPatrias } from '../catalogo/fiestas-patrias';
import { paqueteNavidad } from '../catalogo/navidad';
import { catalogoBase } from '../catalogo/base';
import { ACCESORIOS } from './accesorios';

const piezas = [
  {
    piezas: catalogoBase.piezas.filter((p) =>
      [
        'lentes-oscuros',
        'reloj',
        'bufanda-lana',
        'gorro-urbano',
        'audifonos-estudio',
        'mochila-urbana',
      ].includes(p.id),
    ),
  },
  paqueteNavidad,
  paqueteFiestasPatrias,
].flatMap((p) => p.piezas ?? []);

describe('mapa de accesorios', () => {
  it('toda pieza de Navidad y Fiestas Patrias tiene su dibujo registrado por id', () => {
    for (const pieza of piezas) expect(ACCESORIOS[pieza.id], pieza.id).toBeDefined();
  });

  it('no hay dibujos huérfanos: cada id registrado es una pieza de un paquete', () => {
    const ids = new Set(piezas.map((p) => p.id));
    for (const id of Object.keys(ACCESORIOS)) expect(ids.has(id), id).toBe(true);
  });

  it('el ancla concuerda con la zona de la pieza', () => {
    const porZona = { sombrero: 'cabeza', cara: 'cabeza', orejas: 'cabeza', mano: 'mano' } as const;
    for (const pieza of piezas) {
      const esperada = porZona[pieza.zona as keyof typeof porZona] ?? 'columna';
      expect(ACCESORIOS[pieza.id]?.ancla, pieza.id).toBe(esperada);
    }
  });

  it('todo sombrero se declara como tal para que el peinado deje paso', () => {
    for (const pieza of piezas.filter((p) => p.zona === 'sombrero')) {
      expect(ACCESORIOS[pieza.id]?.sombrero, pieza.id).toBe(true);
    }
  });
});
