/** Estado de la conversación con un agente. Reducer puro: el tiempo y los ids llegan dentro de las acciones. */
import type { CodigoError, EventoRespuesta } from '@oficina/agentes';

export type Fase = 'cerrada' | 'abierta' | 'pensando' | 'respondiendo' | 'error';
export type Via = 'cerca' | 'mencion';

export interface Intercambio {
  usuario: string;
  respuesta: string;
  /** Frase del error (en la voz del agente) si el turno no terminó bien. */
  error?: { codigo: CodigoError; mensaje: string };
  /** El turno se interrumpió (error `cortada`, nuevo mensaje o cierre): lo recibido se conserva. */
  cortada?: boolean;
}

export interface TokensTurno {
  entrada: number;
  salida: number;
  cacheLeida: number;
}

/** Intercambios que se guardan por agente: el último y 2 previos. */
export const MAX_INTERCAMBIOS = 3;

export interface EstadoConversacion {
  fase: Fase;
  agenteId: string | null;
  via: Via | null;
  /** Lo que se está escribiendo (también con la conversación cerrada: la barra «Escríbele a…»). */
  borrador: string;
  /** Id de conversación por agente: se genera una vez y se conserva toda la pestaña. */
  conversaciones: Readonly<Record<string, string>>;
  /** Intercambios por agente, el más reciente al final. */
  historial: Readonly<Record<string, readonly Intercambio[]>>;
  /** Instante (ms) del último envío. */
  tEnvio: number | null;
  tPrimeraPalabra: number | null;
  tTotal: number | null;
  tokens: TokensTurno | null;
}

export type Accion =
  | { tipo: 'abrir'; agenteId: string; via: Via; idNuevo: string }
  | { tipo: 'escribir'; texto: string }
  | { tipo: 'enviar'; texto: string; ahora: number }
  | { tipo: 'reintentar'; ahora: number }
  | { tipo: 'detener'; ahora: number }
  | { tipo: 'llegoTexto'; trozo: string; ahora: number }
  | {
      tipo: 'llegoFin';
      uso: { entrada: number; salida: number; cacheLeida: number };
      ahora: number;
    }
  | { tipo: 'llegoError'; evento: Extract<EventoRespuesta, { tipo: 'error' }>; ahora: number }
  | { tipo: 'cerrar' };

export const estadoInicial: EstadoConversacion = {
  fase: 'cerrada',
  agenteId: null,
  via: null,
  borrador: '',
  conversaciones: {},
  historial: {},
  tEnvio: null,
  tPrimeraPalabra: null,
  tTotal: null,
  tokens: null,
};

/** Id aleatorio de 16 caracteres para una conversación nueva. */
export function idAleatorio(azar: () => number = Math.random): string {
  const alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) id += alfabeto[Math.floor(azar() * alfabeto.length)];
  return id;
}

/** ¿Hay un turno en curso (esperando o recibiendo respuesta)? */
export const enCurso = (e: EstadoConversacion): boolean =>
  e.fase === 'pensando' || e.fase === 'respondiendo';

const SIN_HISTORIAL: readonly Intercambio[] = [];

/** El historial de un agente; el mismo arreglo vacío si no hay (estable para `useSyncExternalStore`). */
export const historialDe = (e: EstadoConversacion, agenteId: string): readonly Intercambio[] =>
  e.historial[agenteId] ?? SIN_HISTORIAL;

/** El último intercambio del agente de la conversación abierta. */
export function ultimoIntercambio(e: EstadoConversacion): Intercambio | null {
  if (!e.agenteId) return null;
  return historialDe(e, e.agenteId).at(-1) ?? null;
}

/** Reemplaza el último intercambio del agente activo. */
function conUltimo(
  e: EstadoConversacion,
  cambio: (i: Intercambio) => Intercambio,
): EstadoConversacion['historial'] {
  if (!e.agenteId) return e.historial;
  const lista = historialDe(e, e.agenteId);
  const ultimo = lista.at(-1);
  if (!ultimo) return e.historial;
  return { ...e.historial, [e.agenteId]: [...lista.slice(0, -1), cambio(ultimo)] };
}

