import { describe, expect, it } from 'vitest';
import { TokenVerifier } from 'livekit-server-sdk';
import { crearAppDemo, leerOpcionesDemo } from './demo';
import { CREDENCIALES_DEV } from './config';

const origen = 'https://pagina.example';
const uuid = '12345678-1234-4234-8234-123456789012';
const opciones = { origen, cabeceraIp: 'x-ip-demo' };
function preparar(extra = {}, config = CREDENCIALES_DEV) {
  const app = crearAppDemo(config, { ...opciones, participantes: async () => [], ...extra });
  const post = (ruta: string, datos: object, ip = '1') =>
    app.request(ruta, {
      method: 'POST',
      headers: { origin: origen, 'content-type': 'application/json', 'x-ip-demo': ip },
      body: JSON.stringify(datos),
    });
  return { app, post };
}
const carga = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());

describe('emisor público', () => {
  it('crea sala aleatoria y autoriza dueño sólo con secreto; invitados no eligen identidad privilegiada', async () => {
    const { post } = preparar();
    const creada = await post('/api/salas', {});
    expect(creada.status).toBe(201);
    const { sala, secretoDueno, dueno } = await creada.json();
    const pedir = (extra = {}) =>
      post('/api/pases', { sala, identidad: uuid, nombre: 'Ana', ...extra });
    const propio = await (await pedir({ secretoDueno })).json();
    expect(propio).toMatchObject({ identidad: dueno, dueno, invitado: false });
    const jwt = carga(propio.token);
    expect(jwt.video).toMatchObject({
      room: sala,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
      canPublishSources: ['microphone'],
    });
    expect(jwt.roomConfig.maxParticipants).toBe(25);
    expect(jwt.exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(300);
    const invitado = await (await pedir()).json();
    expect(invitado).toMatchObject({ identidad: `invitado-${uuid}`, dueno, invitado: true });
    expect((await pedir({ secretoDueno: 'a'.repeat(64) })).status).toBe(403);
    expect((await pedir({ identidad: dueno })).status).toBe(400);
    expect((await pedir({ dueno })).status).toBe(400);
  });

  it('valida cuerpos, sala existente y no publica rutas locales', async () => {
    const { app, post } = preparar();
    expect((await post('/api/salas', { sala: 'elegida' })).status).toBe(400);
    expect((await post('/api/pases', { sala: uuid, identidad: uuid, nombre: 'Ana' })).status).toBe(
      404,
    );
    expect((await app.request('/api/token?sala=x')).status).toBe(404);
    expect((await app.request('/api/red')).status).toBe(404);
    const { sala } = await (await post('/api/salas', {})).json();
    for (const nombre of ['', 'x'.repeat(41), '\u0000'])
      expect((await post('/api/pases', { sala, identidad: uuid, nombre })).status).toBe(400);
    expect(
      (
        await app.request('/api/salas', {
          method: 'POST',
          headers: { origin: origen, 'content-type': 'application/json' },
          body: 'x'.repeat(2049),
        })
      ).status,
    ).toBe(413);
    expect(
      (
        await app.request('/api/salas', {
          method: 'POST',
          headers: { origin: origen, 'content-type': 'application/json' },
          body: '{',
        })
      ).status,
    ).toBe(400);
  });

  it('aplica CORS exacto incluso errores y preflight y exige llave opcional', async () => {
    const { app, post } = preparar({ llaveDemo: 'solo-demo' });
    const error = await post('/api/salas', {});
    expect(error.status).toBe(401);
    expect(error.headers.get('access-control-allow-origin')).toBe(origen);
    const creada = await post('/api/salas', { llaveDemo: 'solo-demo' });
    expect(creada.status).toBe(201);
    const { sala } = await creada.json();
    expect((await post('/api/pases', { sala, identidad: uuid, nombre: 'Ana' })).status).toBe(401);
    expect(
      (await post('/api/pases', { sala, identidad: uuid, nombre: 'Ana', llaveDemo: 'solo-demo' }))
        .status,
    ).toBe(200);
    expect(
      (
        await app.request('/api/salas', {
          method: 'POST',
          headers: { origin: `${origen}.intruso`, 'content-type': 'application/json' },
          body: '{}',
        })
      ).status,
    ).toBe(403);
    const preflight = await app.request('/api/pases', {
      method: 'OPTIONS',
      headers: { origin: origen },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(origen);
  });

  it('limita intentos por IP sin confiar X-Forwarded-For; expira contadores y salas', async () => {
    let ahora = 0;
    const { app, post } = preparar({
      maxSalas: 1,
      intentosIpMinuto: 2,
      ahora: () => ahora,
      ttlSalaSegundos: 300,
    });
    expect((await post('/api/salas', {})).status).toBe(201);
    expect((await post('/api/salas', {})).status).toBe(429);
    expect(
      (
        await app.request('/api/salas', {
          method: 'POST',
          headers: {
            origin: origen,
            'content-type': 'application/json',
            'x-ip-demo': '1',
            'x-forwarded-for': 'otra',
          },
          body: '{}',
        })
      ).status,
    ).toBe(429);
    ahora = 301_000;
    expect((await post('/api/salas', {})).status).toBe(201);
  });

  it('limita pases globales aunque cambien IP y respeta tope parametrizado', async () => {
    const { post } = preparar({ pasesMinuto: 1, topeSala: 7 });
    const { sala } = await (await post('/api/salas', {})).json();
    const datos = { sala, identidad: uuid, nombre: 'Ana' };
    const primero = await post('/api/pases', datos, '2');
    expect(carga((await primero.json()).token).roomConfig.maxParticipants).toBe(7);
    expect((await post('/api/pases', datos, '3')).status).toBe(429);
  });
});

it('lee configuración estricta y rechaza valores inseguros', () => {
  expect(leerOpcionesDemo({ DEMO_ORIGEN: origen })).toMatchObject({ origen, topeSala: 25 });
  expect(() => leerOpcionesDemo({})).toThrow(/DEMO_ORIGEN/);
  expect(() => leerOpcionesDemo({ DEMO_ORIGEN: `${origen}/ruta` })).toThrow();
  expect(() => leerOpcionesDemo({ DEMO_ORIGEN: origen, DEMO_TOPE_SALA: '26' })).toThrow();
  expect(() => leerOpcionesDemo({ DEMO_ORIGEN: origen, DEMO_TTL_PASE_SEGUNDOS: '301' })).toThrow();
});

it('sin cabecera configurada ignora cabeceras IP del visitante', async () => {
  const { app } = preparar({ cabeceraIp: undefined, intentosIpMinuto: 1 });
  const pedir = (ip: string) =>
    app.request('/api/salas', {
      method: 'POST',
      headers: {
        origin: origen,
        'content-type': 'application/json',
        'x-forwarded-for': ip,
        'x-real-ip': ip,
      },
      body: '{}',
    });
  expect((await pedir('1')).status).toBe(201);
  expect((await pedir('2')).status).toBe(429);
});

it('verifica criptográficamente firma, sala y permisos mínimos de dueño e invitado', async () => {
  const { post } = preparar();
  const { sala, secretoDueno, dueno } = await (await post('/api/salas', {})).json();
  const verificador = new TokenVerifier(CREDENCIALES_DEV.apiKey, CREDENCIALES_DEV.apiSecret);
  for (const secreto of [undefined, secretoDueno]) {
    const { token, identidad } = await (
      await post('/api/pases', {
        sala,
        identidad: uuid,
        nombre: 'Ana',
        ...(secreto ? { secretoDueno: secreto } : {}),
      })
    ).json();
    const verificado = await verificador.verify(token);
    expect(verificado.sub).toBe(identidad);
    expect(identidad).toBe(secreto ? dueno : `invitado-${uuid}`);
    expect(verificado.video).toEqual({
      room: sala,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
      canPublishSources: ['microphone'],
    });
    expect(verificado.video?.roomAdmin).toBeUndefined();
    expect(verificado.video?.roomCreate).toBeUndefined();
    expect(verificado.video?.roomRecord).toBeUndefined();
    await expect(
      new TokenVerifier(CREDENCIALES_DEV.apiKey, 'otra-clave-de-prueba').verify(token),
    ).rejects.toThrow();
  }
});

it('no emite pases después de expirar la sala, aun con secreto correcto', async () => {
  let ahora = 0;
  const { post } = preparar({ ahora: () => ahora, ttlSalaSegundos: 300 });
  const { sala, secretoDueno } = await (await post('/api/salas', {})).json();
  ahora = 300_000;
  for (const extra of [{}, { secretoDueno }]) {
    const respuesta = await post('/api/pases', { sala, identidad: uuid, nombre: 'Ana', ...extra });
    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toEqual({ error: 'La sala no existe o expiró.' });
  }
});

it('no devuelve secretos del dueño, llave de demo ni claves del servidor en errores', async () => {
  const llaveDemo = 'llave-prueba-no-real';
  const config = {
    ...CREDENCIALES_DEV,
    apiKey: 'clave-publica-prueba',
    apiSecret: 'firma-privada-prueba-no-real',
  };
  const { post } = preparar({ llaveDemo }, config);
  const { sala, secretoDueno } = await (await post('/api/salas', { llaveDemo })).json();
  const casos = [
    { sala, identidad: uuid, nombre: 'Ana', secretoDueno, llaveDemo: 'incorrecta' },
    { sala, identidad: uuid, nombre: 'Ana', secretoDueno: 'b'.repeat(64), llaveDemo },
    { sala, identidad: uuid, nombre: secretoDueno, secretoDueno, llaveDemo },
  ];
  for (const datos of casos) {
    const respuesta = await post('/api/pases', datos);
    expect(respuesta.status).toBeGreaterThanOrEqual(400);
    const texto = await respuesta.text();
    expect(Object.keys(JSON.parse(texto))).toEqual(['error']);
    for (const secreto of [secretoDueno, llaveDemo, config.apiKey, config.apiSecret])
      expect(texto).not.toContain(secreto);
  }
});

it('rechaza sala llena antes del websocket y admite volver a una identidad ya conectada', async () => {
  let presentes: { identity: string }[] = [];
  const { post } = preparar({ participantes: async () => presentes });
  const { sala, secretoDueno, dueno } = await (await post('/api/salas', {})).json();
  presentes = Array.from({ length: 25 }, (_, i) => ({ identity: i === 0 ? dueno : `otra-${i}` }));
  const pedir = (extra = {}) =>
    post('/api/pases', { sala, identidad: uuid, nombre: 'Ana', ...extra });
  const llena = await pedir();
  expect(llena.status).toBe(409);
  expect(await llena.json()).toEqual({
    error: 'La sala está llena (25). Entrarás apenas se libere un lugar',
  });
  expect((await pedir({ secretoDueno })).status).toBe(200);
  presentes.pop();
  expect((await pedir()).status).toBe(200);
});
it('si la consulta de cupo falla, igual emite el pase: LiveKit aplica el tope al conectar', async () => {
  const { post } = preparar({
    participantes: async () => {
      throw new Error('sin red');
    },
  });
  const { sala } = await (await post('/api/salas', {})).json();
  expect((await post('/api/pases', { sala, identidad: uuid, nombre: 'Ana' })).status).toBe(200);
});
