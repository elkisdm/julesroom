import { describe, expect, it } from 'vitest';
import type { EventoRespuesta } from '@oficina/agentes';
import { enviarMensaje, leerEventos, listarAgentes, salud } from './cliente';

const codificar = (s: string) => new TextEncoder().encode(s);

function respuestaDeTrozos(trozos: Uint8Array[], init: ResponseInit = { status: 200 }): Response {
  let i = 0;
  const cuerpo = new ReadableStream<Uint8Array>({
    pull(c) {
      const t = trozos[i++];
      if (t) c.enqueue(t);
      else c.close();
    },
  });
  return new Response(cuerpo, init);
}

async function recoger<T>(it: AsyncIterable<T>): Promise<T[]> {
  const fuera: T[] = [];
  for await (const e of it) fuera.push(e);
  return fuera;
}

const sse = (e: EventoRespuesta) => `data: ${JSON.stringify(e)}\n\n`;
const INICIO: EventoRespuesta = { tipo: 'inicio', conversacionId: 'c', agenteId: 'a' };
const TEXTO: EventoRespuesta = { tipo: 'texto', texto: 'Hola, ¿qué tal? ñandú 🙂' };
const FIN: EventoRespuesta = {
  tipo: 'fin',
  motivo: 'completo',
  uso: { entrada: 10, salida: 5, cacheLeida: 8, cacheEscrita: 0 },
};

describe('leerEventos', () => {
  it('parsea eventos completos', async () => {
    const r = respuestaDeTrozos([codificar(sse(INICIO) + sse(TEXTO) + sse(FIN))]);
    expect(await recoger(leerEventos(r))).toEqual([INICIO, TEXTO, FIN]);
  });

  it('tolera trozos partidos en cualquier byte, incluido UTF-8 a medias', async () => {
    const bytes = codificar(sse(INICIO) + sse(TEXTO) + sse(FIN));
    const trozos = Array.from(bytes, (b) => Uint8Array.of(b));
    expect(await recoger(leerEventos(respuestaDeTrozos(trozos)))).toEqual([INICIO, TEXTO, FIN]);
  });

  it('ignora líneas vacías, comentarios y JSON inválido', async () => {
    const r = respuestaDeTrozos([
      codificar(
        `\n\n: latido\n\n${sse(INICIO)}data: {roto\n\ndata: {"tipo":"otro"}\n\n\n${sse(FIN)}`,
      ),
    ]);
    expect(await recoger(leerEventos(r))).toEqual([INICIO, FIN]);
  });

  it('acepta CRLF y un último evento sin línea en blanco final', async () => {
    const r = respuestaDeTrozos([
      codificar(`data: ${JSON.stringify(INICIO)}\r\n\r\ndata: ${JSON.stringify(FIN)}`),
    ]);
    expect(await recoger(leerEventos(r))).toEqual([INICIO, FIN]);
  });

  it('una respuesta sin cuerpo no emite nada', async () => {
    expect(await recoger(leerEventos(new Response(null, { status: 200 })))).toEqual([]);
  });
});

