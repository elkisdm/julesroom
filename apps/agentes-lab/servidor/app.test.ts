import {
  crearSimulador,
  EQUIPO_EJEMPLO,
  ErrorProveedor,
  fraseDeError,
  type EventoRespuesta,
  type PeticionModelo,
  type Proveedor,
} from '@oficina/agentes';
import { describe, expect, it } from 'vitest';
import { crearApp } from './app';
import type { ConfigServidor } from './config';
import type { RegistroUso } from './registroUso';

const CONV = 'conv-0001';
const analista = EQUIPO_EJEMPLO[0]!;

function montar(
  opciones: {
    proveedor?: Proveedor;
    config?: Partial<ConfigServidor>;
    ahora?: () => number;
    clave?: boolean;
    registros?: RegistroUso[];
  } = {},
) {
  return crearApp({
    proveedor: opciones.proveedor ?? crearSimulador(),
    clave: opciones.clave,
    config: { permitirOrigenDePrueba: true, ...opciones.config },
    ahora: opciones.ahora,
    registroUso: opciones.registros ? (r) => opciones.registros!.push(r) : undefined,
  });
}

function enviar(
  app: ReturnType<typeof montar>,
  cuerpo: unknown,
  opciones: { agente?: string; origen?: string; cabeceras?: Record<string, string> } = {},
) {
  return app.request(`/agentes/${opciones.agente ?? 'analista'}/mensaje`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-origen-prueba': opciones.origen ?? 'origen-a',
      ...opciones.cabeceras,
    },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
}

async function eventos(res: Response): Promise<EventoRespuesta[]> {
  const texto = await res.text();
  return texto
    .split('\n\n')
    .filter((b) => b.trim() !== '')
    .map((bloque) => {
      expect(bloque.startsWith('data: ')).toBe(true);
      return JSON.parse(bloque.slice('data: '.length)) as EventoRespuesta;
    });
}

const msg = (texto = 'hola', conversacionId = CONV) => ({ conversacionId, texto });

describe('GET /salud y /agentes', () => {
  it('/salud informa clave y modelo', async () => {
    const res = await montar({ clave: true }).request('/salud');
    expect(await res.json()).toEqual({ ok: true, clave: true, modelo: analista.modelo });
    const sin = await montar().request('/salud');
    expect((await sin.json()).clave).toBe(false);
  });

  it('/agentes lista el equipo sin personalidad ni prompt', async () => {
    const res = await montar().request('/agentes');
    const lista = (await res.json()) as Record<string, unknown>[];
    expect(lista).toHaveLength(EQUIPO_EJEMPLO.length);
    expect(Object.keys(lista[0]!).sort()).toEqual(['ejemplo', 'id', 'nombre', 'rol', 'saludo']);
    const crudo = JSON.stringify(lista);
    for (const a of EQUIPO_EJEMPLO) expect(crudo).not.toContain(a.personalidad);
  });
});

