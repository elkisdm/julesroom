import {
  agentePorId,
  crearConversacion,
  EQUIPO_EJEMPLO,
  fraseDeError,
  type Conversacion,
  type DefinicionAgente,
  type EventoRespuesta,
  type Proveedor,
  type Uso,
  type UsoConversacion,
} from '@oficina/agentes';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { configurar, type ConfigServidor } from './config';
import type { FnRegistroUso } from './registroUso';

export interface OpcionesApp {
  proveedor: Proveedor;
  equipo?: readonly DefinicionAgente[];
  config?: Partial<ConfigServidor>;
  /** Reloj inyectable (ms). */
  ahora?: () => number;
  registroUso?: FnRegistroUso;
  /** Si hay una clave real detrás del proveedor (solo se informa en `/salud`; la clave no entra aquí). */
  clave?: boolean;
}

interface Entrada {
  conversacion: Conversacion;
  ultimaActividad: number;
  /** Uso ya sumado al total, para acumular solo la diferencia. */
  contado: UsoConversacion;
}

export interface TotalUso extends Uso {
  llamadas: number;
  mensajes: number;
}

const ID_CONVERSACION = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_QUIEN = 40;
const codificador = new TextEncoder();

interface CuerpoMensaje {
  conversacionId: string;
  texto: string;
  quien?: string;
  via?: 'cerca' | 'mencion';
}

function validar(cuerpo: unknown): CuerpoMensaje | undefined {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) return undefined;
  const { conversacionId, texto, quien, via } = cuerpo as Record<string, unknown>;
  if (typeof conversacionId !== 'string' || !ID_CONVERSACION.test(conversacionId)) return undefined;
  if (typeof texto !== 'string') return undefined;
  if (quien !== undefined && (typeof quien !== 'string' || quien.length > MAX_QUIEN))
    return undefined;
  if (via !== undefined && via !== 'cerca' && via !== 'mencion') return undefined;
  return { conversacionId, texto, quien, via };
}

