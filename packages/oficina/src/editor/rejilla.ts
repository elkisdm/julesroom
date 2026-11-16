import type { Caja } from '../escenarios/tipos';
import { tipoObjeto } from './catalogo';

/** Cuartos de vuelta. */
export type Giro = 0 | 1 | 2 | 3;

/** Redondea `v` al múltiplo de `paso` más cercano (nunca -0). */
export function ajustar(v: number, paso: number): number {
  return Math.round(v / paso) * paso + 0;
}

export function girar(g: Giro, sentido: 1 | -1): Giro {
  return ((g + sentido + 4) % 4) as Giro;
}

export const radianes = (g: Giro): number => (g * Math.PI) / 2;

/** Caja que ocupa un objeto en el suelo; ancho y fondo se intercambian en giros impares. */
export function huella(o: { tipo: string; x: number; z: number; giro: Giro }): Caja {
  const t = tipoObjeto(o.tipo);
  if (!t) throw new Error(`Tipo de objeto desconocido: ${o.tipo}`);
  const [a, f] = o.giro % 2 === 1 ? [t.fondo, t.ancho] : [t.ancho, t.fondo];
  return { x0: o.x - a / 2, x1: o.x + a / 2, z0: o.z - f / 2, z1: o.z + f / 2 };
}
