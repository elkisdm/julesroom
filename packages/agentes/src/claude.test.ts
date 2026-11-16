import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { crearProveedorClaude, type ClienteClaude } from './claude';
import { ErrorProveedor, type EventoModelo, type PeticionModelo } from './tipos';

const peticion = (senal?: AbortSignal): PeticionModelo => ({
  modelo: 'claude-haiku-5-5',
  maxTokens: 300,
  sistema: 'Eres Dato, analista.',
  mensajes: [{ role: 'user', content: '<mensaje_usuario>hola</mensaje_usuario>' }],
  senal,
});

const inicio = (usage = {}) => ({
  type: 'message_start',
  message: {
    usage: {
      input_tokens: 12,
      output_tokens: 1,
      cache_read_input_tokens: 100,
      cache_creation_input_tokens: 0,
      ...usage,
    },
  },
});
const delta = (text: string) => ({
  type: 'content_block_delta',
  index: 0,
  delta: { type: 'text_delta', text },
});
const fin = (stop_reason: string, output_tokens = 7) => ({
  type: 'message_delta',
  delta: { stop_reason },
  usage: { output_tokens, input_tokens: null },
});

interface Llamada {
  params: Record<string, unknown>;
  opciones: { signal: AbortSignal };
}

function clienteCon(eventos: (signal: AbortSignal) => AsyncIterable<unknown>) {
  const llamadas: Llamada[] = [];
  const cliente = {
    messages: {
      stream(params: Record<string, unknown>, opciones: { signal: AbortSignal }) {
        llamadas.push({ params, opciones });
        return eventos(opciones.signal);
      },
    },
  } as unknown as ClienteClaude;
  return { cliente, llamadas };
}

const lista = (...es: unknown[]) =>
  (async function* () {
    for (const e of es) yield e;
  })();

async function correr(it: AsyncIterable<EventoModelo>) {
  const eventos: EventoModelo[] = [];
  try {
    for await (const e of it) eventos.push(e);
  } catch (e) {
    return { eventos, error: e };
  }
  return { eventos, error: undefined };
}

describe('proveedor Claude: petición', () => {
  it('manda system con cache_control, thinking disabled y sin temperature', async () => {
    const { cliente, llamadas } = clienteCon(() => lista(inicio(), delta('hola'), fin('end_turn')));
    await correr(crearProveedorClaude({ clave: 'k', cliente }).transmitir(peticion()));
    expect(llamadas).toHaveLength(1);
    const { params } = llamadas[0]!;
    expect(params).toEqual({
      model: 'claude-haiku-5-5',
      max_tokens: 300,
      system: [
        { type: 'text', text: 'Eres Dato, analista.', cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: '<mensaje_usuario>hola</mensaje_usuario>' }],
      thinking: { type: 'disabled' },
    });
    expect(params).not.toHaveProperty('temperature');
  });
});

describe('proveedor Claude: eventos', () => {
  it('emite texto por cada text_delta y un fin con el uso', async () => {
    const { cliente } = clienteCon(() =>
      lista(
        inicio(),
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        delta('Ho'),
        { type: 'content_block_delta', index: 0, delta: { type: 'otra_cosa' } },
        delta('la'),
        { type: 'content_block_stop', index: 0 },
        fin('end_turn', 9),
        { type: 'message_stop' },
      ),
    );
    const { eventos, error } = await correr(
      crearProveedorClaude({ clave: 'k', cliente }).transmitir(peticion()),
    );
    expect(error).toBeUndefined();
    expect(eventos).toEqual([
      { tipo: 'texto', texto: 'Ho' },
      { tipo: 'texto', texto: 'la' },
      {
        tipo: 'fin',
        motivo: 'completo',
        uso: { entrada: 12, salida: 9, cacheLeida: 100, cacheEscrita: 0 },
      },
    ]);
  });

  it('stop_reason max_tokens → motivo tope', async () => {
    const { cliente } = clienteCon(() => lista(inicio(), delta('x'), fin('max_tokens')));
    const { eventos } = await correr(
      crearProveedorClaude({ clave: 'k', cliente }).transmitir(peticion()),
    );
    expect(eventos.at(-1)).toMatchObject({ tipo: 'fin', motivo: 'tope' });
  });

  it('el uso del message_delta pisa al de message_start cuando no es null', async () => {
    const { cliente } = clienteCon(() =>
      lista(inicio(), delta('x'), {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: {
          output_tokens: 3,
          input_tokens: 20,
          cache_read_input_tokens: 5,
          cache_creation_input_tokens: 6,
        },
      }),
    );
    const { eventos } = await correr(
      crearProveedorClaude({ clave: 'k', cliente }).transmitir(peticion()),
    );
    expect(eventos.at(-1)).toMatchObject({
      uso: { entrada: 20, salida: 3, cacheLeida: 5, cacheEscrita: 6 },
    });
  });
});

