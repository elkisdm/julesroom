/** Cómo se ve un agente según la conversación: se levanta y mira, piensa, habla. Lógica pura. */
import type { AgenteOficina } from '@oficina/motor';
import type { Fase } from './estadoConversacion';

export type Vida = Pick<AgenteOficina, 'estado' | 'actividad'>;

/** Valores iniciales parametrizables. */
export const PARAMETROS_VIDA = {
  /** Cuánto tarda el agente en volver a lo suyo tras cerrar la conversación (ms). */
  retornoMs: 1500,
} as const;

/** Qué debe hacer el agente en cada fase; `null` si no se cambia nada (conversación cerrada). */
export function vidaDeFase(fase: Fase): Vida | null {
  switch (fase) {
    case 'abierta':
    case 'error':
      return { estado: 'esperando_decision' };
    case 'pensando':
      return { estado: 'trabajando', actividad: 'pensando' };
    case 'respondiendo':
      return { estado: 'trabajando', actividad: 'hablando' };
    case 'cerrada':
      return null;
  }
}

/**
 * La lista con la vida aplicada. Los agentes sin cambio conservan su objeto (misma identidad), así el motor no
 * reinicia lo que no cambió.
 */
export function aplicarVida(
  base: readonly AgenteOficina[],
  vida: Readonly<Record<string, Vida | undefined>>,
): AgenteOficina[] {
  return base.map((a) => {
    const v = vida[a.id];
    if (!v) return a;
    return { ...a, estado: v.estado, actividad: v.actividad };
  });
}

/** Ids que se marcan como «hablando» (contorno y nombre teñido) según la fase. */
export const hablaEn = (fase: Fase): boolean => fase === 'respondiendo';
