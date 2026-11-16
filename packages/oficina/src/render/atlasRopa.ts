import { TOPS_NUEVOS } from '../catalogo/colecciones';
import type { DatosTorso } from './caras';
/** Mismos 2.228.224 píxeles que antes; 512 muestras de 64×68, dibujos originales escalados a la mitad. */
export const PARAMETROS_ATLAS_ROPA = {
  columnas: 16,
  filas: 32,
  celdaAncho: 64,
  celdaAlto: 68,
  margen: 2,
};
const lisos = new Set([...TOPS_NUEVOS.map((t) => t.id), 'fundador']);
/** Las prendas con capas geométricas comparten el fondo del torso por color. */
export function datosTorsoCanonicos(a: DatosTorso): DatosTorso {
  return lisos.has(a.top) ? { ...a, top: 'liso', print: '', face: 'feliz' } : a;
}
