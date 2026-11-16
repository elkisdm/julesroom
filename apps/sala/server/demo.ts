import { Hono, type Context } from 'hono';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { AccessToken, RoomConfiguration, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import type { ConfigLiveKit } from './config';

/** Límites de la demo efímera; los contadores se reinician al reiniciar el proceso. */
export const PARAMETROS_DEMO = {
  topeSala: 25,
  maxSalas: 10,
  pasesMinuto: 120,
  intentosIpMinuto: 30,
  ttlPaseSegundos: 300,
  ttlSalaSegundos: 14_400,
  cuerpoBytes: 2048,
  ipsRecordadas: 10_000,
  minutoMs: 60_000,
  consultaLivekitSegundos: 2,
};
export interface OpcionesDemo {
  origen: string;
  llaveDemo?: string;
  cabeceraIp?: string;
  topeSala?: number;
  maxSalas?: number;
  pasesMinuto?: number;
  intentosIpMinuto?: number;
  ttlPaseSegundos?: number;
  ttlSalaSegundos?: number;
  ahora?: () => number;
  /** Frontera de LiveKit inyectable para verificar cupo sin emitir pases. */
  participantes?: (sala: string) => Promise<{ identity: string }[]>;
}

/** Lee sólo configuración explícita del emisor público y falla ante valores inseguros. */
export function leerOpcionesDemo(env: Record<string, string | undefined>): OpcionesDemo {
  const origen = env.DEMO_ORIGEN ?? '';
  let url: URL;
  try {
    url = new URL(origen);
  } catch {
    throw new Error('DEMO_ORIGEN debe ser un origen HTTP(S) exacto.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origen)
    throw new Error('DEMO_ORIGEN debe ser un origen HTTP(S) exacto.');
  const entero = (nombre: string, defecto: number, minimo: number, maximo: number) => {
    const texto = env[nombre];
    const valor = texto === undefined ? defecto : Number(texto);
    if (
      !Number.isSafeInteger(valor) ||
      valor < minimo ||
      valor > maximo ||
      (texto !== undefined && !/^\d+$/.test(texto))
    )
      throw new Error(`${nombre} debe ser un entero entre ${minimo} y ${maximo}.`);
    return valor;
  };
  const cabeceraIp = env.DEMO_CABECERA_IP || undefined;
  if (cabeceraIp && !/^[a-zA-Z0-9-]{1,64}$/.test(cabeceraIp))
    throw new Error('DEMO_CABECERA_IP inválida.');
  return {
    origen,
    llaveDemo: env.DEMO_LLAVE || undefined,
    cabeceraIp,
    topeSala: entero('DEMO_TOPE_SALA', PARAMETROS_DEMO.topeSala, 1, 25),
    maxSalas: entero('DEMO_MAX_SALAS', PARAMETROS_DEMO.maxSalas, 1, 1000),
    pasesMinuto: entero('DEMO_PASES_MINUTO', PARAMETROS_DEMO.pasesMinuto, 1, 10000),
    intentosIpMinuto: entero('DEMO_INTENTOS_IP_MINUTO', PARAMETROS_DEMO.intentosIpMinuto, 1, 10000),
    ttlPaseSegundos: entero('DEMO_TTL_PASE_SEGUNDOS', PARAMETROS_DEMO.ttlPaseSegundos, 30, 300),
    ttlSalaSegundos: entero('DEMO_TTL_SALA_SEGUNDOS', PARAMETROS_DEMO.ttlSalaSegundos, 300, 86400),
  };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const huella = (secreto: string) => createHash('sha256').update(secreto).digest();
const iguales = (a: string, b: string) => timingSafeEqual(huella(a), huella(b));
type Entorno = { Bindings: { ip?: string } };

/** API pública sin cuentas: el secreto de creación autoriza al anfitrión, nunca la URL. */
export function crearAppDemo(config: ConfigLiveKit, opciones: OpcionesDemo): Hono<Entorno> {
  const p = { ...PARAMETROS_DEMO, ...opciones };
  if (!Number.isInteger(p.topeSala) || p.topeSala < 1 || p.topeSala > 25)
    throw new Error('Tope de sala inválido.');
  const ahora = opciones.ahora ?? Date.now;
  const salas = new Map<string, { dueno: string; secreto: Buffer; expira: number }>();
  const ips = new Map<string, { minuto: number; intentos: number }>();
  let pases = { minuto: -1, cantidad: 0 };
  const administracion = new RoomServiceClient(
    config.url.replace(/^ws/, 'http'),
    config.apiKey,
    config.apiSecret,
    { requestTimeout: PARAMETROS_DEMO.consultaLivekitSegundos },
  );
  const participantes =
    opciones.participantes ??
    (async (sala: string) => {
      const existentes = await administracion.listRooms([sala]);
      return existentes.length ? administracion.listParticipants(sala) : [];
    });
  const app = new Hono<Entorno>();
  app.use('*', async (c, siguiente) => {
    c.header('Cache-Control', 'no-store');
    c.header('Vary', 'Origin');
    const origen = c.req.header('origin');
    if (origen === p.origen) {
      c.header('Access-Control-Allow-Origin', p.origen);
      c.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type');
    } else if (origen || c.req.method === 'POST' || c.req.method === 'OPTIONS') {
      return c.json({ error: 'Origen no permitido.' }, 403);
    }
    if (c.req.method === 'OPTIONS') return c.body(null, 204);
    await siguiente();
  });
  app.get('/api/salud', (c) => c.json({ ok: true, llaveRequerida: !!p.llaveDemo }));
  app.use('/api/*', async (c, siguiente) => {
    if (c.req.method !== 'POST') return siguiente();
    const minuto = Math.floor(ahora() / p.minutoMs);
    for (const [ip, cuenta] of ips) if (cuenta.minuto !== minuto) ips.delete(ip);
    // Sin cabecera confiable configurada se usa únicamente la conexión del adaptador Node.
    const ip = (p.cabeceraIp ? c.req.header(p.cabeceraIp) : c.env?.ip) ?? 'sin-ip';
    const clave = ip.length <= 128 ? ip : 'ip-invalida';
    const cuenta = ips.get(clave);
    if (
      (!cuenta && ips.size >= p.ipsRecordadas) ||
      (cuenta && cuenta.intentos >= p.intentosIpMinuto)
    )
      return c.json({ error: 'Demasiados intentos. Espera un minuto.' }, 429);
    ips.set(clave, { minuto, intentos: (cuenta?.intentos ?? 0) + 1 });
    await siguiente();
  });
  async function cuerpo(c: Context<Entorno>): Promise<Record<string, unknown> | Response> {
    if (!c.req.header('content-type')?.startsWith('application/json'))
      return c.json({ error: 'Se requiere JSON.' }, 415);
    // Cuenta los bytes leídos, sin cargar en memoria un cuerpo arbitrariamente grande.
    const lector = c.req.raw.body?.getReader();
    if (!lector) return c.json({ error: 'Falta el cuerpo JSON.' }, 400);
    const bloques: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const bloque = await lector.read();
      if (bloque.done) break;
      bytes += bloque.value.byteLength;
      if (bytes > p.cuerpoBytes) {
        await lector.cancel();
        return c.json({ error: 'Cuerpo demasiado grande.' }, 413);
      }
      bloques.push(bloque.value);
    }
    let datos: unknown;
    try {
      datos = JSON.parse(Buffer.concat(bloques).toString());
    } catch {
      return c.json({ error: 'JSON inválido.' }, 400);
    }
    if (!datos || typeof datos !== 'object' || Array.isArray(datos))
      return c.json({ error: 'Objeto JSON requerido.' }, 400);
    return datos as Record<string, unknown>;
  }
  const limpiarSalas = () => {
    for (const [id, sala] of salas) if (sala.expira <= ahora()) salas.delete(id);
  };
  const llaveValida = (datos: Record<string, unknown>) =>
    !p.llaveDemo || (typeof datos.llaveDemo === 'string' && iguales(datos.llaveDemo, p.llaveDemo));
  app.post('/api/salas', async (c) => {
    const datos = await cuerpo(c);
    if (datos instanceof Response) return datos;
    if (
      Object.keys(datos).some((k) => k !== 'llaveDemo') ||
      (datos.llaveDemo !== undefined && typeof datos.llaveDemo !== 'string')
    )
      return c.json({ error: 'Datos de creación inválidos.' }, 400);
    if (!llaveValida(datos)) return c.json({ error: 'La llave de demo es incorrecta.' }, 401);
    limpiarSalas();
    if (salas.size >= p.maxSalas)
      return c.json({ error: 'La demo alcanzó su límite de salas.' }, 429);
    const sala = randomUUID();
    const secretoDueno = randomBytes(32).toString('hex');
    const dueno = `dueno-${sala}`;
    salas.set(sala, {
      dueno,
      secreto: huella(secretoDueno),
      expira: ahora() + p.ttlSalaSegundos * 1000,
    });
    return c.json({ sala, secretoDueno, dueno }, 201);
  });
  app.post('/api/pases', async (c) => {
    const datos = await cuerpo(c);
    if (datos instanceof Response) return datos;
    const { sala, identidad, nombre, secretoDueno } = datos;
    if (
      Object.keys(datos).some(
        (k) => !['sala', 'identidad', 'nombre', 'secretoDueno', 'llaveDemo'].includes(k),
      ) ||
      typeof sala !== 'string' ||
      !uuid.test(sala) ||
      typeof identidad !== 'string' ||
      !uuid.test(identidad) ||
      typeof nombre !== 'string' ||
      !nombre.trim() ||
      nombre.trim().length > 40 ||
      /[\u0000-\u001f\u007f]/.test(nombre) ||
      (secretoDueno !== undefined &&
        (typeof secretoDueno !== 'string' || !/^[0-9a-f]{64}$/.test(secretoDueno))) ||
      (datos.llaveDemo !== undefined && typeof datos.llaveDemo !== 'string')
    )
      return c.json({ error: 'Datos del pase inválidos.' }, 400);
    if (!llaveValida(datos)) return c.json({ error: 'La llave de demo es incorrecta.' }, 401);
    limpiarSalas();
    const registrada = salas.get(sala);
    if (!registrada) return c.json({ error: 'La sala no existe o expiró.' }, 404);
    if (
      secretoDueno !== undefined &&
      !timingSafeEqual(huella(secretoDueno as string), registrada.secreto)
    )
      return c.json({ error: 'El secreto de anfitrión es incorrecto.' }, 403);
    const minuto = Math.floor(ahora() / p.minutoMs);
    if (pases.minuto !== minuto) pases = { minuto, cantidad: 0 };
    if (pases.cantidad >= p.pasesMinuto)
      return c.json({ error: 'Se alcanzó el límite de pases. Espera un minuto.' }, 429);
    pases.cantidad++;
    const invitado = secretoDueno === undefined;
    const id = invitado ? `invitado-${identidad}` : registrada.dueno;
    try {
      const presentes = await participantes(sala);
      // La misma identidad puede reconectarse incluso cuando el cupo está completo.
      if (presentes.length >= p.topeSala && !presentes.some((persona) => persona.identity === id))
        return c.json(
          { error: `La sala está llena (${p.topeSala}). Entrarás apenas se libere un lugar` },
          409,
        );
    } catch {
      // Si la consulta de cupo falla (red o LiveKit lento), no se deja a todos fuera:
      // LiveKit aplica el mismo tope por sala al conectar.
    }
    const token = new AccessToken(config.apiKey, config.apiSecret, {
      identity: id,
      name: nombre.trim(),
      ttl: p.ttlPaseSegundos,
    });
    token.addGrant({
      room: sala,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // El perfil de presencia usa metadata; ningún permiso de anfitrión depende de ella.
      canUpdateOwnMetadata: true,
      canPublishSources: [TrackSource.MICROPHONE],
    });
    token.roomConfig = new RoomConfiguration({ maxParticipants: p.topeSala });
    return c.json({
      token: await token.toJwt(),
      sala,
      identidad: id,
      dueno: registrada.dueno,
      url: config.url,
      invitado,
    });
  });
  app.onError((_error, c) => c.json({ error: 'No se pudo procesar la solicitud.' }, 500));
  return app;
}
