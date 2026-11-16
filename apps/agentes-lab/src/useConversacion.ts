/** Orquesta una conversación: abre, envía por la red, aborta y alimenta el almacén con los eventos. */
import { useMemo, useRef } from 'react';
import { frasesDeErrorPorDefecto } from '@oficina/agentes';
import type { DefinicionAgente } from '@oficina/agentes';
import { enviarMensaje } from './cliente';
import { enCurso, idAleatorio } from './estadoConversacion';
import type { EstadoConversacion, Via } from './estadoConversacion';
import type { Almacen } from './almacen';

export interface Medicion {
  agenteId: string;
  tPrimeraPalabraMs: number | null;
  tTotalMs: number | null;
  tokensEntrada: number;
  tokensSalida: number;
  cacheLeida: number;
}

export interface Conversador {
  abrir(agenteId: string, via: Via): void;
  cerrar(): void;
  /** Envía `texto` al agente abierto; la promesa se resuelve al terminar el turno. */
  enviar(texto: string): Promise<void>;
  reintentar(): Promise<void>;
  detener(): void;
  ultimaMedicion(): Medicion | null;
}

export function useConversacion(
  almacen: Almacen,
  definiciones: readonly DefinicionAgente[],
  quien = 'Tú',
): Conversador {
  const control = useRef<AbortController | null>(null);
  const medicion = useRef<Medicion | null>(null);

  return useMemo(() => {
    const abortar = () => {
      control.current?.abort();
      control.current = null;
    };

    /** Lanza la petición del turno que el almacén ya dejó en `pensando`. */
    async function turno(texto: string): Promise<void> {
      const e: EstadoConversacion = almacen.leer();
      const def = definiciones.find((d) => d.id === e.agenteId);
      const conversacionId = e.agenteId ? e.conversaciones[e.agenteId] : undefined;
      if (!def || !conversacionId || !enCurso(e)) return;
      abortar();
      const controlador = new AbortController();
      control.current = controlador;
      const eventos = enviarMensaje({
        agenteId: def.id,
        conversacionId,
        texto,
        quien,
        via: e.via ?? 'cerca',
        senal: controlador.signal,
        frasesLocales: { ...frasesDeErrorPorDefecto(def), ...def.frasesError },
      });
      for await (const ev of eventos) {
        if (controlador.signal.aborted) break;
        const ahora = performance.now();
        if (ev.tipo === 'texto') almacen.despachar({ tipo: 'llegoTexto', trozo: ev.texto, ahora });
        else if (ev.tipo === 'fin') {
          almacen.despachar({ tipo: 'llegoFin', uso: ev.uso, ahora });
          const s = almacen.leer();
          medicion.current = {
            agenteId: def.id,
            tPrimeraPalabraMs: s.tPrimeraPalabra,
            tTotalMs: s.tTotal,
            tokensEntrada: ev.uso.entrada,
            tokensSalida: ev.uso.salida,
            cacheLeida: ev.uso.cacheLeida,
          };
        } else if (ev.tipo === 'error')
          almacen.despachar({ tipo: 'llegoError', evento: ev, ahora });
      }
      if (control.current === controlador) control.current = null;
    }

    return {
      abrir(agenteId, via) {
        if (almacen.leer().agenteId !== agenteId) abortar();
        almacen.despachar({ tipo: 'abrir', agenteId, via, idNuevo: idAleatorio() });
      },
      cerrar() {
        abortar();
        almacen.despachar({ tipo: 'cerrar' });
      },
      async enviar(texto) {
        abortar();
        almacen.despachar({ tipo: 'enviar', texto, ahora: performance.now() });
        await turno(texto.trim());
      },
      async reintentar() {
        const e = almacen.leer();
        const ultimo = e.agenteId ? e.historial[e.agenteId]?.at(-1) : undefined;
        if (!ultimo) return;
        almacen.despachar({ tipo: 'reintentar', ahora: performance.now() });
        await turno(ultimo.usuario);
      },
      detener() {
        abortar();
        almacen.despachar({ tipo: 'detener', ahora: performance.now() });
      },
      ultimaMedicion: () => medicion.current,
    };
  }, [almacen, definiciones, quien]);
}
