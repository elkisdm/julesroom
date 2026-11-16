import { describe, expect, it } from 'vitest';
import { crearApp, emitirToken } from './app';
import { CREDENCIALES_DEV } from './config';

function decodificar(jwt: string) {
  const [, carga] = jwt.split('.');
  return JSON.parse(Buffer.from(carga ?? '', 'base64url').toString('utf8'));
}

describe('emitirToken', () => {
  it('firma un token con identidad, nombre, sala, permisos y 6 h de vida', async () => {
    const jwt = await emitirToken(CREDENCIALES_DEV, {
      sala: 'oficina:1',
      identidad: 'ana_1',
      nombre: 'Ana',
    });
    const c = decodificar(jwt);
    expect(c.sub).toBe('ana_1');
    expect(c.name).toBe('Ana');
    expect(c.iss).toBe('devkey');
    expect(c.video).toMatchObject({
      room: 'oficina:1',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });
    expect(c.exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(6 * 3600 - 60);
    expect(c.exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(6 * 3600);
  });
});

describe('GET /api/token', () => {
  const app = crearApp(CREDENCIALES_DEV);
  const pedir = (query: string) => app.request(`/api/token?${query}`);

  it('devuelve token, sala, identidad y puerto', async () => {
    const res = await pedir('sala=oficina&identidad=ana&nombre=Ana');
    expect(res.status).toBe(200);
    const cuerpo = await res.json();
    expect(cuerpo).toMatchObject({ sala: 'oficina', identidad: 'ana', puerto: 7880 });
    expect(decodificar(cuerpo.token).video.room).toBe('oficina');
  });

  it('recorta los espacios del nombre', async () => {
    const res = await pedir('sala=oficina&identidad=ana&nombre=%20%20Ana%20Pérez%20%20');
    const cuerpo = await res.json();
    expect(decodificar(cuerpo.token).name).toBe('Ana Pérez');
  });

  it.each([
    ['sala faltante', 'identidad=ana&nombre=Ana', /sala/],
    ['sala con caracteres inválidos', 'sala=a%20b&identidad=ana&nombre=Ana', /sala/],
    ['sala de más de 64', `sala=${'a'.repeat(65)}&identidad=ana&nombre=Ana`, /sala/],
    ['identidad faltante', 'sala=s&nombre=Ana', /identidad/],
    ['identidad con dos puntos', 'sala=s&identidad=a:b&nombre=Ana', /identidad/],
    ['identidad de más de 64', `sala=s&identidad=${'a'.repeat(65)}&nombre=Ana`, /identidad/],
    ['nombre faltante', 'sala=s&identidad=ana', /nombre/],
    ['nombre solo espacios', 'sala=s&identidad=ana&nombre=%20%20', /nombre/],
    ['nombre de más de 40', `sala=s&identidad=ana&nombre=${'n'.repeat(41)}`, /nombre/],
  ])('responde 400 con %s', async (_caso, query, patron) => {
    const res = await pedir(query);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(patron);
  });
});

describe('GET /api/salud', () => {
  it('responde ok', async () => {
    const res = await crearApp(CREDENCIALES_DEV).request('/api/salud');
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('red local y tope de sala', () => {
  it('/api/red entrega direcciones IPv4 no internas', async () => {
    const app = crearApp({ url: 'ws://localhost:7880', apiKey: 'k', apiSecret: 's' });
    const res = await app.request('/api/red');
    const cuerpo = (await res.json()) as { ips: string[] };
    expect(Array.isArray(cuerpo.ips)).toBe(true);
    for (const ip of cuerpo.ips) expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it('el token lleva el tope de personas de la sala', async () => {
    const jwt = await emitirToken(
      { apiKey: 'k', apiSecret: 's' },
      { sala: 'x', identidad: 'i', nombre: 'n' },
      7,
    );
    const carga = JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString()) as {
      roomConfig?: { maxParticipants?: number };
    };
    expect(carga.roomConfig?.maxParticipants).toBe(7);
  });
});

it('la app integrada parametriza el tope del token sin cambiar la sala mínima', async () => {
  const res = await crearApp(CREDENCIALES_DEV, 8).request(
    '/api/token?sala=local&identidad=ana&nombre=Ana',
  );
  const cuerpo = await res.json();
  expect(decodificar(cuerpo.token).roomConfig.maxParticipants).toBe(8);
});
