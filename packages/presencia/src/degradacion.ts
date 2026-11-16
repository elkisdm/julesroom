/** Red degradada que se emula en el cliente sobre el canal de datos (las herramientas de Chrome no afectan a WebRTC). */
export interface Degradacion {
  /** Retraso base de llegada (ms). */
  retardoMs: number;
  /** Variación aleatoria del retraso, ± ms (puede desordenar la llegada). */
  jitterMs: number;
  /** Fracción de paquetes que se pierden (0..1). */
  perdida: number;
}

/** Qué hacer con un paquete que llega: descartarlo o entregarlo tras `esperaMs`. */
export function planDegradacion(
  azar: () => number,
  d: Degradacion,
): { descartar: boolean; esperaMs: number } {
  if (azar() < d.perdida) return { descartar: true, esperaMs: 0 };
  const jitter = (azar() * 2 - 1) * d.jitterMs;
  return { descartar: false, esperaMs: Math.max(0, d.retardoMs + jitter) };
}

/** Lee `retardo,jitter,perdida` (p. ej. `150,60,0.15`); `null` si falta o está mal. */
export function leerDegradacion(texto: string | null | undefined): Degradacion | null {
  if (!texto) return null;
  const partes = texto.split(',').map(Number);
  const [retardoMs, jitterMs, perdida] = partes;
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if ((perdida as number) > 1) return null;
  return {
    retardoMs: retardoMs as number,
    jitterMs: jitterMs as number,
    perdida: perdida as number,
  };
}
