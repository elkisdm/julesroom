import type { Interes } from '../escenarios/tipos';

/** Metros que el avatar puede pasarse del radio de un interés sin que se dé por salido (evita el parpadeo). */
export const HISTERESIS_INTERES = 0.3;

/** Cada cuántos segundos se revisa la cercanía a los puntos de interés. */
export const PERIODO_INTERES = 0.2;

/**
 * Id del interés del escenario en el que está el avatar (`x`, `z`), o `null`. Entra dentro de su `radio`;
 * el que ya estaba activo (`actualId`) se conserva hasta `radio + histeresis`. Con varios dentro, el más cercano.
 */
export function interesCercano(
  intereses: readonly Interes[],
  x: number,
  z: number,
  actualId: string | null,
  histeresis: number,
): string | null {
  let mejor: string | null = null;
  let mejorDistancia = Infinity;
  for (const i of intereses) {
    const distancia = Math.hypot(x - i.x, z - i.z);
    const limite = i.radio + (i.id === actualId ? histeresis : 0);
    if (distancia <= limite && distancia < mejorDistancia) {
      mejor = i.id;
      mejorDistancia = distancia;
    }
  }
  return mejor;
}
