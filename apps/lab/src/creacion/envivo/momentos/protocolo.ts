export const PARAMETROS_MOMENTOS = {
  prefijo: 'd5/momento',
  version: 1,
  textoMax: 80,
  paqueteMax: 1200,
  fotoMs: 3000,
  bienvenidaMs: 6000,
  celebrarMs: 3500,
  intervaloMs: 5000,
  desfaseMaxMs: 10_000,
  minutosMax: 60,
} as const;
export type AccionMomento =
  'foto' | 'temporizador' | 'celebrar' | 'atencion' | 'apagar' | 'bienvenida';
export interface Momento {
  tipo: typeof PARAMETROS_MOMENTOS.prefijo;
  version: 1;
  accion: AccionMomento;
  inicio: number;
  fin: number;
  texto: string;
}
const acciones: readonly string[] = [
  'foto',
  'temporizador',
  'celebrar',
  'atencion',
  'apagar',
  'bienvenida',
];
/** Crea un único paquete; los receptores calculan el tiempo restante con su reloj. */
export function crearMomento(
  accion: AccionMomento,
  inicio: number,
  opciones: { minutos?: number; texto?: string } = {},
): Momento {
  const texto = (opciones.texto ?? '').trim();
  if (texto.length > PARAMETROS_MOMENTOS.textoMax) throw new Error('Usa hasta 80 caracteres.');
  const minutos = opciones.minutos ?? 1;
  if (!Number.isFinite(minutos) || minutos < 1 || minutos > PARAMETROS_MOMENTOS.minutosMax)
    throw new Error('Elige entre 1 y 60 minutos.');
  const duracion =
    accion === 'foto'
      ? PARAMETROS_MOMENTOS.fotoMs
      : accion === 'bienvenida'
        ? PARAMETROS_MOMENTOS.bienvenidaMs
        : accion === 'celebrar'
          ? PARAMETROS_MOMENTOS.celebrarMs
          : accion === 'temporizador'
            ? minutos * 60_000
            : 0;
  return {
    tipo: PARAMETROS_MOMENTOS.prefijo,
    version: 1,
    accion,
    inicio,
    fin: inicio + duracion,
    texto,
  };
}
export function segundosRestantes(fin: number, ahora: number) {
  return Math.max(0, Math.ceil((fin - ahora) / 1000));
}
/** El emisor viene del transporte autenticado, nunca de un campo del paquete o metadata. */
export function crearReceptorMomentos(dueno: string) {
  const ultimos = new Map<string, number>();
  return (texto: string, emisor: string, ahora: number): Momento | null => {
    if (!dueno || emisor !== dueno || texto.length > PARAMETROS_MOMENTOS.paqueteMax) return null;
    let p: Momento;
    try {
      p = JSON.parse(texto) as Momento;
    } catch {
      return null;
    }
    if (
      !p ||
      p.tipo !== PARAMETROS_MOMENTOS.prefijo ||
      p.version !== 1 ||
      !acciones.includes(p.accion) ||
      typeof p.texto !== 'string' ||
      p.texto.length > PARAMETROS_MOMENTOS.textoMax ||
      !Number.isSafeInteger(p.inicio) ||
      !Number.isSafeInteger(p.fin) ||
      Math.abs(p.inicio - ahora) > PARAMETROS_MOMENTOS.desfaseMaxMs
    )
      return null;
    const duracion = p.fin - p.inicio;
    const esperado =
      p.accion === 'foto'
        ? PARAMETROS_MOMENTOS.fotoMs
        : p.accion === 'bienvenida'
          ? PARAMETROS_MOMENTOS.bienvenidaMs
          : p.accion === 'celebrar'
            ? PARAMETROS_MOMENTOS.celebrarMs
            : 0;
    if (
      p.accion === 'temporizador'
        ? duracion < 60_000 || duracion > PARAMETROS_MOMENTOS.minutosMax * 60_000
        : duracion !== esperado
    )
      return null;
    const anterior = ultimos.get(p.accion);
    if (
      anterior !== undefined &&
      p.inicio - anterior < (p.accion === 'apagar' ? 1 : PARAMETROS_MOMENTOS.intervaloMs)
    )
      return null;
    ultimos.set(p.accion, p.inicio);
    return p;
  };
}
