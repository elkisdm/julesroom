import { Hono } from 'hono';
import { networkInterfaces } from 'node:os';
import { AccessToken, RoomConfiguration } from 'livekit-server-sdk';
import { puertoLiveKit, type ConfigLiveKit } from './config';

/** Datos de quien pide entrar a una sala. */
export interface SolicitudToken {
  sala: string;
  identidad: string;
  nombre: string;
}

/** Tope inicial de personas por sala (ADR-0006); la sala se crea con él al entrar la primera persona. */
export const TOPE_SALA = 25;

/** Vida del token: 6 horas. */
const TTL_SEGUNDOS = 6 * 60 * 60;

/** Emite un token de acceso de LiveKit firmado para la sala e identidad dadas. */
export async function emitirToken(
  config: Pick<ConfigLiveKit, 'apiKey' | 'apiSecret'>,
  { sala, identidad, nombre }: SolicitudToken,
  topeSala = TOPE_SALA,
): Promise<string> {
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: identidad,
    name: nombre,
    ttl: TTL_SEGUNDOS,
  });
  token.addGrant({
    room: sala,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });
  token.roomConfig = new RoomConfiguration({ maxParticipants: topeSala });
  return token.toJwt();
}

/** Valida los parámetros; devuelve la solicitud limpia o el mensaje de error en español. */
function validar(query: Record<string, string | undefined>): SolicitudToken | string {
  const { sala = '', identidad = '' } = query;
  const nombre = (query.nombre ?? '').trim();
  if (!/^[A-Za-z0-9:_-]{1,64}$/.test(sala)) {
    return 'La sala es obligatoria: 1 a 64 caracteres (letras, números, ":", "_" o "-").';
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(identidad)) {
    return 'La identidad es obligatoria: 1 a 64 caracteres (letras, números, "_" o "-").';
  }
  if (nombre.length < 1 || nombre.length > 40) {
    return 'El nombre es obligatorio: 1 a 40 caracteres.';
  }
  return { sala, identidad, nombre };
}

/** Direcciones IPv4 de la red local de esta máquina (para armar el enlace que se abre desde otro equipo). */
export function direccionesLocales(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i?.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
}

/** Crea la app Hono con `/api/token`, `/api/red` y `/api/salud`. Sin CORS: va en el mismo origen que la página. */
export function crearApp(config: ConfigLiveKit, topeSala = TOPE_SALA): Hono {
  const app = new Hono();
  app.get('/api/salud', (c) => c.json({ ok: true }));
  app.get('/api/red', (c) => c.json({ ips: direccionesLocales() }));
  app.get('/api/token', async (c) => {
    const solicitud = validar(c.req.query());
    if (typeof solicitud === 'string') return c.json({ error: solicitud }, 400);
    const token = await emitirToken(config, solicitud, topeSala);
    return c.json({
      token,
      sala: solicitud.sala,
      identidad: solicitud.identidad,
      puerto: puertoLiveKit(config.url),
    });
  });
  return app;
}