describe('enviarMensaje', () => {
  const base = { agenteId: 'analista', conversacionId: 'abc', texto: 'hola' };
  const frasesLocales = { 'sin-red': 'Dato perdió la conexión.', cortada: 'Dato perdió el hilo.' };

  it('hace POST con el cuerpo del protocolo y devuelve los eventos', async () => {
    let visto: { url: string; init?: RequestInit } | null = null;
    const fetchFalso = (async (url: string, init?: RequestInit) => {
      visto = { url, init };
      return respuestaDeTrozos([codificar(sse(INICIO) + sse(TEXTO) + sse(FIN))]);
    }) as unknown as typeof fetch;
    const eventos = await recoger(
      enviarMensaje({ ...base, quien: 'Tú', via: 'cerca', fetch: fetchFalso }),
    );
    expect(eventos.map((e) => e.tipo)).toEqual(['inicio', 'texto', 'fin']);
    expect(visto).not.toBeNull();
    const v = visto as unknown as { url: string; init: RequestInit };
    expect(v.url).toBe('/api/agentes/analista/mensaje');
    expect(v.init.method).toBe('POST');
    expect(JSON.parse(v.init.body as string)).toEqual({
      conversacionId: 'abc',
      texto: 'hola',
      quien: 'Tú',
      via: 'cerca',
    });
  });

  it('emite el evento error del servidor cuando el estado no es 200', async () => {
    const error: EventoRespuesta = {
      tipo: 'error',
      codigo: 'limite',
      mensaje: 'Dato: mucha gente.',
    };
    const fetchFalso = (async () =>
      new Response(JSON.stringify(error), { status: 429 })) as unknown as typeof fetch;
    expect(await recoger(enviarMensaje({ ...base, fetch: fetchFalso }))).toEqual([error]);
  });

  it('con un estado de error sin cuerpo útil usa la frase local por estado', async () => {
    const fetchFalso = (async () =>
      new Response('no es json', { status: 413 })) as unknown as typeof fetch;
    const eventos = await recoger(
      enviarMensaje({
        ...base,
        fetch: fetchFalso,
        frasesLocales: { 'demasiado-largo': 'Es demasiado.' },
      }),
    );
    expect(eventos).toEqual([
      { tipo: 'error', codigo: 'demasiado-largo', mensaje: 'Es demasiado.' },
    ]);
  });

  it('sin red emite error sin-red con la frase local', async () => {
    const fetchFalso = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await recoger(enviarMensaje({ ...base, fetch: fetchFalso, frasesLocales }))).toEqual([
      { tipo: 'error', codigo: 'sin-red', mensaje: 'Dato perdió la conexión.' },
    ]);
  });

  it('sin frases locales usa una frase genérica digna', async () => {
    const fetchFalso = (async () => {
      throw new TypeError('x');
    }) as unknown as typeof fetch;
    const [e] = await recoger(enviarMensaje({ ...base, fetch: fetchFalso }));
    expect(e?.tipo === 'error' && e.mensaje.length > 10).toBe(true);
  });

  it('un flujo que termina sin fin ni error se marca como cortada y conserva lo recibido', async () => {
    const fetchFalso = (async () =>
      respuestaDeTrozos([codificar(sse(INICIO) + sse(TEXTO))])) as unknown as typeof fetch;
    const eventos = await recoger(enviarMensaje({ ...base, fetch: fetchFalso, frasesLocales }));
    expect(eventos.map((e) => e.tipo)).toEqual(['inicio', 'texto', 'error']);
    expect(eventos[2]).toMatchObject({ codigo: 'cortada', mensaje: 'Dato perdió el hilo.' });
  });

  it('si se aborta, termina en silencio', async () => {
    const control = new AbortController();
    const fetchFalso = (async () => {
      control.abort();
      throw new DOMException('abortado', 'AbortError');
    }) as unknown as typeof fetch;
    expect(
      await recoger(enviarMensaje({ ...base, fetch: fetchFalso, senal: control.signal })),
    ).toEqual([]);
  });
});

describe('listarAgentes y salud', () => {
  it('leen el JSON del servidor', async () => {
    const lista = [{ id: 'a', nombre: 'Dato', rol: 'x', ejemplo: true, saludo: 'hola' }];
    const f1 = (async () => new Response(JSON.stringify(lista))) as unknown as typeof fetch;
    const f2 = (async () =>
      new Response(
        JSON.stringify({ ok: true, clave: false, modelo: 'm' }),
      )) as unknown as typeof fetch;
    expect(await listarAgentes(f1)).toEqual(lista);
    expect(await salud(f2)).toEqual({ ok: true, clave: false, modelo: 'm' });
  });

  it('lanzan si el servidor responde mal', async () => {
    const f = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    await expect(listarAgentes(f)).rejects.toThrow();
    await expect(salud(f)).rejects.toThrow();
  });
});