describe('POST /agentes/:id/mensaje', () => {
  it('flujo feliz: SSE con inicio, texto y fin en orden', async () => {
    const res = await enviar(montar(), msg('¿Qué haces?'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    const evs = await eventos(res);
    expect(evs[0]).toEqual({ tipo: 'inicio', conversacionId: CONV, agenteId: 'analista' });
    expect(evs.at(-1)?.tipo).toBe('fin');
    expect(evs.slice(1, -1).every((e) => e.tipo === 'texto')).toBe(true);
    expect(evs.length).toBeGreaterThan(3);
  });

  it.each([
    ['conversacionId corto', { conversacionId: 'abc', texto: 'hola' }],
    ['conversacionId con caracteres raros', { conversacionId: 'abc def!!!!', texto: 'hola' }],
    ['conversacionId largo', { conversacionId: 'a'.repeat(65), texto: 'hola' }],
    ['sin texto', { conversacionId: CONV }],
    ['texto no string', { conversacionId: CONV, texto: 5 }],
    ['quien largo', { ...msg(), quien: 'x'.repeat(41) }],
    ['via inválida', { ...msg(), via: 'grito' }],
    ['no es objeto', '[1,2]'],
    ['JSON roto', '{no'],
  ])('400 con cuerpo inválido: %s', async (_n, cuerpo) => {
    const res = await enviar(montar(), cuerpo);
    expect(res.status).toBe(400);
  });

  it('acepta quien y via válidos', async () => {
    const res = await enviar(montar(), { ...msg(), quien: 'Ana', via: 'mencion' });
    expect(res.status).toBe(200);
    await res.text();
  });

  it('404 con agente desconocido', async () => {
    const res = await enviar(montar(), msg(), { agente: 'nadie' });
    expect(res.status).toBe(404);
  });

  it('413 si el cuerpo supera el tope (por Content-Length y por tamaño real)', async () => {
    const app = montar();
    const grande = await enviar(app, msg('x'.repeat(5000)));
    expect(grande.status).toBe(413);
    const declarado = await enviar(app, msg(), { cabeceras: { 'content-length': '999999' } });
    expect(declarado.status).toBe(413);
  });

  it('reutiliza la conversación: la segunda respuesta ve el primer turno', async () => {
    const peticiones: PeticionModelo[] = [];
    const base = crearSimulador();
    const espia: Proveedor = {
      transmitir(p) {
        peticiones.push({ ...p, mensajes: [...p.mensajes] });
        return base.transmitir(p);
      },
    };
    const app = montar({ proveedor: espia });
    await (await enviar(app, msg('primero'))).text();
    await (await enviar(app, msg('segundo'))).text();
    expect(peticiones[0]!.mensajes).toHaveLength(1);
    const segunda = peticiones[1]!.mensajes.map((m) => m.content).join('\n');
    expect(peticiones[1]!.mensajes.length).toBeGreaterThanOrEqual(3);
    expect(segunda).toContain('primero');
    expect(segunda).toContain('segundo');
  });

  it('conversaciones distintas no comparten memoria', async () => {
    const peticiones: PeticionModelo[] = [];
    const base = crearSimulador();
    const app = montar({
      proveedor: {
        transmitir(p) {
          peticiones.push({ ...p, mensajes: [...p.mensajes] });
          return base.transmitir(p);
        },
      },
    });
    await (await enviar(app, msg('uno', 'conv-aaaa1'))).text();
    await (await enviar(app, msg('dos', 'conv-bbbb2'))).text();
    expect(peticiones[1]!.mensajes).toHaveLength(1);
  });

  it('si el cliente corta, la señal llega al proveedor', async () => {
    let senal: AbortSignal | undefined;
    let avisar: () => void = () => {};
    const visto = new Promise<void>((r) => (avisar = r));
    const colgado: Proveedor = {
      async *transmitir(p) {
        senal = p.senal;
        yield { tipo: 'texto', texto: 'hola' };
        await new Promise<void>((resolve) => {
          if (p.senal?.aborted) resolve();
          else p.senal?.addEventListener('abort', () => resolve(), { once: true });
        });
        avisar();
        throw new ErrorProveedor('cortada');
      },
    };
    const app = montar({ proveedor: colgado });
    const res = await enviar(app, msg());
    const lector = res.body!.getReader();
    await lector.read();
    await lector.cancel();
    await visto;
    expect(senal?.aborted).toBe(true);
  });

  it('error a mitad de stream: 200 y evento error en la voz del agente', async () => {
    const res = await enviar(montar({ proveedor: crearSimulador({ cortarEn: 2 }) }), msg());
    expect(res.status).toBe(200);
    const evs = await eventos(res);
    expect(evs.at(-1)).toEqual({
      tipo: 'error',
      codigo: 'cortada',
      mensaje: fraseDeError(analista, 'cortada'),
    });
  });

  it('sin clave: evento error sin-clave', async () => {
    const sinClave: Proveedor = {
      async *transmitir() {
        throw new ErrorProveedor('sin-clave');
      },
    };
    const res = await enviar(montar({ proveedor: sinClave }), msg());
    expect(res.status).toBe(200);
    const evs = await eventos(res);
    expect(evs.at(-1)).toMatchObject({ tipo: 'error', codigo: 'sin-clave' });
  });
});

describe('límites', () => {
  it('429 por conversación con evento error limite, y la ventana se libera', async () => {
    let t = 1_000_000;
    const app = montar({
      ahora: () => t,
      config: { maxMensajesPorMinutoConversacion: 3, maxMensajesPorMinutoOrigen: 1000 },
    });
    for (let i = 0; i < 3; i++) await (await enviar(app, msg(`m${i}`))).text();
    const res = await enviar(app, msg('de más'));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      tipo: 'error',
      codigo: 'limite',
      mensaje: fraseDeError(analista, 'limite'),
    });
    // otra conversación del mismo origen sigue libre
    expect((await enviar(app, msg('x', 'conv-otra1'))).status).toBe(200);
    t += 60_001;
    const libre = await enviar(app, msg('otra vez'));
    expect(libre.status).toBe(200);
    await libre.text();
  });

  it('429 por origen, sin afectar a otros orígenes', async () => {
    const app = montar({
      config: { maxMensajesPorMinutoConversacion: 1000, maxMensajesPorMinutoOrigen: 2 },
    });
    await (await enviar(app, msg('a', 'conv-aaaa1'))).text();
    await (await enviar(app, msg('b', 'conv-bbbb2'))).text();
    expect((await enviar(app, msg('c', 'conv-cccc3'))).status).toBe(429);
    const otro = await enviar(app, msg('d', 'conv-dddd4'), { origen: 'origen-b' });
    expect(otro.status).toBe(200);
    await otro.text();
  });

  it('las peticiones inválidas no cuentan contra el límite', async () => {
    const app = montar({ config: { maxMensajesPorMinutoConversacion: 1 } });
    await enviar(app, '{no');
    expect((await enviar(app, msg())).status).toBe(200);
  });

  it('descarta conversaciones inactivas y respeta el tope', async () => {
    let t = 0;
    const app = montar({
      ahora: () => t,
      config: { maxConversaciones: 2, ttlConversacionMs: 1000 },
    });
    await (await enviar(app, msg('a', 'conv-aaaa1'))).text();
    await (await enviar(app, msg('b', 'conv-bbbb2'))).text();
    await (await enviar(app, msg('c', 'conv-cccc3'))).text();
    let uso = (await (await app.request('/uso')).json()) as { conversaciones: unknown[] };
    expect(uso.conversaciones).toHaveLength(2);
    t = 5000;
    await (await enviar(app, msg('d', 'conv-dddd4'))).text();
    uso = (await (await app.request('/uso')).json()) as { conversaciones: unknown[] };
    expect(uso.conversaciones).toHaveLength(1);
  });
});

