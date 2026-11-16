/**
 * Proveedor Claude real. Importa el SDK: solo corre en el servidor (subruta `@oficina/agentes/claude`,
 * fuera de `index.ts`). La clave llega por parámetro; aquí nunca se lee de `process.env`.
 */
import Anthropic, {
  APIConnectionError,
  APIUserAbortError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import type { MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';
import {
  ErrorProveedor,
  type EventoModelo,
  type PeticionModelo,
  type Proveedor,
  type Uso,
} from './tipos';

export const CONFIG_CLAUDE = {
  /** Tiempo máximo hasta el primer evento del stream; pasado, se considera sin red. */
  primerByteMs: 15000,
  /** Reintentos automáticos del SDK: 0, para que el error llegue enseguida a la voz del agente. */
  maxReintentos: 0,
};

/** Lo mínimo del cliente del SDK que usamos; permite inyectar uno falso en las pruebas. */
export interface ClienteClaude {
  messages: {
    stream(
      params: {
        model: string;
        max_tokens: number;
        system: { type: 'text'; text: string; cache_control: { type: 'ephemeral' } }[];
        messages: { role: 'user' | 'assistant'; content: string }[];
        thinking: { type: 'disabled' };
      },
      opciones: { signal: AbortSignal },
    ): AsyncIterable<MessageStreamEvent>;
  };
}

export interface OpcionesClaude {
  clave: string | undefined;
  cliente?: ClienteClaude;
  primerByteMs?: number;
}

function traducir(e: unknown, huboTexto: boolean, venciaPrimerByte: boolean): ErrorProveedor {
  if (e instanceof ErrorProveedor) return e;
  if (venciaPrimerByte) return new ErrorProveedor('sin-red');
  if (e instanceof AuthenticationError || e instanceof PermissionDeniedError)
    return new ErrorProveedor('sin-clave');
  if (e instanceof RateLimitError) return new ErrorProveedor('limite');
  if (e instanceof APIUserAbortError) return new ErrorProveedor('cortada');
  if (huboTexto) return new ErrorProveedor('cortada');
  if (e instanceof APIConnectionError) return new ErrorProveedor('sin-red');
  return new ErrorProveedor('interno');
}

export function crearProveedorClaude(opciones: OpcionesClaude): Proveedor {
  const primerByteMs = opciones.primerByteMs ?? CONFIG_CLAUDE.primerByteMs;
  let cliente = opciones.cliente;
  const obtenerCliente = (): ClienteClaude => {
    cliente ??= new Anthropic({ apiKey: opciones.clave, maxRetries: CONFIG_CLAUDE.maxReintentos });
    return cliente;
  };

  return {
    async *transmitir(peticion: PeticionModelo): AsyncGenerator<EventoModelo> {
      if (!opciones.cliente && !opciones.clave?.trim()) throw new ErrorProveedor('sin-clave');
      if (peticion.senal?.aborted) throw new ErrorProveedor('cortada');

      const control = new AbortController();
      const abortar = () => control.abort();
      peticion.senal?.addEventListener('abort', abortar, { once: true });
      let vencio = false;
      let temporizador: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
        vencio = true;
        control.abort();
      }, primerByteMs);
      const llegoAlgo = () => {
        clearTimeout(temporizador);
        temporizador = undefined;
      };

      const uso: Uso = { entrada: 0, salida: 0, cacheLeida: 0, cacheEscrita: 0 };
      let huboTexto = false;
      let motivo: 'completo' | 'tope' | undefined;
      try {
        const stream = obtenerCliente().messages.stream(
          {
            model: peticion.modelo,
            max_tokens: peticion.maxTokens,
            system: [
              { type: 'text', text: peticion.sistema, cache_control: { type: 'ephemeral' } },
            ],
            messages: peticion.mensajes,
            thinking: { type: 'disabled' },
          },
          { signal: control.signal },
        );
        for await (const evento of stream) {
          llegoAlgo();
          if (evento.type === 'message_start') {
            const u = evento.message.usage;
            uso.entrada = u.input_tokens;
            uso.salida = u.output_tokens;
            uso.cacheLeida = u.cache_read_input_tokens ?? 0;
            uso.cacheEscrita = u.cache_creation_input_tokens ?? 0;
          } else if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta') {
            if (evento.delta.text === '') continue;
            huboTexto = true;
            yield { tipo: 'texto', texto: evento.delta.text };
          } else if (evento.type === 'message_delta') {
            const u = evento.usage;
            uso.salida = u.output_tokens;
            uso.entrada = u.input_tokens ?? uso.entrada;
            uso.cacheLeida = u.cache_read_input_tokens ?? uso.cacheLeida;
            uso.cacheEscrita = u.cache_creation_input_tokens ?? uso.cacheEscrita;
            if (evento.delta.stop_reason)
              motivo = evento.delta.stop_reason === 'max_tokens' ? 'tope' : 'completo';
          }
        }
        if (!motivo) throw new ErrorProveedor('cortada');
        yield { tipo: 'fin', motivo, uso };
      } catch (e) {
        throw traducir(e, huboTexto, vencio);
      } finally {
        llegoAlgo();
        peticion.senal?.removeEventListener('abort', abortar);
      }
    },
  };
}
