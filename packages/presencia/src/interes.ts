/** Valores iniciales de la gestión de interés (parametrizables). Apagada por defecto. */
export const PARAMETROS_INTERES = {
  habilitada: false,
  umbral: 50,
  radioCerca: 12,
  hzCerca: 10,
  hzLejos: 2,
};

export type ParametrosInteres = typeof PARAMETROS_INTERES;

/**
 * Decide a quién enviar la posición propia ahora. Apagada, o con menos personas que `umbral`, se envía
 * a todos (`aTodos`). Con muchas personas: cerca (≤ `radioCerca`, en el plano) a `hzCerca` y lejos a
 * `hzLejos`, según `ultimoEnvio` (ms por id), que esta función actualiza para quienes selecciona.
 */
export function planEnvioInteres(
  yo: { x: number; z: number },
  otros: ReadonlyArray<{ id: string; x: number; z: number }>,
  ahoraMs: number,
  ultimoEnvio: Map<string, number>,
  parametros: ParametrosInteres = PARAMETROS_INTERES,
): { aTodos: boolean; identidades: string[] } {
  if (!parametros.habilitada || otros.length < parametros.umbral)
    return { aTodos: true, identidades: [] };

  const identidades: string[] = [];
  for (const otro of otros) {
    const cerca = Math.hypot(otro.x - yo.x, otro.z - yo.z) <= parametros.radioCerca;
    const intervalo = 1000 / (cerca ? parametros.hzCerca : parametros.hzLejos);
    const ultimo = ultimoEnvio.get(otro.id);
    if (ultimo === undefined || ahoraMs - ultimo >= intervalo) {
      identidades.push(otro.id);
      ultimoEnvio.set(otro.id, ahoraMs);
    }
  }
  return { aTodos: false, identidades };
}