describe('proveedor Claude: errores', () => {
  const headers = new Headers();
  const fallaCon = (e: unknown, antes: unknown[] = []) =>
    clienteCon(() =>
      (async function* () {
        for (const a of antes) yield a;
        throw e;
      })(),
    ).cliente;

  it.each([
    ['401', new AuthenticationError(401, {}, 'x', headers), 'sin-clave'],
    ['403', new PermissionDeniedError(403, {}, 'x', headers), 'sin-clave'],
    ['429', new RateLimitError(429, {}, 'x', headers), 'limite'],
    ['conexión', new APIConnectionError({ message: 'x' }), 'sin-red'],
    ['timeout del SDK', new APIConnectionTimeoutError(), 'sin-red'],
    ['500', new InternalServerError(500, {}, 'x', headers), 'interno'],
    ['desconocido', new Error('boom'), 'interno'],
  ])('%s → %s', async (_n, e, codigo) => {
    const { error, eventos } = await correr(
      crearProveedorClaude({ clave: 'k', cliente: fallaCon(e) }).transmitir(peticion()),
    );
    expect(error).toBeInstanceOf(ErrorProveedor);
    expect((error as ErrorProveedor).codigo).toBe(codigo);
    expect(eventos).toEqual([]);
  });

  it('un mensaje de error del SDK no se filtra en el ErrorProveedor', async () => {
    const e = new AuthenticationError(
      401,
      {},
      'invalid x-api-key ' + 'sk-' + 'ant-secreta',
      headers,
    );
    const { error } = await correr(
      crearProveedorClaude({ clave: 'k', cliente: fallaCon(e) }).transmitir(peticion()),
    );
    expect((error as Error).message).not.toContain('secreta');
  });

  it('un corte tras haber emitido texto → cortada', async () => {
    const cliente = fallaCon(new APIConnectionError({ message: 'x' }), [
      inicio(),
      delta('a medias'),
    ]);
    const { error, eventos } = await correr(
      crearProveedorClaude({ clave: 'k', cliente }).transmitir(peticion()),
    );
    expect(eventos).toEqual([{ tipo: 'texto', texto: 'a medias' }]);
    expect((error as ErrorProveedor).codigo).toBe('cortada');
  });

  it('un stream que termina sin stop_reason → cortada', async () => {
    const { cliente } = clienteCon(() => lista(inicio(), delta('hola')));
    const { error } = await correr(
      crearProveedorClaude({ clave: 'k', cliente }).transmitir(peticion()),
    );
    expect((error as ErrorProveedor).codigo).toBe('cortada');
  });

  it('sin clave → sin-clave, sin crear cliente ni llamar a la red', async () => {
    for (const clave of ['', '   ', undefined]) {
      const { error } = await correr(crearProveedorClaude({ clave }).transmitir(peticion()));
      expect((error as ErrorProveedor).codigo).toBe('sin-clave');
    }
  });

  it('un aborto del llamador → cortada', async () => {
    const ctl = new AbortController();
    const { cliente } = clienteCon((signal) =>
      (async function* () {
        yield inicio();
        yield delta('uno');
        await new Promise((_r, rechazar) => {
          if (signal.aborted) rechazar(new APIUserAbortError());
          signal.addEventListener('abort', () => rechazar(new APIUserAbortError()));
        });
      })(),
    );
    const eventos: EventoModelo[] = [];
    const correr2 = async () => {
      for await (const e of crearProveedorClaude({ clave: 'k', cliente }).transmitir(
        peticion(ctl.signal),
      )) {
        eventos.push(e);
        ctl.abort();
      }
    };
    await expect(correr2()).rejects.toMatchObject({ codigo: 'cortada' });
    expect(eventos).toHaveLength(1);
  });

  it('un aborto previo → cortada sin llamar al cliente', async () => {
    const ctl = new AbortController();
    ctl.abort();
    const { cliente, llamadas } = clienteCon(() => lista());
    const { error } = await correr(
      crearProveedorClaude({ clave: 'k', cliente }).transmitir(peticion(ctl.signal)),
    );
    expect((error as ErrorProveedor).codigo).toBe('cortada');
    expect(llamadas).toHaveLength(0);
  });
});

describe('proveedor Claude: timeout al primer byte', () => {
  const colgado = () =>
    clienteCon((signal) =>
      (async function* () {
        await new Promise((_r, rechazar) =>
          signal.addEventListener('abort', () => rechazar(new APIUserAbortError())),
        );
        yield 1;
      })(),
    );

  it('si no llega nada a tiempo → sin-red', async () => {
    const { cliente } = colgado();
    const { error } = await correr(
      crearProveedorClaude({ clave: 'k', cliente, primerByteMs: 20 }).transmitir(peticion()),
    );
    expect((error as ErrorProveedor).codigo).toBe('sin-red');
  });

  it('el valor inicial es de 15 s y se puede cambiar', async () => {
    const { CONFIG_CLAUDE } = await import('./claude');
    expect(CONFIG_CLAUDE.primerByteMs).toBe(15000);
  });

  it('una vez llegado el primer evento ya no vence', async () => {
    const { cliente } = clienteCon(() =>
      (async function* () {
        yield inicio();
        await new Promise((r) => setTimeout(r, 60));
        yield delta('tarde pero llega');
        yield fin('end_turn');
      })(),
    );
    const { eventos, error } = await correr(
      crearProveedorClaude({ clave: 'k', cliente, primerByteMs: 20 }).transmitir(peticion()),
    );
    expect(error).toBeUndefined();
    expect(eventos[0]).toEqual({ tipo: 'texto', texto: 'tarde pero llega' });
  });
});
