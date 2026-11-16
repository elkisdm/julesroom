export type Punto = { x: number; y: number; z: number };
export type Orden = 'seguir' | 'esperar' | 'venir' | 'puesto' | 'guiar';
export const PARAMETROS_JULES = {
  radioInteraccion: 2.8,
  radioLlegada: 0.7,
  distanciaComoda: 2,
  periodoMs: 100,
};
export const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!,.;:]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
/** Las menciones a otros agentes conservan su ruta de conversación existente. */
export function esMensajeParaJules(texto: string) {
  const t = normalizar(texto);
  return !t.startsWith('@') || /^@jules(?:\s|$)/.test(t);
}
/** E pertenece a la interacción alcanzable más cercana; sentado siempre permite levantarse. */
export function puedeInteractuar(
  jules: Punto,
  usuario: Punto & { estado: string },
  acciones: readonly { x: number; y?: number; z: number; radio: number }[],
) {
  const distancia = (p: { x: number; y?: number; z: number }) =>
    Math.hypot(p.x - usuario.x, (p.y ?? 0) - usuario.y, p.z - usuario.z);
  const d = distancia(jules);
  return (
    usuario.estado !== 'sentado' &&
    d <= PARAMETROS_JULES.radioInteraccion &&
    !acciones.some((a) => distancia(a) <= a.radio && distancia(a) < d)
  );
}
/** Solo frases completas: una conversación sobre seguir no debe mover a Jules. */
export function reconocerOrden(texto: string): Orden | null {
  const t = normalizar(texto)
    .replace(/^@?jules\s+/, '')
    .replace(/ por favor$/, '');
  if (/^(espera( aqui)?|quedate( aqui)?|deja de seguirme|no me sigas)$/.test(t)) return 'esperar';
  if (/^(sigueme|sigue conmigo)$/.test(t)) return 'seguir';
  if (/^(ven( aqui| conmigo)?|acercate)$/.test(t)) return 'venir';
  if (/^(vuelve|regresa) a tu puesto$/.test(t)) return 'puesto';
  return null;
}
export interface EstadoJules {
  modo: Orden;
  destino: Punto;
  puesto: Punto;
}
export const crearEstado = (puesto: Punto): EstadoJules => ({
  modo: 'esperar',
  destino: { ...puesto },
  puesto: { ...puesto },
});
/** Toda orden reemplaza la anterior, incluidas las guías. */
export function ordenar(e: EstadoJules, orden: Orden, actual: Punto, yo: Punto, destino?: Punto) {
  e.modo = orden;
  e.destino = {
    ...(orden === 'puesto'
      ? e.puesto
      : orden === 'guiar' && destino
        ? destino
        : orden === 'venir'
          ? yo
          : actual),
  };
}
export function actualizar(e: EstadoJules, actual: Punto, yo: Punto) {
  const d = (p: Punto) => Math.hypot(actual.x - p.x, actual.z - p.z, actual.y - p.y);
  if (
    (e.modo === 'venir' && d(yo) <= PARAMETROS_JULES.distanciaComoda) ||
    ((e.modo === 'puesto' || e.modo === 'guiar') && d(e.destino) < PARAMETROS_JULES.radioLlegada)
  ) {
    e.modo = 'esperar';
    e.destino = { ...actual };
  }
}
export const etiqueta = (e: EstadoJules) =>
  ({
    seguir: 'te sigue',
    esperar: 'espera aquí',
    venir: 'va contigo',
    puesto: 'vuelve a su puesto',
    guiar: 'te guía',
  })[e.modo];
