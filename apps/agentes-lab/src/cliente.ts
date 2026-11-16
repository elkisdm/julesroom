/** Cliente del servidor local de agentes (`/api`, proxy de Vite → 8791). Lógica pura: no toca la interfaz. */
import type { CodigoError, EventoRespuesta } from '@oficina/agentes';

type Fetch = typeof fetch;

const TIPOS = new Set(['inicio', 'texto', 'fin', 'error']);

function parsearEvento(json: string): EventoRespuesta | null {
  try {
    const dato: unknown = JSON.parse(json);
    if (
      typeof dato === 'object' &&
      dato !== null &&
      TIPOS.has((dato as { tipo?: string }).tipo ?? '')
    ) {
      return dato as EventoRespuesta;
    }
  } catch {
    // Una línea que no es JSON se ignora: el resto del flujo sigue valiendo.
  }
  return null;
}

/** Los datos de un bloque SSE (`data: …` de varias líneas se unen con salto de línea). */
function datosDeBloque(bloque: string): string | null {
  const datos: string[] = [];
  for (const linea of bloque.split('\n')) {
    if (linea.startsWith('data:')) datos.push(linea.slice(linea.startsWith('data: ') ? 6 : 5));
  }
  return datos.length > 0 ? datos.join('\n') : null;
}

/**
 * Eventos de una respuesta SSE (`data: {json}` separados por línea en blanco). Tolera trozos partidos en
 * cualquier byte (también a mitad de un carácter UTF-8), líneas vacías, comentarios y JSON inválido.
 */
export async function* leerEventos(respuesta: Response): AsyncGenerator<EventoRespuesta> {
  if (!respuesta.body) return;
  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder('utf-8');
  let pendiente = '';
  const sacar = function* (final: boolean): Generator<EventoRespuesta> {
    pendiente = pendiente.replace(/\r\n?/g, '\n');
    let corte: number;
    while ((corte = pendiente.indexOf('\n\n')) >= 0) {
      const datos = datosDeBloque(pendiente.slice(0, corte));
      pendiente = pendiente.slice(corte + 2);
      const evento = datos === null ? null : parsearEvento(datos);
      if (evento) yield evento;
    }
    if (final && pendiente.trim() !== '') {
      const datos = datosDeBloque(pendiente);
      pendiente = '';
      const evento = datos === null ? null : parsearEvento(datos);
      if (evento) yield evento;
    }
  };
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      pendiente += decodificador.decode(value, { stream: true });
      yield* sacar(false);
    }
    pendiente += decodificador.decode();
    yield* sacar(true);
  } finally {
    lector.releaseLock();
  }
}

/** Frase digna cuando el cliente no puede preguntarle al servidor (la voz del agente la pone quien llama). */
const FRASE_GENERICA = 'No pude responder ahora. Inténtalo de nuevo en un momento.';

export interface PeticionMensaje {
  agenteId: string;
  conversacionId: string;
  texto: string;
  quien?: string;
  via?: 'cerca' | 'mencion';
  senal?: AbortSignal;
  fetch?: Fetch;
  /** Frases por código en la voz del agente (`frasesDeErrorPorDefecto`). */
  frasesLocales?: Partial<Record<CodigoError, string>>;
}

const CODIGO_POR_ESTADO: Record<number, CodigoError> = {
  400: 'vacio',
  413: 'demasiado-largo',
  429: 'limite',
};

const errorEvento = (
  codigo: CodigoError,
  frases: PeticionMensaje['frasesLocales'],
): EventoRespuesta => ({ tipo: 'error', codigo, mensaje: frases?.[codigo] ?? FRASE_GENERICA });

/**
 * `POST /api/agentes/:id/mensaje` y los eventos de la respuesta. Nunca lanza: un fallo de red, un estado
 * HTTP de error o un flujo cortado salen como evento `error`. Si `senal` se aborta, termina en silencio.
 */
export async function* enviarMensaje(p: PeticionMensaje): AsyncGenerator<EventoRespuesta> {
  const llamar = p.fetch ?? ((...a: Parameters<Fetch>) => fetch(...a));
  let respuesta: Response;
  try {
    respuesta = await llamar(`/api/agentes/${encodeURIComponent(p.agenteId)}/mensaje`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({
        conversacionId: p.conversacionId,
        texto: p.texto,
        quien: p.quien,
        via: p.via,
      }),
      signal: p.senal,
    });
  } catch {
    if (!p.senal?.aborted) yield errorEvento('sin-red', p.frasesLocales);
    return;
  }

  if (respuesta.status !== 200) {
    // El servidor responde un evento `error` como JSON plano (o, por si acaso, como SSE).
    let delServidor: EventoRespuesta | null = null;
    try {
      const texto = await respuesta.text();
      delServidor = parsearEvento(texto) ?? parsearEvento(datosDeBloque(texto) ?? '');
    } catch {
      // Cuerpo ilegible: se cae a la frase local por estado.
    }
    yield delServidor?.tipo === 'error'
      ? delServidor
      : errorEvento(CODIGO_POR_ESTADO[respuesta.status] ?? 'interno', p.frasesLocales);
    return;
  }

  let terminado = false;
  try {
    for await (const e of leerEventos(respuesta)) {
      if (e.tipo === 'fin' || e.tipo === 'error') terminado = true;
      yield e;
    }
  } catch {
    if (p.senal?.aborted) return;
    yield errorEvento('sin-red', p.frasesLocales);
    return;
  }
  if (!terminado && !p.senal?.aborted) yield errorEvento('cortada', p.frasesLocales);
}

export interface AgenteListado {
  id: string;
  nombre: string;
  rol: string;
  ejemplo: boolean;
  saludo: string;
}

/** `GET /api/agentes`. Lanza si el servidor no responde o responde mal. */
export async function listarAgentes(
  llamar: Fetch = (...a) => fetch(...a),
): Promise<AgenteListado[]> {
  const r = await llamar('/api/agentes');
  if (!r.ok) throw new Error(`GET /api/agentes respondió ${r.status}`);
  return (await r.json()) as AgenteListado[];
}

export interface Salud {
  ok: boolean;
  clave: boolean;
  modelo: string;
}

/** `GET /api/salud`. Lanza si el servidor no responde o responde mal. */
export async function salud(llamar: Fetch = (...a) => fetch(...a)): Promise<Salud> {
  const r = await llamar('/api/salud');
  if (!r.ok) throw new Error(`GET /api/salud respondió ${r.status}`);
  return (await r.json()) as Salud;
}
