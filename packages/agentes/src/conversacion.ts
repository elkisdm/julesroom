import { limpiarEntrada } from './cuarentena';
import { fraseDeError } from './errores';
import { agregar, aMensajesModelo, crearMemoria } from './memoria';
import { construirSistema, envolverMensaje } from './prompt';
import {
  ErrorProveedor,
  type CodigoError,
  type ContextoMensaje,
  type Conversacion,
  type DefinicionAgente,
  type EventoRespuesta,
  type Memoria,
  type Proveedor,
  type UsoConversacion,
} from './tipos';

export const CONFIG_CONVERSACION = {
  /** Una entrada de más de este múltiplo del tope se rechaza en vez de recortarse. */
  factorRechazo: 4,
  marcadorCortada: '[cortada]',
};

export interface OpcionesConversacion {
  def: DefinicionAgente;
  proveedor: Proveedor;
  id?: string;
  generarId?: () => string;
  /** Contexto por defecto de cada mensaje (el de `enviar` lo pisa campo a campo). */
  contexto?: ContextoMensaje;
}

export function crearConversacion(opciones: OpcionesConversacion): Conversacion {
  const { def, proveedor } = opciones;
  const id = opciones.id ?? opciones.generarId?.() ?? globalThis.crypto.randomUUID();
  const sistema = construirSistema(def);
  let memoria: Memoria = crearMemoria();
  let ocupada = false;
  const uso: UsoConversacion = {
    conversacionId: id,
    agenteId: def.id,
    entrada: 0,
    salida: 0,
    cacheLeida: 0,
    cacheEscrita: 0,
    mensajes: 0,
    llamadas: 0,
  };

  const error = (codigo: CodigoError): EventoRespuesta => ({
    tipo: 'error',
    codigo,
    mensaje: fraseDeError(def, codigo),
  });

  async function* enviar(
    texto: string,
    contexto?: ContextoMensaje,
    senal?: AbortSignal,
  ): AsyncGenerator<EventoRespuesta> {
    if (ocupada) {
      yield error('limite');
      return;
    }
    ocupada = true;
    try {
      if (texto.length > def.maxCaracteresEntrada * CONFIG_CONVERSACION.factorRechazo) {
        yield error('demasiado-largo');
        return;
      }
      const limpia = limpiarEntrada(texto, def.maxCaracteresEntrada);
      if (limpia.texto === '') {
        yield error('vacio');
        return;
      }
      memoria = agregar(
        memoria,
        {
          rol: 'usuario',
          texto: envolverMensaje(limpia.texto, limpia.sospechosa, {
            ...opciones.contexto,
            ...contexto,
          }),
        },
        def.memoriaMaxMensajes,
      );
      uso.mensajes += 1;
      uso.llamadas += 1;

      let recibido = '';
      let terminoBien = false;
      try {
        yield { tipo: 'inicio', conversacionId: id, agenteId: def.id };
        for await (const e of proveedor.transmitir({
          modelo: def.modelo,
          maxTokens: def.maxTokens,
          sistema,
          mensajes: aMensajesModelo(memoria),
          senal,
        })) {
          if (e.tipo === 'texto') {
            recibido += e.texto;
            yield e;
          } else {
            uso.entrada += e.uso.entrada;
            uso.salida += e.uso.salida;
            uso.cacheLeida += e.uso.cacheLeida;
            uso.cacheEscrita += e.uso.cacheEscrita;
            terminoBien = true;
            memoria = agregar(memoria, { rol: 'agente', texto: recibido }, def.memoriaMaxMensajes);
            yield e;
          }
        }
        if (!terminoBien) throw new ErrorProveedor('cortada');
      } catch (e) {
        // Tras el `fin` la respuesta ya está entregada y guardada: un fallo tardío no la invalida.
        if (terminoBien) return;
        if (recibido !== '') {
          memoria = agregar(
            memoria,
            { rol: 'agente', texto: `${recibido} ${CONFIG_CONVERSACION.marcadorCortada}` },
            def.memoriaMaxMensajes,
          );
        }
        yield error(e instanceof ErrorProveedor ? e.codigo : 'interno');
      }
    } finally {
      ocupada = false;
    }
  }

  return {
    id,
    agente: def,
    enviar,
    uso: () => ({ ...uso }),
    memoria: () => memoria,
  };
}
