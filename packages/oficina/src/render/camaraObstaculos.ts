import type { Caja3 } from './visual';

/** Lo que mide un obstáculo en planta para decidir si es angosto (columna, mueble alto, planta). */
export interface CriterioAngosto {
  /** Ancho máximo (m) de la huella de un obstáculo angosto; un muro lo supera. */
  anchoAngosto: number;
}

export interface ObstaculosSeparados {
  /** Muros y volúmenes anchos: la cámara se acorta para no atravesarlos. */
  macizas: Caja3[];
  /** Columnas y muebles altos: se desvanecen, la cámara conserva su distancia. */
  angostas: Caja3[];
}

const cache = new WeakMap<readonly Caja3[], ObstaculosSeparados & { ancho: number }>();

/**
 * Parte las cajas de la casa por el ancho de su huella. El criterio es la medida de la caja, no el
 * ángulo con que se ve: un mismo obstáculo no cambia de clase al moverse el avatar, así que no hay
 * parpadeo de clasificación (la histéresis del desvanecimiento está en el tiempo, ver `avanzarSeguimiento`).
 * El resultado se memoriza por lista: se llama cada cuadro con la misma.
 */
export function separarObstaculos(
  cajas: readonly Caja3[],
  p: CriterioAngosto,
): ObstaculosSeparados {
  const guardado = cache.get(cajas);
  if (guardado && guardado.ancho === p.anchoAngosto) return guardado;
  const macizas: Caja3[] = [];
  const angostas: Caja3[] = [];
  for (const c of cajas) {
    (Math.max(c.x1 - c.x0, c.z1 - c.z0) <= p.anchoAngosto ? angostas : macizas).push(c);
  }
  const resultado = { macizas, angostas, ancho: p.anchoAngosto };
  cache.set(cajas, resultado);
  return resultado;
}
