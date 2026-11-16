/** Lo que viajaría por presencia cuando TÚ conversas con un agente (nunca el contenido). */
import { crearPresenciaConversacion } from '@oficina/agentes';
import type { PresenciaConversacion } from '@oficina/agentes';
import type { Fase } from './estadoConversacion';

export const ID_PERSONA_PROPIA = 'avatar-propio';

const ESTADO_POR_FASE: Record<Fase, PresenciaConversacion['estado'] | null> = {
  cerrada: null,
  abierta: 'escuchando',
  error: 'escuchando',
  pensando: 'pensando',
  respondiendo: 'respondiendo',
};

/**
 * La presencia de tu conversación, o `null` si está cerrada. Si nada cambió respecto de `anterior`, devuelve
 * esa misma (su `desde` es el último cambio).
 */
export function presenciaPropia(
  fase: Fase,
  agenteId: string | null,
  ahora: number,
  anterior: PresenciaConversacion | null,
): PresenciaConversacion | null {
  const estado = ESTADO_POR_FASE[fase];
  if (!estado || !agenteId) return null;
  if (anterior && anterior.estado === estado && anterior.agenteId === agenteId) return anterior;
  return crearPresenciaConversacion(agenteId, ID_PERSONA_PROPIA, estado, ahora);
}
