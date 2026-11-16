import { describe, expect, it, vi } from 'vitest';
import { catalogoBase } from '../catalogo/base';
import { paqueteHalloween } from '../catalogo/halloween';
import { crearCatalogo, registrarPaquete } from '../catalogo/registro';
import type { Atuendo, PaqueteSkins, Zona } from '../tipos';
import { alternarPieza, aplicarSkin, resolverAtuendo } from './resolver';

const catalogo = registrarPaquete(crearCatalogo(catalogoBase), paqueteHalloween);

const atuendoBase: Atuendo = {
  skin: '#f3d4b8',
  face: 'feliz',
  hair: 'corto',
  hairColor: '#1f1611',
  top: 'polera',
  topColor: '#5b7fd6',
  print: '',
  bottom: 'pantalon',
  bottomColor: '#2f3a4f',
  shoes: '#151719',
  acc: [],
};

describe('alternarPieza', () => {
  it('gorra -> sombrero de bruja reemplaza (misma zona)', () => {
    const conGorra = alternarPieza(catalogo, atuendoBase, 'gorra');
    expect(conGorra.acc).toEqual(['gorra']);
    const conBruja = alternarPieza(catalogo, conGorra, 'sombrero-bruja');
    expect(conBruja.acc).toEqual(['sombrero-bruja']);
  });

  it('alternar una pieza equipada la quita', () => {
    const con = alternarPieza(catalogo, atuendoBase, 'lentes');
    expect(alternarPieza(catalogo, con, 'lentes').acc).toEqual([]);
  });

  it('un id desconocido lanza', () => {
    expect(() => alternarPieza(catalogo, atuendoBase, 'no-existe')).toThrow(/no-existe/);
  });

  it('piezas de zonas distintas coexisten', () => {
    let a = alternarPieza(catalogo, atuendoBase, 'lentes');
    a = alternarPieza(catalogo, a, 'gorra');
    a = alternarPieza(catalogo, a, 'mochila');
    expect(a.acc.sort()).toEqual(['gorra', 'lentes', 'mochila']);
  });
});

describe('resolverAtuendo', () => {
  it('invariante: una pieza por zona aunque el atuendo guardado traiga dos', () => {
    const r = resolverAtuendo(catalogo, { ...atuendoBase, acc: ['gorra', 'gorro', 'lentes'] });
    const zonas = r.acc.map((id) => catalogo.piezas.find((p) => p.id === id)?.zona);
    expect(new Set(zonas).size).toBe(zonas.length);
    expect(r.acc).toEqual(['gorro', 'lentes']);
  });

  it('calabaza oculta pelo, cara y lentes; al quitarla vuelven', () => {
    const base = alternarPieza(catalogo, atuendoBase, 'lentes');
    const conCalabaza = alternarPieza(catalogo, base, 'calabaza');
    const oculto = resolverAtuendo(catalogo, conCalabaza);
    expect(oculto.ocultas).toEqual(expect.arrayContaining(['pelo', 'expresion', 'cara']));
    expect(oculto.acc).toEqual(['calabaza']);

    const sinCalabaza = alternarPieza(catalogo, conCalabaza, 'calabaza');
    const visible = resolverAtuendo(catalogo, sinCalabaza);
    expect(visible.ocultas).toEqual([]);
    expect(visible.acc).toEqual(['lentes']);
    expect(visible.hair).toBe('corto');
  });

  it('la exclusión es determinista sin importar el orden de acc', () => {
    const a = resolverAtuendo(catalogo, { ...atuendoBase, acc: ['lentes', 'calabaza'] });
    const b = resolverAtuendo(catalogo, { ...atuendoBase, acc: ['calabaza', 'lentes'] });
    expect(a.acc).toEqual(b.acc);
    expect(a.ocultas).toEqual(b.ocultas);
  });

  it('la misma regla vale al aplicar un skin y al alternar (simetría)', () => {
    const porSkin = resolverAtuendo(
      catalogo,
      aplicarSkin(catalogo, { ...atuendoBase, acc: ['lentes'] }, { acc: ['calabaza', 'lentes'] }),
    );
    expect(porSkin.acc).toEqual(['calabaza']);
  });

  it('un paquete falso con capa-roja se equipa sin tocar el motor', () => {
    const falso: PaqueteSkins = {
      id: 'falso',
      nombre: 'Falso',
      piezas: [{ id: 'capa-roja', nombre: 'Capa roja', zona: 'espalda' }],
    };
    const cat = registrarPaquete(catalogo, falso);
    const r = resolverAtuendo(cat, alternarPieza(cat, atuendoBase, 'capa-roja'));
    expect(r.acc).toEqual(['capa-roja']);
  });

  it('descarta piezas de zona desconocida o id desconocido avisando por onAviso', () => {
    const malo: PaqueteSkins = {
      id: 'malo',
      nombre: 'Malo',
      piezas: [{ id: 'tobillera', nombre: 'Tobillera', zona: 'tobillo' as Zona }],
    };
    const cat = registrarPaquete(catalogo, malo);
    const onAviso = vi.fn();
    const r = resolverAtuendo(
      cat,
      { ...atuendoBase, acc: ['tobillera', 'fantasma', 'lentes'] },
      onAviso,
    );
    expect(r.acc).toEqual(['lentes']);
    expect(onAviso).toHaveBeenCalledTimes(2);
    expect(
      onAviso.mock.calls.map(
        (c) => String(c[0]).includes('tobillera') || String(c[0]).includes('fantasma'),
      ),
    ).toEqual([true, true]);
  });

  it('resuelve sin lanzar un atuendo guardado por el prototipo con campos extra y faltantes', () => {
    const guardado = {
      skin: '#c98a5b',
      face: 'sonrisa',
      hair: 'rizos',
      top: 'camisa',
      acc: ['gorra', 'taza'],
      campoViejo: 123,
      anidado: { x: 1 },
    };
    const r = resolverAtuendo(catalogo, guardado);
    expect(r.skin).toBe('#c98a5b');
    expect(r.hairColor).toBe(catalogo.coloresPelo[0]);
    expect(r.bottom).toBe('pantalon');
    expect(r.acc).toEqual(['gorra', 'taza']);
    expect(r).not.toHaveProperty('campoViejo');
  });

  it('tolera basura: null, acc que no es arreglo y elementos no string', () => {
    expect(() => resolverAtuendo(catalogo, null)).not.toThrow();
    expect(resolverAtuendo(catalogo, { acc: 'gorra' }).acc).toEqual([]);
    expect(resolverAtuendo(catalogo, { acc: [1, null, 'lentes'] }).acc).toEqual(['lentes']);
  });

  it('un peinado o cara desconocidos caen al valor por defecto avisando', () => {
    const onAviso = vi.fn();
    const r = resolverAtuendo(catalogo, { hair: 'mohicano', face: 'alien' }, onAviso);
    expect(r.hair).toBe(catalogo.peinados[0]?.id);
    expect(r.face).toBe(catalogo.caras[0]?.id);
    expect(onAviso).toHaveBeenCalledTimes(2);
  });
});

describe('aplicarSkin', () => {
  it('aplica un disfraz parcial sobre el atuendo', () => {
    const bruja = paqueteHalloween.disfraces?.find((d) => d.id === 'bruja');
    const r = aplicarSkin(
      catalogo,
      { ...atuendoBase, acc: ['gorra', 'lentes'] },
      bruja?.atuendo ?? {},
    );
    expect(r.hair).toBe('largo');
    expect(r.acc).toEqual(['sombrero-bruja']);
    expect(r.skin).toBe(atuendoBase.skin);
  });
});
