/**
 * Con vsync el tiempo entre cuadros nunca baja del refresco de la pantalla (16,7 ms a 60 Hz),
 * así que su p95 no dice cuánta holgura queda ni deja ver un equipo que sobra; y bajar la
 * resolución solo ayuda si el cuello es la GPU. La señal que decide la calidad es por eso la
 * pérdida de cuadros: 0 si el cuadro llegó a tiempo, y el tiempo completo si tardó más de 1,5
 * refrescos. Su p95 queda en 0 («hay holgura») mientras se pierdan menos del 5 % de los cuadros.
 */
export const UMBRAL_CUADRO_PERDIDO = 1.5;

export function senalDeCuadro(deltaMs: number, refrescoMs: number): number {
  return deltaMs > refrescoMs * UMBRAL_CUADRO_PERDIDO ? deltaMs : 0;
}

/** Intervalo de refresco estimado: el p10 de los tiempos entre cuadros, acotado a 4–34 ms. */
export function acotarRefresco(p10Ms: number): number {
  return Math.min(34, Math.max(4, p10Ms));
}
