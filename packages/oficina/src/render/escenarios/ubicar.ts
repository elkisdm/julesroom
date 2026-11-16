/**
 * El dibujo del mobiliario sale de `planta.muebles` (puro, sin React). Cada dibujo de escenario arma sus
 * piezas como en la plantilla (sus componentes de siempre) y las pasa por un `Ubicador`: cada ítem es del
 * mueble de la plantilla que lo contiene en planta (el más chico; con `margen`, el más cercano), y va a
 * donde ese mueble está ahora en `planta.muebles` (trasladado y girado con él), o desaparece si el mueble
 * se quitó. Lo que no está sobre ningún mueble (arquitectura, alfombras) queda igual.
 *
 * Con los muebles en su sitio, el ubicador devuelve las MISMAS listas: el dibujo de la plantilla queda
 * idéntico, sin un solo número recalculado. Lo colgado del techo (lámparas) no se pasa por aquí: queda fijo.
 */
import { Euler, Quaternion, Vector3 } from 'three';
import { cajaDe } from '../../mansion/plano';
import type { Caja, Mueble } from '../../mansion/plano';
import { girarEnPlanta } from '../../escenarios/personalizacion';
import type { Item } from './trading/Instancias';

export interface OpcionesUbicar {
  /** Hasta cuántos metros fuera de la huella de un mueble se le asigna un ítem (hojas que asoman). */
  margen?: number;
}

/** Traslado de un `<group>` cuyos hijos están en coordenadas de la plantilla. */
export type GrupoMueble = { x: number; z: number; giro: number };

export interface Ubicador {
  <T extends Item>(items: readonly T[], opciones?: OpcionesUbicar): readonly T[];
  /** Lo mismo para cajas en planta (superficies donde cae la luz, por ejemplo). */
  cajas<T extends Caja>(cajas: readonly T[]): readonly T[];
  /**
   * Dónde poner el grupo de un mueble dibujado con mallas (no ítems) cuyo centro es (x, z).
   * `null` si no se movió; `'quitado'` si hay que ocultarlo.
   */
  grupo(x: number, z: number): GrupoMueble | 'quitado' | null;
}

/** Cuántos cuartos de vuelta (0..3) es `giro`, o `null` si no es un múltiplo de 90°. */
function cuartos(giro: number): number | null {
  const k = giro / (Math.PI / 2);
  const n = Math.round(k);
  return Math.abs(k - n) < 1e-6 ? ((n % 4) + 4) % 4 : null;
}

const EJE_Y = new Vector3(0, 1, 0);
const qGiro = new Quaternion();
const qItem = new Quaternion();
const euler = new Euler();

/** La rotación y la escala del ítem girado `d` rad en y alrededor del mundo (las cuatro claves, siempre). */
function rotar(it: Item, d: number): Pick<Item, 'e' | 'r' | 'rx' | 'rz'> {
  const q = cuartos(d);
  const r = it.r ?? 0;
  const rx = it.rx ?? 0;
  const rz = it.rz ?? 0;
  if (q === 0) return { e: it.e, r: it.r, rx: it.rx, rz: it.rz };
  if (q !== null && r === 0 && rz === 0) {
    // Una caja sin giro propio girada un cuarto de vuelta es la misma caja con ancho y fondo cruzados; su
    // inclinación en x pasa a ser una en z (Ry(±π/2)·Rx(a) = Rz(∓a)·Ry(±π/2)). Media vuelta: Rx(−a).
    if (q === 2) return { e: it.e, r: undefined, rx: rx ? -rx : undefined, rz: undefined };
    const e = it.e ? ([it.e[2], it.e[1], it.e[0]] as Item['e']) : undefined;
    return { e, r: undefined, rx: undefined, rz: rx ? (q === 1 ? -rx : rx) : undefined };
  }
  if (rx === 0 && rz === 0) return { e: it.e, r: r + d, rx: undefined, rz: undefined };
  qGiro.setFromAxisAngle(EJE_Y, d);
  qItem.setFromEuler(euler.set(rx, r, rz, 'XYZ'));
  euler.setFromQuaternion(qGiro.multiply(qItem), 'XYZ');
  return { e: it.e, rx: euler.x, r: euler.y, rz: euler.z };
}

function distancia(c: Caja, x: number, z: number): number {
  const dx = Math.max(c.x0 - x, 0, x - c.x1);
  const dz = Math.max(c.z0 - z, 0, z - c.z1);
  return Math.hypot(dx, dz);
}

const enSuSitio = (a: Mueble, b: Mueble) => a.x === b.x && a.z === b.z && a.giro === b.giro;

/**
 * Lleva el dibujo armado con los muebles de `plantilla` a los muebles `actuales` (los de
 * `escenario.planta.muebles`, con los ajustes del dueño).
 */