describe('uso', () => {
  it('acumula tras un mensaje y expone el detalle por conversación', async () => {
    const registros: RegistroUso[] = [];
    const app = montar({ registros });
    const vacio = (await (await app.request('/uso')).json()) as { total: { llamadas: number } };
    expect(vacio.total.llamadas).toBe(0);

    await (await enviar(app, msg())).text();
    const uso = (await (await app.request('/uso')).json()) as {
      total: Record<string, number>;
      conversaciones: { conversacionId: string; mensajes: number }[];
    };
    expect(uso.total.llamadas).toBe(1);
    expect(uso.total.mensajes).toBe(1);
    expect(uso.total.entrada).toBeGreaterThan(0);
    expect(uso.total.salida).toBeGreaterThan(0);
    expect(uso.conversaciones).toHaveLength(1);
    expect(uso.conversaciones[0]).toMatchObject({ conversacionId: CONV, mensajes: 1 });

    const una = await app.request(`/agentes/analista/uso/${CONV}`);
    expect(una.status).toBe(200);
    expect(await una.json()).toMatchObject({
      conversacionId: CONV,
      agenteId: 'analista',
      llamadas: 1,
    });

    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      agenteId: 'analista',
      conversacionId: CONV,
      motivo: 'completo',
    });
  });

  it('acumula también tras uno fallido, y 404 si la conversación no existe', async () => {
    const registros: RegistroUso[] = [];
    const app = montar({ proveedor: crearSimulador({ falla: 'sin-red' }), registros });
    await (await enviar(app, msg())).text();
    const uso = (await (await app.request('/uso')).json()) as { total: { llamadas: number } };
    expect(uso.total.llamadas).toBe(1);
    expect(registros[0]?.motivo).toBe('error');
    expect((await app.request('/agentes/analista/uso/no-existe-1')).status).toBe(404);
  });

  it('el total sobrevive al descarte de la conversación', async () => {
    let t = 0;
    const app = montar({ ahora: () => t, config: { ttlConversacionMs: 10 } });
    await (await enviar(app, msg())).text();
    t = 1000;
    const uso = (await (await app.request('/uso')).json()) as {
      total: { llamadas: number };
      conversaciones: unknown[];
    };
    expect(uso.conversaciones).toHaveLength(0);
    expect(uso.total.llamadas).toBe(1);
  });
});

describe('CORS', () => {
  it('permite los orígenes configurados, incluido OPTIONS', async () => {
    const app = montar();
    const pre = await app.request('/agentes/analista/mensaje', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:5329',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(pre.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5329');
    const res = await app.request('/salud', { headers: { origin: 'http://localhost:5329' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5329');
  });

  it('no concede CORS a otros orígenes', async () => {
    const res = await montar().request('/salud', { headers: { origin: 'https://malo.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('la clave nunca sale', () => {
  it('ninguna respuesta contiene la clave', async () => {
    const clave = 'sk-' + 'ant-FALSA-no-debe-salir';
    const sinClave: Proveedor = {
      async *transmitir() {
        throw new ErrorProveedor('sin-clave', `falló con ${clave}`);
      },
    };
    const app = montar({ proveedor: sinClave, clave: true });
    const cuerpos = [
      await (await enviar(app, msg())).text(),
      await (await app.request('/salud')).text(),
      await (await app.request('/agentes')).text(),
      await (await app.request('/uso')).text(),
      await (await app.request(`/agentes/analista/uso/${CONV}`)).text(),
    ];
    for (const c of cuerpos) expect(c).not.toContain(clave);
  });
});

describe('límite compartido de una persona entre agentes', () => {
  it('cambiar de agente no permite eludir el tope por persona', async () => {
    const app = montar({ config: { maxMensajesPorMinutoPersona: 1 } });
    await eventos(await enviar(app, msg()));
    expect((await enviar(app, msg('otra pregunta'), { agente: 'soporte' })).status).toBe(429);
    expect(
      (await enviar(app, msg('otra persona', 'conv-0002'), { agente: 'soporte' })).status,
    ).toBe(200);
  });
});
