/**
 * Decisiones del arrastre en construir, sin React: cuándo el gesto es de la cámara,
 * cuándo ya no es un clic, y dónde queda el objeto para que el punto agarrado
 * siga bajo el puntero (con el ajuste a la rejilla).
 */
import { ajustar } from '@oficina/motor';

/** Por debajo de esto el rayo va paralelo al plano y no hay intersección útil. */
const RAYO_PARALELO = 1e-8;

export interface Rayo {
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dy: number;
  dz: number;
}

/** El punto del objeto que quedó bajo el puntero al presionar, respecto de su origen. */
export interface Agarre {
  dx: number;
  dz: number;
  /** Altura del punto agarrado. El objeto se desliza y ese plano no cambia. */
  planoY: number;
}

/** ¿El puntero se movió lo bastante como para ser arrastre y no clic? */
export function superaUmbral(
  origen: { x: number; y: number },
  actual: { x: number; y: number },
  umbralPx: number,
): boolean {
  return Math.hypot(actual.x - origen.x, actual.y - origen.y) >= umbralPx;
}

export function crearAgarre(
  origen: { x: number; z: number },
  punto: { x: number; y: number; z: number },
): Agarre {
  return { dx: punto.x - origen.x, dz: punto.z - origen.z, planoY: punto.y };
}

/**
 * Nuevo origen del objeto para que el punto agarrado caiga en el rayo del puntero,
 * ajustado a la rejilla. `null` si el rayo no corta el plano por delante de la cámara.
 */
export function destinoDeAgarre(
  rayo: Rayo,
  agarre: Agarre,
  paso: number,
): { x: number; z: number } | null {
  if (Math.abs(rayo.dy) < RAYO_PARALELO) return null;
  const t = (agarre.planoY - rayo.oy) / rayo.dy;
  if (t <= 0) return null;
  return {
    x: ajustar(rayo.ox + rayo.dx * t - agarre.dx, paso),
    z: ajustar(rayo.oz + rayo.dz * t - agarre.dz, paso),
  };
}
