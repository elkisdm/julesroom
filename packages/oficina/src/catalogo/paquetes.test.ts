import { describe, expect, it } from 'vitest';
import { catalogoBase } from './base';
import { paqueteFiestasPatrias } from './fiestas-patrias';
import { paqueteHalloween } from './halloween';
import { paqueteNavidad } from './navidad';
import { crearCatalogo, registrarPaquete } from './registro';
import { ZONAS } from '../tipos';
import type { PaqueteSkins } from '../tipos';
import { resolverAtuendo } from '../vestuario/resolver';
import resolverFuente from '../vestuario/resolver.ts?raw';
import registroFuente from './registro.ts?raw';

const paquetes = [paqueteHalloween, paqueteNavidad, paqueteFiestasPatrias];
const catalogo = paquetes.reduce(registrarPaquete, crearCatalogo(catalogoBase));

const NOMBRES = (p: PaqueteSkins) => (p.disfraces ?? []).map((d) => d.nombre);

describe('paquetes de skins como datos', () => {
  it('Navidad trae gorros, cuernos, bufanda, suéter y los cuatro disfraces', () => {
    const ids = paqueteNavidad.piezas?.map((p) => p.id) ?? [];
    expect(ids).toEqual(
      expect.arrayContaining(['gorro-papa-noel', 'gorro-elfo', 'cuernos-reno', 'bufanda']),
    );
    expect(paqueteNavidad.tops?.map((t) => t.id)).toContain('sueter-navideno');
    expect(NOMBRES(paqueteNavidad)).toEqual(['Papá Noel', 'Elfo', 'Reno', 'Suéter feo']);
  });

  it('Fiestas Patrias trae poncho, chamanto, chupalla, faja, bandera y los cuatro disfraces', () => {
    const ids = paqueteFiestasPatrias.piezas?.map((p) => p.id) ?? [];
    expect(ids).toEqual(
      expect.arrayContaining(['poncho', 'chamanto', 'chupalla', 'faja', 'bandera-chilena']),
    );
    expect(NOMBRES(paqueteFiestasPatrias)).toEqual([
      'Huaso',
      'Huasa',
      'Bailarín de cueca',
      'Hincha con bandera',
    ]);
  });

  it('cada pieza declara una zona válida', () => {
    for (const paquete of [paqueteNavidad, paqueteFiestasPatrias]) {
      for (const pieza of paquete.piezas ?? []) {
        expect(ZONAS, pieza.id).toContain(pieza.zona);
        for (const z of pieza.excluye ?? []) expect(ZONAS, `${pieza.id} excluye`).toContain(z);
      }
    }
  });

  it('se registran junto a Halloween sin ids duplicados', () => {
    expect(catalogo.paquetes).toEqual(['halloween', 'navidad', 'fiestas-patrias']);
    expect(catalogo.disfraces).toHaveLength(14);
  });

  it('todas las piezas se equipan con resolverAtuendo y quedan visibles', () => {
    for (const paquete of [paqueteNavidad, paqueteFiestasPatrias]) {
      for (const pieza of paquete.piezas ?? []) {
        const avisos: string[] = [];
        const r = resolverAtuendo(catalogo, { acc: [pieza.id] }, (m) => avisos.push(m));
        expect(r.acc, pieza.id).toEqual([pieza.id]);
        expect(avisos, pieza.id).toEqual([]);
      }
    }
  });

  it('cada disfraz se resuelve sin avisos y conserva sus piezas', () => {
    for (const paquete of [paqueteNavidad, paqueteFiestasPatrias]) {
      for (const disfraz of paquete.disfraces ?? []) {
        const avisos: string[] = [];
        const r = resolverAtuendo(catalogo, disfraz.atuendo, (m) => avisos.push(m));
        expect(avisos, disfraz.nombre).toEqual([]);
        expect(r.acc.length, disfraz.nombre).toBe(disfraz.atuendo.acc?.length ?? 0);
        expect(r.top).toBe(disfraz.atuendo.top);
      }
    }
  });

  it('una pieza por zona: el poncho reemplaza al chamanto', () => {
    const r = resolverAtuendo(catalogo, { acc: ['poncho', 'chamanto'] });
    expect(r.acc).toEqual(['chamanto']);
  });

  it('el poncho oculta la espalda: la capa no se ve debajo de él', () => {
    const r = resolverAtuendo(catalogo, { acc: ['capa', 'poncho'] });
    expect(r.acc).toEqual(['poncho']);
    expect(r.ocultas).toContain('espalda');
  });

  it('el motor (resolver y registro) no menciona ids de ningún paquete', () => {
    const fuentes = [resolverFuente, registroFuente];
    const ids = new Set<string>();
    for (const p of paquetes) {
      ids.add(p.id);
      for (const lista of [p.piezas, p.caras, p.tops, p.disfraces]) {
        for (const { id } of lista ?? []) ids.add(id);
      }
    }
    for (const fuente of fuentes) {
      expect(fuente.length).toBeGreaterThan(100);
      for (const id of ids) {
        expect(fuente, `id "${id}"`).not.toMatch(new RegExp(`['"\`]${id}['"\`]`));
      }
    }
  });
});
