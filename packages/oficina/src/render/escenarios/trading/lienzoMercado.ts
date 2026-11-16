/**
 * Lienzo «Mercado» reutilizable: mismo aspecto que la pantalla inclinada de una mesa de trading,
 * usable en cualquier pantalla del laboratorio (no solo en el escenario de fábrica).
 */
import type { ActivoId } from './mercado';
import { dibujarMesa } from './texturas';

/** Activo de ejemplo cuando la pantalla no viene atada a un mercado concreto. */
export const ACTIVO_MERCADO_GENERICO: ActivoId = 'btc';

export function dibujarMercadoPantalla(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  activo: ActivoId = ACTIVO_MERCADO_GENERICO,
): void {
  dibujarMesa(ctx, w, h, activo);
}
