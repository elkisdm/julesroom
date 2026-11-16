import type { AccionHablar, OcupanteAgente, PosicionAgente } from '@oficina/motor';

export const PARAMETROS_INTERACCION_FISICA = {
  radioHablar: 2.4,
  radioMirada: 3.2,
  alturaMaxima: 1,
  periodoMs: 100,
  saludoMs: 1200,
};

/** Acciones estables: las posiciones se actualizan sin reemplazar el objetivo seleccionado. */
export function crearAccionesHablar(
  agentes: readonly OcupanteAgente[],
  alHablar: (id: string) => void,
): AccionHablar[] {
  return agentes.map((a) => ({
    id: `hablar:${a.id}`,
    agenteId: a.id,
    tipo: 'hablar',
    nombre: a.nombre,
    x: Infinity,
    y: 0,
    z: Infinity,
    radio: PARAMETROS_INTERACCION_FISICA.radioHablar,
    alEjecutar: () => alHablar(a.id),
  }));
}

/** Un rig ausente no ofrece interacción en la última posición conocida. */
export function actualizarAccionesHablar(
  acciones: readonly AccionHablar[],
  mundo: (id: string) => PosicionAgente | null,
): void {
  for (const a of acciones) {
    const p = mundo(a.agenteId);
    a.x = p?.x ?? Infinity;
    a.y = p?.y ?? 0;
    a.z = p?.z ?? Infinity;
  }
}

/**
 * El estado de miradas solo cambia si cambian los agentes que miran: así `setState` no provoca un
 * render nuevo, aunque el efecto que lo llama se repita (p. ej. una sala recreada en cada render).
 */
export function miradasSiguientes(
  antes: Record<string, string>,
  nuevas: Record<string, string>,
): Record<string, string> {
  return Object.keys(antes).join() === Object.keys(nuevas).join() ? antes : nuevas;
}

/** Solo los agentes cercanos en la misma planta atienden físicamente al jugador. */
export function miradasCercanas(
  acciones: readonly AccionHablar[],
  avatar: { x: number; y: number; z: number },
): Record<string, string> {
  const miradas: Record<string, string> = {};
  const P = PARAMETROS_INTERACCION_FISICA;
  for (const a of acciones) {
    if (
      Math.hypot(a.x - avatar.x, a.z - avatar.z) <= P.radioMirada &&
      Math.abs((a.y ?? 0) - avatar.y) <= P.alturaMaxima
    )
      miradas[a.agenteId] = 'avatar-propio';
  }
  return miradas;
}
