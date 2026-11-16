import type { CodigoError, DefinicionAgente } from './tipos';

/** Frases por defecto, en la voz de cada agente. Breves y dignas: nunca detalles técnicos ni claves. */
export const PLANTILLAS_ERROR: Record<CodigoError, (nombre: string) => string> = {
  'sin-clave': (n) =>
    `Soy ${n} y todavía no estoy conectado para conversar. Pídele a quien administra la sala que me active.`,
  'sin-red': (n) => `A ${n} se le cortó la conexión. Inténtalo de nuevo en un momento.`,
  limite: (n) => `${n} está atendiendo a mucha gente a la vez. Dame un rato y vuelve a escribirme.`,
  cortada: (n) => `Perdí el hilo a mitad de frase, soy ${n}. ¿Me lo repites?`,
  'demasiado-largo': (n) => `Eso es demasiado para ${n} de una sola vez. ¿Me lo cuentas más corto?`,
  vacio: (n) => `${n} te escucha, pero no llegó nada. ¿Qué querías decirme?`,
  interno: (n) => `A ${n} se le cruzó algo y no pudo responder. Inténtalo otra vez en un momento.`,
};

export function frasesDeErrorPorDefecto(
  def: Pick<DefinicionAgente, 'nombre'>,
): Record<CodigoError, string> {
  const frases = {} as Record<CodigoError, string>;
  for (const codigo of Object.keys(PLANTILLAS_ERROR) as CodigoError[]) {
    frases[codigo] = PLANTILLAS_ERROR[codigo](def.nombre);
  }
  return frases;
}

export function fraseDeError(
  def: Pick<DefinicionAgente, 'nombre' | 'frasesError'>,
  codigo: CodigoError,
): string {
  return def.frasesError?.[codigo] ?? PLANTILLAS_ERROR[codigo](def.nombre);
}
