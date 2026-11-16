/** Tipeo suave: cuántos caracteres se muestran en este cuadro para alcanzar el texto recibido. Lógica pura. */

export const PARAMETROS_TIPEO = {
  /** Mínimo de caracteres por cuadro. */
  minimo: 1,
  /** Fracción de lo pendiente que se muestra por cuadro: si llega mucho, se acelera para no atrasarse. */
  fraccion: 0.12,
} as const;

/** Nuevos `mostrados` tras un cuadro. Con movimiento reducido el texto aparece de golpe. */
export function avanceTipeo(
  mostrados: number,
  total: number,
  reducirMovimiento: boolean,
  p: typeof PARAMETROS_TIPEO = PARAMETROS_TIPEO,
): number {
  if (mostrados >= total) return total;
  if (reducirMovimiento) return total;
  const pendiente = total - mostrados;
  return Math.min(total, mostrados + Math.max(p.minimo, Math.ceil(pendiente * p.fraccion)));
}
