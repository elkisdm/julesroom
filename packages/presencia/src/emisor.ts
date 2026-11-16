/** Valores iniciales del emisor de posición (parametrizables). */
export const PARAMETROS_EMISOR = { hz: 10, latidoHz: 1, umbralMovimiento: 0.01, umbralRumbo: 0.02 };

export type ParametrosEmisor = typeof PARAMETROS_EMISOR;

/** Estado propio que se evalúa para decidir si enviar. */
export interface EstadoEmisor {
  x: number;
  y: number;
  z: number;
  rumbo: number;
  saltos: number;
  sentado: boolean;
}

/** Diferencia angular mínima entre dos rumbos (rad, 0..π). */
function difRumbo(a: number, b: number): number {
  const dos = Math.PI * 2;
  const d = (((a - b) % dos) + dos) % dos;
  return Math.min(d, dos - d);
}

/**
 * Decide cuándo enviar la posición propia: a lo más `hz` por segundo; con cambio, al ritmo; quieto,
 * solo el latido (`latidoHz`). Un cambio de saltos o sentado se envía en cuanto la cadencia lo permite.
 */
export function crearEmisor(parametros: Partial<ParametrosEmisor> = {}) {
  const p = { ...PARAMETROS_EMISOR, ...parametros };
  let ultimoMs: number | null = null;
  let ultimo: EstadoEmisor | null = null;

  return {
    /** `true` si toca enviar `estado` ahora; en ese caso lo registra como último enviado. */
    debeEnviar(ahoraMs: number, estado: EstadoEmisor): boolean {
      let enviar = false;
      if (ultimoMs === null || ultimo === null) {
        enviar = true;
      } else {
        const transcurrido = ahoraMs - ultimoMs;
        if (transcurrido >= 1000 / p.hz) {
          const cambioDiscreto =
            estado.saltos !== ultimo.saltos || estado.sentado !== ultimo.sentado;
          const cambioContinuo =
            Math.hypot(estado.x - ultimo.x, estado.y - ultimo.y, estado.z - ultimo.z) >
              p.umbralMovimiento || difRumbo(estado.rumbo, ultimo.rumbo) > p.umbralRumbo;
          enviar = cambioDiscreto || cambioContinuo || transcurrido >= 1000 / p.latidoHz;
        }
      }
      if (enviar) {
        ultimoMs = ahoraMs;
        ultimo = { ...estado };
      }
      return enviar;
    },
    /** Olvida el último envío: el siguiente estado se envía siempre. */
    reiniciar(): void {
      ultimoMs = null;
      ultimo = null;
    },
  };
}

export type AccionVisibilidad = 'enviar' | 'pausar' | 'desconectar' | 'reconectar';

/**
 * Guardia de pestaña oculta: oculta → pausar; oculta más de `desconexionMs` → desconectar (una vez);
 * al volver tras desconectar → reconectar (una vez); luego enviar.
 */
export function crearGuardiaVisibilidad({
  desconexionMs = 5 * 60_000,
}: { desconexionMs?: number } = {}) {
  let visible = true;
  let ocultoDesde = 0;
  let desconectado = false;
  let reconectarPendiente = false;

  return {
    cambiarVisibilidad(nuevaVisible: boolean, ahoraMs: number): void {
      if (nuevaVisible === visible) return;
      visible = nuevaVisible;
      if (visible) {
        if (desconectado) reconectarPendiente = true;
      } else {
        ocultoDesde = ahoraMs;
      }
    },
    revisar(ahoraMs: number): AccionVisibilidad {
      if (!visible) {
        if (!desconectado && ahoraMs - ocultoDesde > desconexionMs) {
          desconectado = true;
          return 'desconectar';
        }
        return 'pausar';
      }
      if (reconectarPendiente) {
        reconectarPendiente = false;
        desconectado = false;
        return 'reconectar';
      }
      return 'enviar';
    },
  };
}
