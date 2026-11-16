import { LIMITES, type Pizarra } from './modelo';
export interface Historia {
  laminas: Pizarra[];
  indice: number;
}
export const vacia = (): Historia => ({ laminas: [], indice: -1 });
export function agregar(h: Historia, p: Pizarra): Historia {
  const laminas = [...h.laminas.slice(0, h.indice + 1), p].slice(-LIMITES.historia);
  return { laminas, indice: laminas.length - 1 };
}
export function mover(h: Historia, delta: number): Historia {
  return { ...h, indice: Math.max(0, Math.min(h.laminas.length - 1, h.indice + delta)) };
}
