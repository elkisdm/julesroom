import type { FuenteLiveKit } from '@oficina/presencia';

export const sinVoz = (env: Record<string, unknown>) => env['VITE_SALA_SIN_VOZ'] === '1';
/**
 * La fuente conecta con autoSubscribe:false. Un radio negativo excluye incluso personas
 * a distancia cero; no pasamos salaDe, por lo que tampoco hay suscripción por recinto.
 */
export const PARAMETROS_SIN_VOZ = { radio: -1 };
/** Bloquea captura y oculta actividad de voz, conservando presencia y canal de datos. */
export function fuenteSinVoz(fuente: FuenteLiveKit): FuenteLiveKit {
  return {
    ...fuente,
    hablandoIds: new Set(),
    activarMicrofono: async () => undefined,
    silenciarPropio: async () => undefined,
  };
}