export function crearApp(opciones: OpcionesApp): Hono {
  const config = configurar(opciones.config);
  const equipo = opciones.equipo ?? EQUIPO_EJEMPLO;
  const ahora = opciones.ahora ?? Date.now;
  const registrar = opciones.registroUso;
  const conClave = opciones.clave ?? false;

  const conversaciones = new Map<string, Entrada>();
  const total: TotalUso = {
    llamadas: 0,
    mensajes: 0,
    entrada: 0,
    salida: 0,
    cacheLeida: 0,
    cacheEscrita: 0,
  };
  const porConversacion = new Map<string, number[]>();
  const porPersona = new Map<string, number[]>();
  const porOrigen = new Map<string, number[]>();

  const clave = (agenteId: string, conversacionId: string) => `${agenteId}\u0000${conversacionId}`;

  function purgar(): void {
    const t = ahora();
    for (const [k, e] of conversaciones) {
      if (t - e.ultimaActividad > config.ttlConversacionMs) conversaciones.delete(k);
    }
  }

  function obtener(def: DefinicionAgente, conversacionId: string): Entrada {
    purgar();
    const k = clave(def.id, conversacionId);
    let entrada = conversaciones.get(k);
    if (!entrada) {
      while (conversaciones.size >= config.maxConversaciones) {
        const masVieja = [...conversaciones].sort(
          (a, b) => a[1].ultimaActividad - b[1].ultimaActividad,
        )[0];
        if (!masVieja) break;
        conversaciones.delete(masVieja[0]);
      }
      const conversacion = crearConversacion({
        def,
        proveedor: opciones.proveedor,
        id: conversacionId,
      });
      entrada = { conversacion, ultimaActividad: ahora(), contado: conversacion.uso() };
      conversaciones.set(k, entrada);
    }
    entrada.ultimaActividad = ahora();
    return entrada;
  }

  /** Ventana deslizante: ¿cabe un mensaje más? No registra nada. */
  function hayCupo(mapa: Map<string, number[]>, llave: string, tope: number): boolean {
    const t = ahora();
    const vivas = (mapa.get(llave) ?? []).filter((x) => t - x < config.ventanaLimiteMs);
    if (vivas.length === 0) mapa.delete(llave);
    else mapa.set(llave, vivas);
    return vivas.length < tope;
  }
  const anotar = (mapa: Map<string, number[]>, llave: string) =>
    mapa.set(llave, [...(mapa.get(llave) ?? []), ahora()]);

  function origenDe(c: Context): string {
    if (config.permitirOrigenDePrueba) {
      const prueba = c.req.header('x-origen-prueba');
      if (prueba) return prueba;
    }
    try {
      return getConnInfo(c).remote.address ?? 'desconocido';
    } catch {
      return 'desconocido';
    }
  }

  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origen) => (config.origenesPermitidos.includes(origen) ? origen : null),
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );

  app.get('/salud', (c) =>
    c.json({ ok: true, clave: conClave, modelo: equipo[0]?.modelo ?? null }),
  );

  app.get('/agentes', (c) =>
    c.json(
      equipo.map(({ id, nombre, rol, ejemplo, saludo }) => ({ id, nombre, rol, ejemplo, saludo })),
    ),
  );

  app.post('/agentes/:id/mensaje', async (c) => {
    const def = agentePorId(c.req.param('id'), equipo);
    if (!def) return c.json({ error: 'agente-desconocido' }, 404);

    const declarado = Number(c.req.header('content-length'));
    if (Number.isFinite(declarado) && declarado > config.maxCuerpoBytes) {
      return c.json({ error: 'cuerpo-demasiado-grande' }, 413);
    }
    const crudo = await c.req.text();
    if (codificador.encode(crudo).length > config.maxCuerpoBytes) {
      return c.json({ error: 'cuerpo-demasiado-grande' }, 413);
    }
    let cuerpo: CuerpoMensaje | undefined;
    try {
      cuerpo = validar(JSON.parse(crudo));
    } catch {
      cuerpo = undefined;
    }
    if (!cuerpo) return c.json({ error: 'cuerpo-invalido' }, 400);

    const origen = origenDe(c);
    const llaveConv = clave(def.id, cuerpo.conversacionId);
    if (
      !hayCupo(porConversacion, llaveConv, config.maxMensajesPorMinutoConversacion) ||
      !hayCupo(porOrigen, origen, config.maxMensajesPorMinutoOrigen) ||
      !hayCupo(porPersona, cuerpo.conversacionId, config.maxMensajesPorMinutoPersona)
    ) {
      const evento: EventoRespuesta = {
        tipo: 'error',
        codigo: 'limite',
        mensaje: fraseDeError(def, 'limite'),
      };
      return c.json(evento, 429);
    }
    anotar(porConversacion, llaveConv);
    anotar(porOrigen, origen);
    anotar(porPersona, cuerpo.conversacionId);

    const entrada = obtener(def, cuerpo.conversacionId);
    const { conversacionId, texto, quien, via } = cuerpo;

    c.header('X-Accel-Buffering', 'no');
    return streamSSE(c, async (flujo) => {
      const control = new AbortController();
      flujo.onAbort(() => control.abort());
      let motivo: 'completo' | 'tope' | 'error' = 'error';
      try {
        for await (const e of entrada.conversacion.enviar(texto, { quien, via }, control.signal)) {
          if (e.tipo === 'fin') motivo = e.motivo;
          else if (e.tipo === 'error') motivo = 'error';
          await flujo.writeSSE({ data: JSON.stringify(e) });
        }
      } finally {
        const actual = entrada.conversacion.uso();
        const antes = entrada.contado;
        const delta: Uso = {
          entrada: actual.entrada - antes.entrada,
          salida: actual.salida - antes.salida,
          cacheLeida: actual.cacheLeida - antes.cacheLeida,
          cacheEscrita: actual.cacheEscrita - antes.cacheEscrita,
        };
        total.llamadas += actual.llamadas - antes.llamadas;
        total.mensajes += actual.mensajes - antes.mensajes;
        total.entrada += delta.entrada;
        total.salida += delta.salida;
        total.cacheLeida += delta.cacheLeida;
        total.cacheEscrita += delta.cacheEscrita;
        entrada.contado = actual;
        entrada.ultimaActividad = ahora();
        try {
          registrar?.({ t: ahora(), agenteId: def.id, conversacionId, motivo, uso: delta });
        } catch (e) {
          console.error('No se pudo registrar el uso:', e instanceof Error ? e.message : 'error');
        }
      }
    });
  });

  app.get('/uso', (c) => {
    purgar();
    return c.json({
      total,
      conversaciones: [...conversaciones.values()].map((e) => e.conversacion.uso()),
    });
  });

  app.get('/agentes/:id/uso/:conversacionId', (c) => {
    purgar();
    const entrada = conversaciones.get(clave(c.req.param('id'), c.req.param('conversacionId')));
    if (!entrada) return c.json({ error: 'conversacion-desconocida' }, 404);
    return c.json(entrada.conversacion.uso());
  });

  return app;
}
