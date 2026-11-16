import type { CandidatoEtiqueta } from './textoEtiquetas';

/** Las personas conectadas conservan su nombre aun con el presupuesto gráfico reducido. */
export function candidatoVivo(
  id: string,
  distancia: number,
  persistente: boolean,
): CandidatoEtiqueta {
  return { id, distancia, seleccionado: false, hablando: persistente };
}

export const NOMBRES_VIVOS = { margenPx: 8, minimoPx: 16 };
/** Desplazamiento horizontal en píxeles para leer un nombre cuyo personaje roza el borde. */
export function correccionNombre(x: number, ancho: number, pantalla: number): number {
  const medio = Math.min(pantalla / 2, ancho / 2 + NOMBRES_VIVOS.margenPx);
  return Math.max(medio, Math.min(pantalla - medio, x)) - x;
}
