import { describe, expect, it } from 'vitest';
import { crearMapaDeCajas, lineaLibre } from '../animacion/colision';
import { NODO_ASIENTO, NODO_PASILLO, NODO_SALIDA, NODO_VISITA } from '../animacion/ruta';
import { crearEscenarioPrueba } from './prueba';
import { crearRutasPlanta } from './rutasPlanta';
import type { Planta } from './tipos';

const escenario = crearEscenarioPrueba();
const planta = escenario.planta;
const rutas = crearRutasPlanta(planta);
const lugarA = planta.lugares[0]!;
const lugarB = planta.lugares[2]!;
const cafe = { x: 12, z: 9 };

describe('crearRutasPlanta', () => {
  it('la cadena empieza por lugar, salida y pasillo, y repite el pasillo para las visitas', () => {
    const n = rutas.crearRuta(lugarA, { x: 3, z: 9 }, false);
    expect(n[NODO_ASIENTO]).toEqual({ x: lugarA.x, y: 0, z: lugarA.z });
    expect(n[NODO_SALIDA]).toEqual({ x: lugarA.salida.x, y: 0, z: lugarA.salida.z });
    expect(n[NODO_PASILLO]).toEqual({ x: lugarA.salida.x, y: 0, z: 4.5 });
    expect(n[NODO_VISITA - 1]).toEqual(n[NODO_PASILLO]);
    expect(n[NODO_VISITA]).toEqual(n[NODO_PASILLO]);
  });

  it('termina siempre en la pausa', () => {
    for (const l of planta.lugares) {
      const n = rutas.crearRuta(l, cafe, false);
      expect(n.at(-1)).toEqual({ x: cafe.x, y: 0, z: cafe.z });
    }
  });

  it('con la pausa en otro ambiente y sin vanos, sigue por el pasillo y baja a lo largo de z', () => {
    const n = rutas.crearRuta(lugarA, cafe, false);
    expect(n.slice(NODO_VISITA + 1)).toEqual([
      { x: cafe.x, y: 0, z: 4.5 },
      { x: cafe.x, y: 0, z: 8 },
      { x: cafe.x, y: 0, z: 9 },
    ]);
  });

  it('con la pausa en el mismo ambiente no sale de su pasillo', () => {
    const n = rutas.crearRuta(lugarA, { x: 6, z: 5.5 }, false);
    expect(n.slice(NODO_VISITA + 1)).toEqual([
      { x: 6, y: 0, z: 4.5 },
      { x: 6, y: 0, z: 5.5 },
    ]);
  });

  it('con un vano entre ambientes pasa por él, por un carril separado del muro', () => {
    const conVano: Planta = {
      ...planta,
      vanos: [{ id: 'v', nivel: 'piso1', pos: 8, centro: 3, ancho: 1.2, entre: ['a', 'b'] }],
    };
    const n = crearRutasPlanta(conVano).crearRuta(lugarA, { x: 12, z: 5.5 }, false);
    const enElVano = n.findIndex((p) => p.x === 8 && p.z === 3);
    expect(enElVano).toBeGreaterThan(NODO_VISITA);
    expect(n[enElVano - 1]).toEqual({ x: 7.3, y: 0, z: 3 });
    expect(n[enElVano + 1]).toEqual({ x: 8.7, y: 0, z: 3 });
    expect(n.at(-1)).toEqual({ x: 12, y: 0, z: 5.5 });
  });

  it('aLaLuz: va por el pasillo al x de la luz y de ahí a ella', () => {
    const n = rutas.crearRuta(lugarA, { x: 7, z: 5 }, true);
    expect(n.slice(NODO_VISITA + 1)).toEqual([
      { x: 7, y: 0, z: 4.5 },
      { x: 7, y: 0, z: 5 },
    ]);
  });

  it('ningún tramo de la ruta cruza un mueble (colisión del escenario)', () => {
    const { cajas, limites } = escenario.colision(0);
    const mapa = crearMapaDeCajas(cajas, limites);
    for (const l of planta.lugares) {
      const n = rutas.crearRuta(l, cafe, false);
      for (let i = NODO_SALIDA; i + 1 < n.length; i++) {
        const a = n[i]!;
        const b = n[i + 1]!;
        expect(lineaLibre(mapa, a.x, a.z, b.x, b.z, 0.2)).toBe(true);
      }
    }
  });

  it('escribirVisita apunta los nodos de visita al colega y quitarVisita los devuelve al pasillo', () => {
    const n = rutas.crearRuta(lugarA, cafe, false);
    const largo = n.length;
    rutas.escribirVisita(n, lugarB);
    expect(n[NODO_VISITA - 1]).toEqual({ x: lugarB.salida.x, y: 0, z: 4.5 });
    expect(n[NODO_VISITA]).toEqual({ x: lugarB.salida.x, y: 0, z: lugarB.salida.z });
    rutas.quitarVisita(n);
    expect(n[NODO_VISITA - 1]).toEqual(n[NODO_PASILLO]);
    expect(n[NODO_VISITA]).toEqual(n[NODO_PASILLO]);
    expect(n).toHaveLength(largo);
  });
});