/** Marca como cortado el turno en curso que otra acción deja atrás. */
function cortarEnCurso(e: EstadoConversacion): EstadoConversacion['historial'] {
  return enCurso(e) ? conUltimo(e, (i) => ({ ...i, cortada: true })) : e.historial;
}

function nuevoTurno(
  e: EstadoConversacion,
  historial: EstadoConversacion['historial'],
  ahora: number,
): EstadoConversacion {
  return {
    ...e,
    historial,
    fase: 'pensando',
    tEnvio: ahora,
    tPrimeraPalabra: null,
    tTotal: null,
    tokens: null,
  };
}

export function reducir(e: EstadoConversacion, a: Accion): EstadoConversacion {
  switch (a.tipo) {
    case 'abrir': {
      const historial = e.agenteId === a.agenteId ? e.historial : cortarEnCurso(e);
      return {
        ...e,
        historial,
        fase: e.agenteId === a.agenteId && enCurso(e) ? e.fase : 'abierta',
        agenteId: a.agenteId,
        // Si ya estaba abierta con él, la vía original manda (cerca no pasa a mención ni al revés).
        via: e.agenteId === a.agenteId && e.via ? e.via : a.via,
        conversaciones: e.conversaciones[a.agenteId]
          ? e.conversaciones
          : { ...e.conversaciones, [a.agenteId]: a.idNuevo },
      };
    }
    case 'escribir':
      return e.borrador === a.texto ? e : { ...e, borrador: a.texto };
    case 'enviar': {
      const texto = a.texto.trim();
      if (e.fase === 'cerrada' || !e.agenteId || texto === '') return e;
      const previa = cortarEnCurso(e);
      const lista = [...(previa[e.agenteId] ?? []), { usuario: texto, respuesta: '' }].slice(
        -MAX_INTERCAMBIOS,
      );
      return nuevoTurno({ ...e, borrador: '' }, { ...previa, [e.agenteId]: lista }, a.ahora);
    }
    case 'reintentar': {
      const ultimo = ultimoIntercambio(e);
      if (e.fase !== 'error' || !ultimo) return e;
      return nuevoTurno(
        e,
        conUltimo(e, (i) => ({ usuario: i.usuario, respuesta: '' })),
        a.ahora,
      );
    }
    case 'llegoTexto': {
      if (!enCurso(e)) return e;
      const primera = e.tPrimeraPalabra === null;
      return {
        ...e,
        fase: 'respondiendo',
        tPrimeraPalabra: primera ? a.ahora - (e.tEnvio ?? a.ahora) : e.tPrimeraPalabra,
        historial: conUltimo(e, (i) => ({ ...i, respuesta: i.respuesta + a.trozo })),
      };
    }
    case 'llegoFin': {
      if (!enCurso(e)) return e;
      return {
        ...e,
        fase: 'abierta',
        tTotal: a.ahora - (e.tEnvio ?? a.ahora),
        tokens: a.uso,
      };
    }
    case 'llegoError': {
      if (!enCurso(e)) return e;
      const { codigo, mensaje } = a.evento;
      return {
        ...e,
        fase: 'error',
        tTotal: a.ahora - (e.tEnvio ?? a.ahora),
        historial: conUltimo(e, (i) => ({
          ...i,
          error: { codigo, mensaje },
          ...(codigo === 'cortada' ? { cortada: true } : {}),
        })),
      };
    }
    case 'detener': {
      if (!enCurso(e)) return e;
      return {
        ...e,
        fase: 'abierta',
        tTotal: a.ahora - (e.tEnvio ?? a.ahora),
        historial: cortarEnCurso(e),
      };
    }
    case 'cerrar':
      return e.fase === 'cerrada'
        ? e
        : { ...e, historial: cortarEnCurso(e), fase: 'cerrada', agenteId: null, via: null };
  }
}
