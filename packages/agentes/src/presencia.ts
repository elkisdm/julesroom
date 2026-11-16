import type { PresenciaConversacion } from './tipos';

export const CONFIG_PRESENCIA = { ttlMs: 15000 };

export function crearPresenciaConversacion(
  agenteId: string,
  conPersonaId: string,
  estado: PresenciaConversacion['estado'],
  ahora: number,
): PresenciaConversacion {
  return { agenteId, conPersonaId, estado, desde: ahora };
}

/** Un indicador huérfano (quien conversaba se fue sin avisar) deja de mostrarse pasado el ttl. */
export function expiro(
  p: PresenciaConversacion,
  ahora: number,
  ttlMs = CONFIG_PRESENCIA.ttlMs,
): boolean {
  return ahora - p.desde > ttlMs;
}
