import type { PuntoD2 } from './modelo';
export const VOTO = {
  radio: 1.45,
  separacion: 3.6,
  altura: 0.6,
  maxTexto: 120,
  maxRotulo: 32,
  muestreo: 16,
  pasoMs: 250,
  latidoMs: 1500,
};
export interface ZonaVoto {
  x: number;
  y: number;
  z: number;
  rotulo: string;
}
export interface VotacionD2 {
  tipo: 'd2-votacion';
  revision: number;
  id: string;
  pregunta: string;
  opciones: ZonaVoto[];
  cerrada: boolean;
  conteos: number[];
}
/** Solo el anfitrión autenticado publica una votación, sus conteos y el cierre definitivo. */
export function leerVotacionD2(texto: string, emisor: string, dueno: string): VotacionD2 | null {
  if (!dueno || emisor !== dueno || texto.length > 4000) return null;
  let p: VotacionD2;
  try {
    p = JSON.parse(texto);
  } catch {
    return null;
  }
  if (
    !p ||
    p.tipo !== 'd2-votacion' ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < 1 ||
    typeof p.id !== 'string' ||
    p.id.length > 80 ||
    typeof p.pregunta !== 'string' ||
    !p.pregunta.trim() ||
    p.pregunta.length > VOTO.maxTexto ||
    typeof p.cerrada !== 'boolean' ||
    !Array.isArray(p.opciones) ||
    p.opciones.length < 2 ||
    p.opciones.length > 4 ||
    !Array.isArray(p.conteos) ||
    p.conteos.length !== p.opciones.length
  )
    return null;
  if (!p.conteos.every((n) => Number.isInteger(n) && n >= 0 && n <= 25)) return null;
  return p.opciones.every(
    (z) =>
      z &&
      [z.x, z.y, z.z].every(
        (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000,
      ) &&
      typeof z.rotulo === 'string' &&
      z.rotulo.trim() &&
      z.rotulo.length <= VOTO.maxRotulo,
  )
    ? p
    : null;
}
/** Cuenta posiciones de presencia; una persona ocupa como máximo una zona en su planta. */
export function contarVotos(
  zonas: readonly ZonaVoto[],
  personas: readonly { x: number; y: number; z: number }[],
): number[] {
  const conteos = zonas.map(() => 0);
  for (const p of personas) {
    const i = zonas.findIndex(
      (z) => Math.abs(z.y - p.y) < VOTO.altura && Math.hypot(z.x - p.x, z.z - p.z) <= VOTO.radio,
    );
    if (i >= 0) conteos[i]!++;
  }
  return conteos;
}
export function resultadoVotos(conteos: readonly number[]): number[] {
  const max = Math.max(0, ...conteos);
  return max ? conteos.flatMap((n, i) => (n === max ? [i] : [])) : [];
}
/** Busca un conjunto completo de discos libres: comprueba centro y contorno antes de publicar. */
export function crearZonas(
  host: PuntoD2,
  rotulos: readonly string[],
  libre: (p: PuntoD2) => boolean,
): ZonaVoto[] {
  for (const columnas of [2, 1])
    for (const desplazamiento of [0, -1.8, 1.8, -3.6, 3.6])
      for (let distancia = 4; distancia <= 16; distancia += 2) {
        const zonas = rotulos.map((rotulo, i) => {
          const lado = ((i % columnas) - (columnas - 1) / 2) * VOTO.separacion + desplazamiento,
            frente = distancia + Math.floor(i / columnas) * VOTO.separacion;
          return {
            rotulo,
            x: host.x + Math.sin(host.rumbo) * frente + Math.cos(host.rumbo) * lado,
            y: host.y,
            z: host.z + Math.cos(host.rumbo) * frente - Math.sin(host.rumbo) * lado,
          };
        });
        if (
          zonas.every(
            (z) =>
              libre({ ...z, rumbo: host.rumbo }) &&
              Array.from(
                { length: VOTO.muestreo },
                (_, i) => (i * 2 * Math.PI) / VOTO.muestreo,
              ).every((a) =>
                libre({
                  ...z,
                  x: z.x + Math.cos(a) * VOTO.radio,
                  z: z.z + Math.sin(a) * VOTO.radio,
                  rumbo: host.rumbo,
                }),
              ),
          )
        )
          return zonas;
      }
  return [];
}
