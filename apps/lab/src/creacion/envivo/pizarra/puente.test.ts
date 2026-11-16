import { describe, expect, it } from 'vitest';
import { crearPuente, type Cerebro } from '../../../../servidor/pizarra';
import { ejemplos } from './modelo';
const origen = 'http://127.0.0.1:5381';
const request = (
  data: unknown = { idea: 'Explica una biblioteca', intencion: 'explicar' },
  codigo = 'prueba',
  origin = origen,
) =>
  new Request('http://127.0.0.1:5390/pizarra', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Pizarra-Codigo': codigo },
    body: JSON.stringify(data),
  });
const opciones = { origen, codigo: 'prueba', explicarMs: 100, investigarMs: 100 };
describe('puente local con cerebro inyectado (nunca CLI)', () => {
  it('exige código y origen exactos, permite preflight de red privada', async () => {
    let llamadas = 0;
    const app = crearPuente({
      ...opciones,
      cerebro: async () => {
        llamadas++;
        return ejemplos('idea');
      },
    });
    expect((await app(request({}, 'mal'))).status).toBe(401);
    expect((await app(request({}, 'prueba', 'https://ajeno.example'))).status).toBe(403);
    const preflight = await app(
      new Request('http://127.0.0.1:5390/pizarra', {
        method: 'OPTIONS',
        headers: { Origin: origen, 'Access-Control-Request-Private-Network': 'true' },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Private-Network')).toBe('true');
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(origen);
    expect(llamadas).toBe(0);
    expect((await app(request())).status).toBe(200);
    expect(llamadas).toBe(1);
  });
  it('reintenta JSON inválido una vez y devuelve respaldo honesto', async () => {
    let llamadas = 0;
    const app = crearPuente({
      ...opciones,
      cerebro: async () => {
        llamadas++;
        return { roto: true };
      },
    });
    const r = await (await app(request())).json();
    expect(llamadas).toBe(2);
    expect(r.respaldo).toBe(true);
    expect(r.pizarra.puntos).toHaveLength(3);
  });
  it('incluye contexto en Ampliar y exige fuentes para Investigar', async () => {
    const recibidos: string[] = [];
    const cerebro: Cerebro = async (p) => {
      recibidos.push(p);
      return ejemplos('idea');
    };
    const app = crearPuente({ ...opciones, cerebro });
    const r = await (
      await app(
        request({
          idea: 'Añade la conversación',
          intencion: 'investigar',
          actual: ejemplos('mapa'),
        }),
      )
    ).json();
    expect(recibidos[0]).toContain('Biblioteca compartida');
    expect(r.respaldo).toBe(true);
    expect(recibidos).toHaveLength(2);
  });
  it('limita tiempo total y aborta al cerebro colgado', async () => {
    let abortada = false;
    const app = crearPuente({
      ...opciones,
      explicarMs: 20,
      cerebro: async (_p, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => {
            abortada = true;
            reject(new Error('cancelado'));
          }),
        ),
    });
    const r = await app(request());
    expect(r.status).toBe(504);
    expect(abortada).toBe(true);
  });
  it('una activa, dos en espera y el exceso se rechaza', async () => {
    let activas = 0,
      max = 0;
    const liberar: (() => void)[] = [];
    const app = crearPuente({
      ...opciones,
      explicarMs: 1000,
      cerebro: async () => {
        activas++;
        max = Math.max(max, activas);
        await new Promise<void>((r) => liberar.push(r));
        activas--;
        return ejemplos('idea');
      },
    });
    const a = app(request()),
      b = app(request()),
      c = app(request());
    await new Promise((r) => setTimeout(r, 10));
    expect((await app(request())).status).toBe(429);
    liberar.shift()!();
    await a;
    await new Promise((r) => setTimeout(r, 0));
    liberar.shift()!();
    await b;
    await new Promise((r) => setTimeout(r, 0));
    liberar.shift()!();
    await c;
    expect(max).toBe(1);
  });
  it('rechaza cuerpos excesivos, actual inválida y números inventados en explicar', async () => {
    const app = crearPuente({ ...opciones, cerebro: async () => ejemplos('barras') });
    expect((await app(request({ idea: 'x'.repeat(2000), intencion: 'explicar' }))).status).toBe(
      400,
    );
    expect((await app(request({ idea: 'Hola', intencion: 'explicar', actual: {} }))).status).toBe(
      400,
    );
    expect((await (await app(request())).json()).respaldo).toBe(true);
  });
});

it('no inicia la siguiente petición mientras el cerebro abortado sigue cerrándose', async () => {
  let llamadas = 0;
  let cerrar: (() => void) | undefined;
  const app = crearPuente({
    ...opciones,
    explicarMs: 20,
    cerebro: async () => {
      llamadas++;
      if (llamadas === 1)
        await new Promise<void>((resolve) => {
          cerrar = resolve;
        });
      return ejemplos('idea');
    },
  });
  const primera = app(request());
  await new Promise((r) => setTimeout(r, 5));
  const segunda = app(request());
  expect((await primera).status).toBe(504);
  expect(llamadas).toBe(1);
  cerrar?.();
  expect((await segunda).status).toBe(200);
  expect(llamadas).toBe(2);
});
