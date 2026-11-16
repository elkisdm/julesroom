import { alternarPieza, catalogoBase as c } from '@oficina/motor';
import type { Atuendo, VistaOficina } from '@oficina/motor';

type Campo = Exclude<keyof Atuendo, 'print'>;
export interface Categoria {
  id: Campo;
  nombre: string;
  opciones: { id: string; nombre: string }[];
  color?: boolean;
  busto?: boolean;
}
const colores = (valores: string[]) => valores.map((id, i) => ({ id, nombre: `Tono ${i + 1}` }));
export const categorias: Categoria[] = [
  { id: 'top', nombre: 'Ropa', opciones: c.tops.filter((t) => t.id !== 'fundador') },
  { id: 'face', nombre: 'Cara', opciones: c.caras, busto: true },
  { id: 'hair', nombre: 'Pelo', opciones: c.peinados, busto: true },
  { id: 'bottom', nombre: 'Abajo', opciones: c.bottoms },
  { id: 'skin', nombre: 'Piel', opciones: colores(c.pieles), color: true },
  {
    id: 'hairColor',
    nombre: 'Color de pelo',
    opciones: colores(c.coloresPelo),
    color: true,
    busto: true,
  },
  { id: 'topColor', nombre: 'Color de ropa', opciones: colores(c.coloresTop), color: true },
  { id: 'bottomColor', nombre: 'Color de abajo', opciones: colores(c.coloresBottom), color: true },
  { id: 'shoes', nombre: 'Zapatos', opciones: colores(c.coloresZapatos), color: true },
  { id: 'acc', nombre: 'Extras', opciones: [{ id: '', nombre: 'Sin extras' }, ...c.piezas] },
];
export interface Historial {
  actual: Atuendo;
  anterior: Atuendo | null;
}
const iguales = (a: Atuendo, b: Atuendo) => JSON.stringify(a) === JSON.stringify(b);
export function cambiar(h: Historial, actual: Atuendo): Historial {
  return iguales(h.actual, actual) ? h : { actual, anterior: structuredClone(h.actual) };
}
export function deshacer(h: Historial): Historial {
  return h.anterior ? { actual: h.anterior, anterior: null } : h;
}
export function seleccionar(a: Atuendo, categoria: Categoria, id: string): Atuendo {
  return categoria.id === 'acc'
    ? id
      ? alternarPieza({ ...c, paquetes: [] }, a, id)
      : { ...a, acc: [] }
    : { ...a, [categoria.id]: id };
}
/** LCG determinista; la corrección final garantiza una diferencia incluso al repetir semilla. */
export function sorprender(actual: Atuendo, semilla: number): Atuendo {
  let s = semilla >>> 0;
  let nuevo = { ...actual, acc: [...actual.acc] };
  for (const cat of categorias) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const opcion = cat.opciones[s % cat.opciones.length]!;
    if (cat.id !== 'acc') nuevo = seleccionar(nuevo, cat, opcion.id);
  }
  if (iguales(nuevo, actual)) {
    nuevo.face = c.caras[(c.caras.findIndex((x) => x.id === actual.face) + 1) % c.caras.length]!.id;
  }
  return nuevo;
}
export interface Cursor {
  categoria: number;
  opcion: number;
}
const vuelta = (i: number, n: number) => (i + n) % n;
export function navegar(cursor: Cursor, tecla: string): Cursor {
  const { categoria, opcion } = cursor;
  if (tecla === 'ArrowUp' || tecla === 'ArrowDown')
    return {
      categoria: vuelta(categoria + (tecla === 'ArrowDown' ? 1 : -1), categorias.length),
      opcion: 0,
    };
  return {
    categoria,
    opcion: vuelta(
      opcion + (tecla === 'ArrowRight' ? 1 : -1),
      categorias[categoria]!.opciones.length,
    ),
  };
}
/** Nombre y Tú comparten la escena del vestidor (avatar de frente, fondo sin ocupantes, sin deriva). */
export function conVestidor(paso: string): boolean {
  return paso === 'nombre' || paso === 'personaje';
}
/** Conserva la selección anterior en todos los pasos salvo el vestidor, que controla su cámara. */
export function vistaPorPaso(paso: string, construyendo: boolean, mesa?: string): VistaOficina {
  return paso === 'dentro' && !construyendo
    ? 'seguir'
    : paso === 'agentes' && mesa
      ? { zona: mesa }
      : 'general';
}
