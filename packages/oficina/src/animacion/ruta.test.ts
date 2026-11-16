import { describe, expect, it } from 'vitest';
import { plano } from '../mansion/plano';
import { crearRuta } from '../mansion/rutas';
import { alturaNav, avanzarNav, destinoNav, llegoANodo, NODO_ASIENTO, NODO_SALIDA } from './ruta';
import type { Nav, Nodo, PuntoXZ } from './ruta';

/** Una cadena real: el primer lugar de Finanzas (piso 2) hasta la barra de café. */
function cadenaReal(): Nodo[] {
  const lugar = plano.lugares.find((l) => l.ambiente === 'finanzas');
  const cafe = plano.cafe[0];
  if (!lugar || !cafe) throw new Error('sin lugar o sin café');
  return crearRuta(lugar, cafe, false);
}

/** Camina hasta la meta teletransportando al nodo al que va; devuelve los nodos visitados. */
function recorrer(nav: Nav, cadena: readonly Nodo[], meta: number, pos: PuntoXZ): number[] {
  const visitados: number[] = [];
  for (let i = 0; i < 200; i++) {
    avanzarNav(nav, cadena, meta, pos.x, pos.z, 0.03);
    const destino = destinoNav(nav, cadena);
    if (!destino || nav.hacia < 0) break;
    pos.x = destino.x;
    pos.z = destino.z;
    visitados.push(nav.hacia);
  }
  avanzarNav(nav, cadena, meta, pos.x, pos.z, 0.03);
  return visitados;
}

describe('avanzarNav con una cadena de largo variable', () => {
  const cadena = cadenaReal();
  const ultimo = cadena.length - 1;
  const asiento = cadena[NODO_ASIENTO] as Nodo;

  it('la cadena de un piso alto es más larga que la de un piso 1 (las escaleras suman nodos)', () => {
    const personal = plano.lugares.find((l) => l.ambiente === 'living');
    const cafe = plano.cafe[0];
    if (!personal || !cafe) throw new Error('sin lugar');
    expect(cadena.length).toBeGreaterThan(crearRuta(personal, cafe, false).length);
  });

  it('del asiento al café pasa por todos los nodos en orden', () => {
    const nav: Nav = { nodo: 0, hacia: -1 };
    const pos = { x: asiento.x, z: asiento.z };
    const esperado = Array.from({ length: ultimo }, (_, i) => i + 1);
    expect(recorrer(nav, cadena, ultimo, pos)).toEqual(esperado);
    const fin = cadena[ultimo] as Nodo;
    expect(llegoANodo(nav, ultimo, fin, pos.x, pos.z, 0.03)).toBe(true);
  });

  it('de vuelta al asiento recorre la cadena al revés', () => {
    const nav: Nav = { nodo: ultimo, hacia: -1 };
    const fin = cadena[ultimo] as Nodo;
    const esperado = Array.from({ length: ultimo }, (_, i) => ultimo - 1 - i);
    expect(recorrer(nav, cadena, NODO_ASIENTO, { x: fin.x, z: fin.z })).toEqual(esperado);
  });

  it('si la meta se invierte a mitad de tramo vuelve primero al último nodo', () => {
    const nav: Nav = { nodo: 2, hacia: 3 };
    avanzarNav(nav, cadena, NODO_ASIENTO, 0, 0, 0.03);
    expect(nav.hacia).toBe(2);
  });

  it('desde un punto alejado de su nodo vuelve a él antes de seguir', () => {
    const nav: Nav = { nodo: NODO_SALIDA, hacia: -1 };
    const salida = cadena[NODO_SALIDA] as Nodo;
    avanzarNav(nav, cadena, ultimo, salida.x + 0.5, salida.z, 0.03);
    expect(nav.hacia).toBe(NODO_SALIDA);
  });

  it('quieto en su meta no se mueve', () => {
    const nav: Nav = { nodo: 0, hacia: -1 };
    avanzarNav(nav, cadena, NODO_ASIENTO, asiento.x, asiento.z, 0.03);
    expect(nav).toEqual({ nodo: 0, hacia: -1 });
  });
});

describe('alturaNav', () => {
  const cadena: Nodo[] = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 3.9, z: 5 },
  ];

  it('quieto, es la altura de su nodo', () => {
    expect(alturaNav({ nodo: 1, hacia: -1 }, cadena, 4, 0)).toBe(0);
    expect(alturaNav({ nodo: 2, hacia: -1 }, cadena, 4, 5)).toBe(3.9);
  });

  it('en un tramo plano no cambia', () => {
    expect(alturaNav({ nodo: 0, hacia: 1 }, cadena, 2, 0)).toBe(0);
  });

  it('en una escalera se interpola con la distancia horizontal recorrida', () => {
    expect(alturaNav({ nodo: 1, hacia: 2 }, cadena, 4, 0)).toBeCloseTo(0, 9);
    expect(alturaNav({ nodo: 1, hacia: 2 }, cadena, 4, 2.5)).toBeCloseTo(1.95, 9);
    expect(alturaNav({ nodo: 1, hacia: 2 }, cadena, 4, 5)).toBeCloseTo(3.9, 9);
    // al bajar es el mismo tramo recorrido al revés
    expect(alturaNav({ nodo: 2, hacia: 1 }, cadena, 4, 2.5)).toBeCloseTo(1.95, 9);
  });

  it('si la persona queda atrás del nodo de origen, no baja de su altura', () => {
    expect(alturaNav({ nodo: 1, hacia: 2 }, cadena, 4, -4)).toBe(0);
  });
});
