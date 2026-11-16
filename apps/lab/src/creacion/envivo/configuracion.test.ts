import { describe, it, expect } from 'vitest';
import {
  configuracionViva,
  enlacePublico,
  autorizarSesion,
  estadoAnfitrion,
} from './configuracion';

describe('configuración de la demo', () => {
  it('queda inactiva sin configuración y rechaza pares incompletos', () => {
    expect(configuracionViva({})).toBeNull();
    expect(configuracionViva({ VITE_URL_EMISOR_PASES: 'https://pases.example.test' })).toBeNull();
    expect(configuracionViva({ VITE_SALA_EN_VIVO: '1', DEV: false })).toBeNull();
  });
  it('conserva el modo local explícito y usa ICE normal fuera de loopback', () => {
    expect(configuracionViva({ DEV: true, VITE_SALA_EN_VIVO: '1' })).toMatchObject({
      local: true,
      rtcConfig: { iceServers: [] },
    });
    expect(
      configuracionViva({
        VITE_URL_EMISOR_PASES: 'https://pases.example.test/',
        VITE_LIVEKIT_URL: 'wss://voz.example.test',
      }),
    ).toEqual({
      emisor: 'https://pases.example.test/api',
      url: 'wss://voz.example.test',
      local: false,
      rtcConfig: undefined,
    });
    expect(
      configuracionViva({
        VITE_URL_EMISOR_PASES: 'javascript:alert(1)',
        VITE_LIVEKIT_URL: 'wss://voz.example.test',
      }),
    ).toBeNull();
  });
  it('el enlace no lleva dueño, secretos ni llave', () => {
    expect(
      enlacePublico('https://pagina.example.test/crear.html?dueno=ataque&llave=secreto#x', 'sala'),
    ).toBe('https://pagina.example.test/crear.html?sala=sala');
  });
  it('rechaza pases malformados sin lanzar errores', () => {
    for (const dato of [
      null,
      '',
      {},
      { invitado: true },
      { identidad: 4, dueno: 'x', sala: 's', invitado: true },
    ])
      expect(autorizarSesion(dato)).toBeNull();
  });
  it('el rol y la identidad se toman sólo del pase autorizado', () => {
    expect(
      autorizarSesion({ sala: 's', identidad: 'invitado-123', dueno: 'dueno-s', invitado: true }),
    ).toEqual({ sala: 's', yo: 'invitado-123', dueno: 'dueno-s', invitado: true });
    expect(
      autorizarSesion({ sala: 's', identidad: 'ataque', dueno: 'dueno-s', invitado: false }),
    ).toBeNull();
  });
  it('conserva el mundo al salir el anfitrión y anuncia su regreso', () => {
    expect(estadoAnfitrion(true, false, true)).toBe(
      'El anfitrión salió. Conservas el último mundo recibido.',
    );
    expect(estadoAnfitrion(true, true, true)).toBe('');
    expect(estadoAnfitrion(true, false, false)).toContain('Esperando');
    expect(estadoAnfitrion(false, false, true)).toBe('');
  });
});

import { solicitarDemo, ErrorDemo, esperaDemo, mensajeConexion } from './configuracion';
import { vi } from 'vitest';
describe('emisor remoto', () => {
  it('envía el secreto sólo en el cuerpo y devuelve el pase', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ token: 'de-prueba' }), { status: 200 }));
    expect(
      await solicitarDemo(
        'https://pases.example.test/api',
        'pases',
        { secretoDueno: 'prueba' },
        fetcher,
      ),
    ).toEqual({ token: 'de-prueba' });
    expect(fetcher.mock.calls[0]![0]).toBe('https://pases.example.test/api/pases');
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      method: 'POST',
      body: '{"secretoDueno":"prueba"}',
    });
  });
  it('no reintenta automáticamente llave errónea ni errores de entrada', async () => {
    for (const status of [400, 401, 403, 404]) {
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'Entrada rechazada' }), { status }),
        );
      await expect(
        solicitarDemo('https://pases.example.test/api', 'pases', {}, fetcher),
      ).rejects.toMatchObject({ reintentar: false, message: 'Entrada rechazada' });
    }
    expect(new ErrorDemo('Servidor sin respuesta', true).reintentar).toBe(true);
  });
});

describe('reintentos y llave', () => {
  it('429 reintenta con mensaje claro y sin pedir llave', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
    await expect(solicitarDemo('http://localhost/api', 'pases', {}, fetcher)).rejects.toMatchObject(
      {
        reintentar: true,
        message: 'Hay mucha gente entrando a la vez, reintentando…',
      },
    );
  });
  it('la espera aumenta y queda acotada', () => {
    expect(esperaDemo(0)).toBe(2000);
    expect(esperaDemo(2)).toBe(8000);
    expect(esperaDemo(20)).toBe(60000);
  });
});

it('traduce el rechazo de cupo del websocket si dos pases compiten por el último lugar', () => {
  expect(mensajeConexion(new Error('server refused: room capacity exceeded'))).toBe(
    'La sala está llena (25). Entrarás apenas se libere un lugar',
  );
  expect(mensajeConexion(new TypeError('Failed to fetch'))).toBe(
    'No pudimos conectar; reintentando',
  );
});
