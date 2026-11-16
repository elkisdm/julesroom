/**
 * Una persona simulada que «conversa» con un agente en ciclos, para probar el indicador que ven los demás.
 * Lo que viaja es `PresenciaConversacion` (quién, con quién y en qué estado), nunca el contenido.
 */
import { crearPresenciaConversacion, expiro } from '@oficina/agentes';
import type { PresenciaConversacion } from '@oficina/agentes';

/** Valores iniciales parametrizables. */
export const PARAMETROS_PRESENCIA_SIMULADA = {
  /** Cada cuántos ms se repite el ciclo. */
  periodoMs: 20_000,
  /** Cuánto dura la conversación dentro del ciclo. */
  duracionMs: 13_000,
  /** Hasta cuándo escucha, y hasta cuándo piensa (ms desde el inicio de la conversación). */
  escuchaHastaMs: 3_000,
  pensandoHastaMs: 5_500,
  /** A qué distancia (m) del avatar se ve la marca «conversando con …». */
  radioMarca: 9,
} as const;

/** El estado de la conversación simulada en el instante `ahora`; `null` fuera de la ventana de conversación. */
export function estadoSimulado(
  ahora: number,
  p: typeof PARAMETROS_PRESENCIA_SIMULADA = PARAMETROS_PRESENCIA_SIMULADA,
): PresenciaConversacion['estado'] | null {
  const t = ((ahora % p.periodoMs) + p.periodoMs) % p.periodoMs;
  if (t >= p.duracionMs) return null;
  if (t < p.escuchaHastaMs) return 'escuchando';
  if (t < p.pensandoHastaMs) return 'pensando';
  return 'respondiendo';
}

/**
 * Presencia vigente de la persona simulada, o `null` si no conversa o su indicador expiró. `anterior` es la que
 * ya había: si el estado no cambió se conserva (su `desde` es el del último cambio, y de ahí corre el ttl).
 */
export function presenciaSimulada(
  agenteId: string,
  personaId: string,
  ahora: number,
  anterior: PresenciaConversacion | null,
): PresenciaConversacion | null {
  const estado = estadoSimulado(ahora);
  if (!estado) return null;
  const actual =
    anterior && anterior.estado === estado && anterior.agenteId === agenteId
      ? anterior
      : crearPresenciaConversacion(agenteId, personaId, estado, ahora);
  return expiro(actual, ahora) ? null : actual;
}
