import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { OficinaProps } from '@oficina/motor';
import { crearAlmacen } from './almacen';
import type { Almacen } from './almacen';
import { estadoInicial } from './estadoConversacion';
import type { EstadoConversacion, Fase } from './estadoConversacion';
import { Escena } from './Escena';

let recibidas: OficinaProps;
vi.mock('@oficina/motor', () => ({
  Oficina: (props: OficinaProps) => {
    recibidas = props;
    return null;
  },
}));
vi.mock('./almacen', async (original) => ({
  ...(await original<typeof import('./almacen')>()),
  useAlmacen: <T>(almacen: Almacen, selector: (e: EstadoConversacion) => T) =>
    selector(almacen.leer()),
}));

function dibujar(fase: Fase) {
  const almacen = crearAlmacen({
    ...estadoInicial,
    fase,
    agenteId: fase === 'cerrada' ? null : 'a',
  });
  const accionesExtra: NonNullable<OficinaProps['accionesExtra']> = [];
  renderToStaticMarkup(
    createElement(Escena, {
      almacen,
      agentesBase: [],
      departamentos: [],
      fuente: { personas: () => [], suscribir: () => () => undefined },
      avatar: {
        id: 'yo',
        nombre: 'Tú',
        mando: {
          adelante: 0,
          lateral: 0,
          destino: null,
          idDestino: 0,
          correr: false,
          destinoCorriendo: false,
          saltos: 0,
          sentar: null,
          idSentar: 0,
        },
      },
      hablandoIds: new Set<string>(),
      agenteOcupadoPorOtro: null,
      accionesExtra,
      alProyector: vi.fn(),
      alAccionCercana: vi.fn(),
      alHablarAgente: vi.fn(),
    }),
  );
  return recibidas;
}

describe('órdenes de conversación al motor', () => {
  it.each(['abierta', 'pensando', 'error', 'respondiendo'] as const)(
    'el agente mira al avatar en fase %s y explica solo al responder',
    (fase) => {
      const props = dibujar(fase);
      expect(props.miradaAgentes).toEqual({ a: 'yo' });
      expect(props.gestoAgentes).toEqual(fase === 'respondiendo' ? { a: 'explicar' } : {});
      expect(props.accionesExtra).toEqual([]);
    },
  );
  it('al cerrar retira mirada y gesto', () => {
    const props = dibujar('cerrada');
    expect(props.miradaAgentes).toEqual({});
    expect(props.gestoAgentes).toEqual({});
  });
});
