/**
 * Contrato del módulo de agentes conversacionales (ADR 0007).
 * Lo comparten la lógica pura, el servidor local y la sala. No importa nada del navegador ni del SDK.
 */

/** Por qué una conversación no pudo seguir. Cada código tiene una frase en la voz del agente. */
export type CodigoError =
  'sin-clave' | 'sin-red' | 'limite' | 'cortada' | 'demasiado-largo' | 'vacio' | 'interno';

/** Un agente es un dato: todo lo configurable vive aquí, nada fijo en el código (valores iniciales parametrizables). */
export interface DefinicionAgente {
  id: string;
  nombre: string;
  rol: string;
  /** Marca los agentes de ejemplo (genéricos, para demostrar). */
  ejemplo?: boolean;
  /** Quién es y cómo piensa, en segunda persona («Eres…»). */
  personalidad: string;
  /** Cómo habla: registro, largo, muletillas. */
  tono: string;
  /** Primera línea cuando alguien se acerca. Es local: no llama al modelo. */
  saludo: string;
  /** Hechos de la sala (dónde está cada cosa, para qué sirve). */
  sabeDeLaSala: string[];
  /** Quién más está en el equipo. */
  sabeDelEquipo: { nombre: string; rol: string }[];
  /** Lo que NO hace y cómo lo dice. */
  limites: string[];
  modelo: string;
  /** Tope de tokens de salida por respuesta. */
  maxTokens: number;
  /** Mensajes que se guardan completos antes de resumir los más viejos. */
  memoriaMaxMensajes: number;
  /** Tope de caracteres de lo que escribe el usuario. */
  maxCaracteresEntrada: number;
  /** Frases por código de error, en su voz. Las que falten se generan con `frasesDeErrorPorDefecto`. */
  frasesError?: Partial<Record<CodigoError, string>>;
}

export interface Mensaje {
  rol: 'usuario' | 'agente';
  texto: string;
}

export interface Memoria {
  /** Lo anterior, comprimido de forma determinista (sin llamar al modelo). */
  resumen: string;
  mensajes: Mensaje[];
}

export interface Uso {
  entrada: number;
  salida: number;
  cacheLeida: number;
  cacheEscrita: number;
}

export interface UsoConversacion extends Uso {
  conversacionId: string;
  agenteId: string;
  /** Mensajes del usuario que llegaron al modelo (base para los créditos del ADR 0008; solo se mide). */
  mensajes: number;
  /** Llamadas al modelo (incluye las que fallaron tras salir). */
  llamadas: number;
}

/** Lo que el modelo recibe. El texto del usuario ya viene en cuarentena (ver `cuarentena.ts`). */
export interface MensajeModelo {
  role: 'user' | 'assistant';
  content: string;
}

export interface PeticionModelo {
  modelo: string;
  maxTokens: number;
  /** Bloque fijo y cacheable: personalidad, sala, equipo, límites, reglas de seguridad. */
  sistema: string;
  mensajes: MensajeModelo[];
  senal?: AbortSignal;
}

export type EventoModelo =
  { tipo: 'texto'; texto: string } | { tipo: 'fin'; motivo: 'completo' | 'tope'; uso: Uso };

/** Un proveedor falla lanzando `ErrorProveedor`; nada más sale de él. */
export class ErrorProveedor extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje?: string,
  ) {
    super(mensaje ?? codigo);
    this.name = 'ErrorProveedor';
  }
}

/** Dos implementaciones: Claude real (`claude.ts`) y un simulador determinista (`simulador.ts`). */
export interface Proveedor {
  transmitir(peticion: PeticionModelo): AsyncIterable<EventoModelo>;
}

/** Lo que el servidor y la sala ven de una respuesta. Nunca se lanza una excepción: los fallos son eventos. */
export type EventoRespuesta =
  | { tipo: 'inicio'; conversacionId: string; agenteId: string }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'fin'; motivo: 'completo' | 'tope'; uso: Uso }
  | { tipo: 'error'; codigo: CodigoError; /** Frase en la voz del agente. */ mensaje: string };

/** Contexto de la sala que viaja con cada mensaje (la parte variable del prompt, fuera del bloque cacheado). */
export interface ContextoMensaje {
  /** Nombre de quien escribe, si se sabe. */
  quien?: string;
  /** Cómo llegó: acercándose o mencionándolo desde lejos. */
  via?: 'cerca' | 'mencion';
}

export interface Conversacion {
  readonly id: string;
  readonly agente: DefinicionAgente;
  /** Cuarentena → memoria → proveedor → eventos. No lanza: los errores salen como evento `error` en la voz del agente. */
  enviar(
    texto: string,
    contexto?: ContextoMensaje,
    senal?: AbortSignal,
  ): AsyncIterable<EventoRespuesta>;
  uso(): UsoConversacion;
  memoria(): Memoria;
}

/**
 * Qué viaja por presencia (paso 4, sin implementar red): lo mínimo para que quien está cerca vea
 * que un agente conversa y con quién. Nunca el contenido de la conversación.
 */
export interface PresenciaConversacion {
  agenteId: string;
  /** Id de presencia de la persona con quien conversa. */
  conPersonaId: string;
  estado: 'escuchando' | 'pensando' | 'respondiendo';
  /** Marca de tiempo (ms) del último cambio, para expirar indicadores huérfanos. */
  desde: number;
}
