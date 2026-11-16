/**
 * Programas de mando para la página de afinación: la misma secuencia de órdenes cada vez, para
 * comparar «antes» y «ahora» y grabar con reloj fijo. Cada programa es una función pura del tiempo
 * (s) que escribe en una `Orden`; los que se repiten tienen `duracion`.
 */

export interface Orden {
  /** Dirección deseada en el plano (no hace falta normalizarla). */
  dirX: number;
  dirZ: number;
  /** 0..1: fracción de la velocidad máxima; 0 = frenar. */
  magnitud: number;
  correr: boolean;
  /** Se pide un salto en este instante (flanco: solo el cuadro en que empieza). */
  saltar: boolean;
}

export const crearOrden = (): Orden => ({
  dirX: 0,
  dirZ: 1,
  magnitud: 0,
  correr: false,
  saltar: false,
});

interface Tramo {
  /** Hasta qué segundo dura (los tramos van en orden). */
  hasta: number;
  dir?: [number, number];
  magnitud: number;
  correr?: boolean;
  /** Segundos (dentro del programa) en que salta. */
  saltos?: number[];
}

export interface Programa {
  nombre: string;
  titulo: string;
  duracion: number;
  tramos: Tramo[];
}

const ADELANTE: [number, number] = [0, 1];
const ATRAS: [number, number] = [0, -1];

export const PROGRAMAS: Programa[] = [
  {
    nombre: 'caminar',
    titulo: 'Caminar',
    duracion: 6,
    tramos: [
      { hasta: 0.4, magnitud: 0 },
      { hasta: 6, magnitud: 1, dir: ADELANTE },
    ],
  },
  {
    nombre: 'correr',
    titulo: 'Correr',
    duracion: 6,
    tramos: [
      { hasta: 0.4, magnitud: 0 },
      { hasta: 6, magnitud: 1, dir: ADELANTE, correr: true },
    ],
  },
  {
    nombre: 'arrancar-frenar',
    titulo: 'Arrancar y frenar',
    duracion: 8,
    tramos: [
      { hasta: 0.5, magnitud: 0 },
      { hasta: 2, magnitud: 1, dir: ADELANTE },
      { hasta: 3, magnitud: 0 },
      { hasta: 4.6, magnitud: 1, dir: ADELANTE, correr: true },
      { hasta: 5.6, magnitud: 0 },
      { hasta: 6.2, magnitud: 1, dir: ADELANTE },
      { hasta: 6.6, magnitud: 1, dir: ADELANTE, correr: true },
      { hasta: 8, magnitud: 0 },
    ],
  },
  {
    nombre: 'giros',
    titulo: 'Giros',
    duracion: 8,
    tramos: [
      { hasta: 0.4, magnitud: 0 },
      { hasta: 1.8, magnitud: 1, dir: ADELANTE },
      { hasta: 2.8, magnitud: 1, dir: [1, 0] },
      { hasta: 3.8, magnitud: 1, dir: ADELANTE },
      { hasta: 5, magnitud: 1, dir: ATRAS },
      { hasta: 6.4, magnitud: 1, dir: ATRAS, correr: true },
      { hasta: 7.2, magnitud: 1, dir: ADELANTE, correr: true },
      { hasta: 8, magnitud: 0 },
    ],
  },
  {
    nombre: 'saltar',
    titulo: 'Saltar',
    duracion: 8,
    tramos: [
      { hasta: 1.2, magnitud: 0, saltos: [0.4] },
      { hasta: 4, magnitud: 1, dir: ADELANTE, saltos: [2.2] },
      { hasta: 6.6, magnitud: 1, dir: ADELANTE, correr: true, saltos: [5.2] },
      { hasta: 8, magnitud: 0 },
    ],
  },
  {
    nombre: 'paseo',
    titulo: 'Paseo (todo)',
    duracion: 16,
    tramos: [
      { hasta: 0.6, magnitud: 0 },
      { hasta: 3, magnitud: 1, dir: ADELANTE },
      { hasta: 5.5, magnitud: 1, dir: ADELANTE, correr: true, saltos: [4.4] },
      { hasta: 6.3, magnitud: 0 },
      { hasta: 8.5, magnitud: 1, dir: [1, -1] },
      { hasta: 10.5, magnitud: 1, dir: ATRAS, correr: true },
      { hasta: 11.3, magnitud: 0, saltos: [11] },
      { hasta: 13, magnitud: 0.35, dir: ADELANTE },
      { hasta: 14.5, magnitud: 1, dir: [-1, 0] },
      { hasta: 16, magnitud: 0 },
    ],
  },
];

export const programaPorNombre = (nombre: string) =>
  PROGRAMAS.find((p) => p.nombre === nombre) ?? (PROGRAMAS[0] as Programa);

/**
 * Orden del programa en el instante `t` (s, se repite cada `duracion`). `tAnterior` es el instante
 * del cuadro previo: un salto cuenta si su segundo cae en (tAnterior, t]. Escribe en `orden`.
 */
export function ordenEn(p: Programa, t: number, tAnterior: number, orden: Orden): Orden {
  const tp = ((t % p.duracion) + p.duracion) % p.duracion;
  const ta = tAnterior < 0 ? -1 : ((tAnterior % p.duracion) + p.duracion) % p.duracion;
  const tramo = p.tramos.find((x) => tp < x.hasta) ?? (p.tramos[p.tramos.length - 1] as Tramo);
  orden.magnitud = tramo.magnitud;
  orden.correr = tramo.correr === true;
  if (tramo.dir) {
    orden.dirX = tramo.dir[0];
    orden.dirZ = tramo.dir[1];
  }
  orden.saltar = false;
  for (const x of p.tramos) {
    for (const s of x.saltos ?? []) {
      // Con la vuelta del programa (ta > tp) el intervalo se parte en dos.
      if (ta <= tp ? s > ta && s <= tp : s > ta || s <= tp) orden.saltar = true;
    }
  }
  return orden;
}
