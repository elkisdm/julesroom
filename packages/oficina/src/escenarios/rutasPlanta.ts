/**
 * Rutas genéricas de UN nivel: la cadena de nodos que recorre cada persona, con el mismo formato
 * que `mansion/rutas.ts` (lo que `animacion/ruta.ts` espera):
 *
 *   0 lugar → 1 salida libre del mueble → 2 pasillo del ambiente → 3 y 4 el mismo pasillo (los
 *   reescribe `escribirVisita`) → … hasta el x de la pausa → la pausa.
 *
 * Supuesto: si la pausa está en otro ambiente, se sale por el vano que los une (por un carril
 * separado del muro) y se sigue por el pasillo del ambiente de la pausa. Si no hay vano entre
 * ambos, se va por el pasillo propio hasta el x de la pausa y se baja o sube en z hasta el
 * pasillo del otro ambiente: el escenario debe dejar libre ese corredor.
 */
import type { Nodo } from '../animacion/ruta';
import { NODO_VISITA } from '../animacion/ruta';
import { quitarVisita } from '../mansion/rutas';
import type { Ambiente, Lugar, PuntoXZ } from '../mansion/plano';
import type { Planta, Rutas } from './tipos';

/** Cuánto se separa del muro del vano el carril por el que se cruza. */
const CARRIL_DE_PARED = 0.7;

/** Rutas de una planta de un solo nivel. */
export function crearRutasPlanta(planta: Planta): Rutas {
  const ambienteDe = (id: string): Ambiente => {
    const a = planta.ambientes.find((u) => u.id === id);
    if (!a) throw new Error(`Ambiente desconocido: ${id}`);
    return a;
  };
  const ambienteEn = (p: PuntoXZ): Ambiente | undefined =>
    planta.ambientes.find((a) => p.x >= a.x0 && p.x <= a.x1 && p.z >= a.z0 && p.z <= a.z1);

  return {
    crearRuta(lugar: Lugar, pausa: PuntoXZ, aLaLuz: boolean): Nodo[] {
      const a = ambienteDe(lugar.ambiente);
      const y = lugar.y;
      const nodos: Nodo[] = [
        { x: lugar.x, y, z: lugar.z },
        { x: lugar.salida.x, y, z: lugar.salida.z },
        { x: lugar.salida.x, y, z: a.pasilloZ },
        { x: lugar.salida.x, y, z: a.pasilloZ },
        { x: lugar.salida.x, y, z: a.pasilloZ },
      ];
      const poner = (x: number, z: number): void => {
        const ultimo = nodos[nodos.length - 1];
        if (ultimo && ultimo.x === x && ultimo.z === z) return;
        nodos.push({ x, y, z });
      };
      const destino = aLaLuz ? a : (ambienteEn(pausa) ?? a);
      if (destino.id !== a.id) {
        const vano = planta.vanos.find(
          (v) => v.entre.includes(a.id) && v.entre.includes(destino.id),
        );
        if (vano) {
          const sentido = Math.sign(destino.x0 + destino.x1 - (a.x0 + a.x1)) || 1;
          poner(vano.pos - sentido * CARRIL_DE_PARED, a.pasilloZ);
          poner(vano.pos - sentido * CARRIL_DE_PARED, vano.centro);
          poner(vano.pos, vano.centro);
          poner(vano.pos + sentido * CARRIL_DE_PARED, vano.centro);
          poner(vano.pos + sentido * CARRIL_DE_PARED, destino.pasilloZ);
        } else {
          poner(pausa.x, a.pasilloZ);
          poner(pausa.x, destino.pasilloZ);
        }
      }
      poner(pausa.x, destino.pasilloZ);
      poner(pausa.x, pausa.z);
      return nodos;
    },

    escribirVisita(nodos: Nodo[], colega: Lugar): void {
      const a = nodos[NODO_VISITA - 1];
      const b = nodos[NODO_VISITA];
      if (!a || !b) return;
      a.x = colega.salida.x;
      a.y = colega.y;
      a.z = ambienteDe(colega.ambiente).pasilloZ;
      b.x = colega.salida.x;
      b.y = colega.y;
      b.z = colega.salida.z;
    },

    quitarVisita,
  };
}