export function crearUbicador(plantilla: readonly Mueble[], actuales: readonly Mueble[]): Ubicador {
  const porId = new Map(actuales.map((m) => [m.id, m]));
  const cambiados = plantilla.some((m) => {
    const a = porId.get(m.id);
    return !a || !enSuSitio(m, a);
  });
  if (plantilla === actuales || !cambiados) {
    const igual = (<T>(lista: readonly T[]) => lista) as Ubicador;
    igual.cajas = (c) => c;
    igual.grupo = () => null;
    return igual;
  }
  const cajas = plantilla.map(cajaDe);
  const areas = cajas.map((c) => (c.x1 - c.x0) * (c.z1 - c.z0));

  /** Índice del mueble de la plantilla dueño del punto, o −1. */
  const duenoDe = (x: number, z: number, margen: number): number => {
    let mejor = -1;
    let mejorArea = Infinity;
    let cercano = -1;
    let cercania = Infinity;
    for (let i = 0; i < cajas.length; i++) {
      const d = distancia(cajas[i]!, x, z);
      if (d === 0) {
        if (areas[i]! < mejorArea) {
          mejor = i;
          mejorArea = areas[i]!;
        }
      } else if (d <= margen && d < cercania) {
        cercano = i;
        cercania = d;
      }
    }
    return mejor >= 0 ? mejor : cercano;
  };

  /** Dónde va el punto (x, z) del dueño `i`: `null` si se quitó; el mismo arreglo si no se movió. */
  const destino = (i: number): { antes: Mueble; ahora: Mueble } | null | 'igual' => {
    const antes = plantilla[i]!;
    const ahora = porId.get(antes.id);
    if (!ahora) return null;
    return enSuSitio(antes, ahora) ? 'igual' : { antes, ahora };
  };

  const ubicar = (<T extends Item>(
    items: readonly T[],
    opciones: OpcionesUbicar = {},
  ): readonly T[] => {
    const margen = opciones.margen ?? 0;
    let cambio = false;
    const salida: T[] = [];
    for (const it of items) {
      const i = duenoDe(it.p[0], it.p[2], margen);
      const d = i < 0 ? 'igual' : destino(i);
      if (d === 'igual') {
        salida.push(it);
        continue;
      }
      cambio = true;
      if (d === null) continue;
      const giro = d.ahora.giro - d.antes.giro;
      const [dx, dz] = girarEnPlanta(it.p[0] - d.antes.x, it.p[2] - d.antes.z, giro);
      salida.push({ ...it, p: [d.ahora.x + dx, it.p[1], d.ahora.z + dz], ...rotar(it, giro) });
    }
    return cambio ? salida : items;
  }) as Ubicador;

  ubicar.cajas = <T extends Caja>(lista: readonly T[]): readonly T[] => {
    let cambio = false;
    const salida: T[] = [];
    for (const c of lista) {
      const i = duenoDe((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, 0);
      const d = i < 0 ? 'igual' : destino(i);
      if (d === 'igual') {
        salida.push(c);
        continue;
      }
      cambio = true;
      if (d === null) continue;
      const giro = d.ahora.giro - d.antes.giro;
      const [cx, cz] = girarEnPlanta(
        (c.x0 + c.x1) / 2 - d.antes.x,
        (c.z0 + c.z1) / 2 - d.antes.z,
        giro,
      );
      const cruza = cuartos(giro) === 1 || cuartos(giro) === 3;
      const hx = (cruza ? c.z1 - c.z0 : c.x1 - c.x0) / 2;
      const hz = (cruza ? c.x1 - c.x0 : c.z1 - c.z0) / 2;
      const x = d.ahora.x + cx;
      const z = d.ahora.z + cz;
      salida.push({ ...c, x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });
    }
    return cambio ? salida : lista;
  };
  ubicar.grupo = (x, z) => {
    const i = duenoDe(x, z, 0);
    if (i < 0) return null;
    const d = destino(i);
    if (d === 'igual') return null;
    if (d === null) return 'quitado';
    return colocacion(d.antes, d.ahora);
  };
  return ubicar;
}

/**
 * Para lo que se dibuja como un grupo de mallas (no ítems): la posición y el giro del `<group>` que lleva lo
 * armado en el sitio de `antes` a donde está `ahora`, o `null` si no se movió.
 */
export function colocacion(
  antes: Mueble,
  ahora: Mueble,
): { x: number; z: number; giro: number } | null {
  if (enSuSitio(antes, ahora)) return null;
  const giro = ahora.giro - antes.giro;
  const [x, z] = girarEnPlanta(antes.x, antes.z, giro);
  return { x: ahora.x - x, z: ahora.z - z, giro };
}
