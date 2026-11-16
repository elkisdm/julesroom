/**
 * Dónde aparece el avatar propio cada vez que se rehace (cambio de nombre, de ropa o de sala):
 * donde estaba si ya caminó en esta sala; si no, en la entrada del escenario. Durante el onboarding
 * el avatar todavía no existe en la escena, así que no hay una posición previa que conservar.
 */
export function puntoDeAparicion(
  ultimo: { x: number; z: number } | null,
  entrada: { x: number; z: number } | undefined,
): { x: number; z: number } {
  return ultimo ? { x: ultimo.x, z: ultimo.z } : { x: entrada?.x ?? 0, z: entrada?.z ?? 0 };
}

/**
 * Entrada de cada persona: el dueño (o quien está solo) usa la primera; los invitados se reparten
 * entre las demás según su identidad, para no aparecer todos en el mismo punto (auditorio: 25).
 */
export function entradaDe<T>(entradas: readonly T[], id: string, invitado: boolean): T | undefined {
  if (!invitado || entradas.length < 2) return entradas[0];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return entradas[1 + (h % (entradas.length - 1))];
}
