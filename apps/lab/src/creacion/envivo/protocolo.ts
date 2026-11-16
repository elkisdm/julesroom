import { validarSala, type SalaGuardada } from '@oficina/motor';
import { limpiarEntrada } from '@oficina/agentes';

/** Valores iniciales de esta rebanada local, compartidos por cliente y servidor. */
export const LIMITES_VIVO = {
  personas: 8,
  personasDemo: 25,
  mensajesMinuto: 12,
  caracteres: 1000,
  cola: 1,
  bytes: 15000,
  respuesta: 8000,
  pedirCadaMs: 1500,
};
export type BurbujaViva = {
  tipo: 'burbuja';
  id: string;
  agente: string;
  texto: string;
  fase: 'pensando' | 'texto' | 'fin' | 'error';
  x: number;
  y: number;
  z: number;
};
export type Paquete =
  { tipo: 'pedir' } | { tipo: 'mundo'; revision: number; sala: SalaGuardada } | BurbujaViva;
const idValido = (x: unknown): x is string => typeof x === 'string' && /^[\w-]{1,64}$/.test(x);

/** Frontera del canal fiable: ningún dato se aplica sin validar. */
export function leerPaquete(texto: string): Paquete | null {
  if (new TextEncoder().encode(texto).length > LIMITES_VIVO.bytes) return null;
  try {
    const p = JSON.parse(texto);
    if (!p || typeof p !== 'object') return null;
    if (p.tipo === 'pedir') return { tipo: 'pedir' };
    if (
      p.tipo === 'mundo' &&
      Number.isSafeInteger(p.revision) &&
      p.revision > 0 &&
      validarSala(p.sala).ok
    )
      return { tipo: 'mundo', revision: p.revision, sala: p.sala };
    if (
      p.tipo === 'burbuja' &&
      idValido(p.id) &&
      idValido(p.agente) &&
      typeof p.texto === 'string' &&
      p.texto.length <= LIMITES_VIVO.respuesta &&
      ['pensando', 'texto', 'fin', 'error'].includes(p.fase) &&
      [p.x, p.y, p.z].every(
        (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1000,
      )
    ) {
      return {
        tipo: 'burbuja',
        id: p.id,
        agente: p.agente,
        fase: p.fase,
        texto: limpiarEntrada(p.texto, LIMITES_VIVO.respuesta).texto,
        x: p.x,
        y: p.y,
        z: p.z,
      };
    }
  } catch {
    /* Canal no confiable: un paquete inválido se descarta completo. */
  }
  return null;
}
export function aceptarMundo(
  p: Extract<Paquete, { tipo: 'mundo' }>,
  emisor: string,
  dueno: string,
  revision: number,
) {
  return emisor === dueno && p.revision > revision;
}
export function mezclarSala(remota: SalaGuardada, local: SalaGuardada): SalaGuardada {
  const yo = local.ocupantes.find((o) => o.id === 'yo');
  return {
    ...remota,
    ocupantes: [...remota.ocupantes.filter((o) => o.tipo === 'agente'), ...(yo ? [yo] : [])],
  };
}
export function enlaceSala(base: string, sala: string, dueno: string) {
  const u = new URL(base);
  u.search = new URLSearchParams({ sala, dueno }).toString();
  u.hash = '';
  return u.href;
}
/** Cola de un turno pendiente, con ventana deslizante; rechazos no consumen cupo. */
export function crearCola(
  limites = LIMITES_VIVO as Pick<typeof LIMITES_VIVO, 'mensajesMinuto' | 'caracteres' | 'cola'>,
  ahora = Date.now,
) {
  let pendientes = 0;
  let tiempos: number[] = [];
  return {
    reservar(texto: string) {
      tiempos = tiempos.filter((t) => ahora() - t < 60000);
      if (
        !texto.trim() ||
        texto.length > limites.caracteres ||
        pendientes >= limites.cola ||
        tiempos.length >= limites.mensajesMinuto
      )
        return false;
      tiempos.push(ahora());
      pendientes++;
      return true;
    },
    terminar() {
      pendientes = Math.max(0, pendientes - 1);
    },
  };
}
