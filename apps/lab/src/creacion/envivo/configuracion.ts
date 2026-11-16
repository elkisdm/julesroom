/** Frontera de configuración: ninguna clave de proveedor pertenece al cliente. */
export function configuracionViva(env: Record<string, unknown>) {
  const emisor = env['VITE_URL_EMISOR_PASES'];
  const voz = env['VITE_LIVEKIT_URL'];
  if (typeof emisor === 'string' && typeof voz === 'string' && emisor && voz) {
    try {
      const e = new URL(emisor);
      const v = new URL(voz);
      if (
        !['http:', 'https:'].includes(e.protocol) ||
        !['ws:', 'wss:'].includes(v.protocol) ||
        e.username ||
        e.password ||
        v.username ||
        v.password
      )
        return null;
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(v.hostname);
      return {
        emisor: `${emisor.replace(/\/$/, '')}/api`,
        url: voz,
        local: false,
        rtcConfig: loopback ? { iceServers: [] } : undefined,
      };
    } catch {
      return null;
    }
  }
  if (env['DEV'] === true && env['VITE_SALA_EN_VIVO'] === '1')
    return {
      emisor: '/vivo',
      url: 'ws://127.0.0.1:7880',
      local: true,
      rtcConfig: { iceServers: [] },
    };
  return null;
}
export function enlacePublico(base: string, sala: string) {
  const u = new URL(base);
  u.search = new URLSearchParams({ sala }).toString();
  u.hash = '';
  return u.href;
}
/** Los parámetros de navegación no intervienen en la autorización. */
export function autorizarSesion(p: unknown) {
  if (!p || typeof p !== 'object') return null;
  if (
    !('sala' in p) ||
    typeof p.sala !== 'string' ||
    !p.sala ||
    !('identidad' in p) ||
    typeof p.identidad !== 'string' ||
    !('dueno' in p) ||
    typeof p.dueno !== 'string' ||
    !p.dueno ||
    !('invitado' in p) ||
    typeof p.invitado !== 'boolean'
  )
    return null;
  if (p.invitado ? !p.identidad.startsWith('invitado-') : p.identidad !== p.dueno) return null;
  return { sala: p.sala, yo: p.identidad, dueno: p.dueno, invitado: p.invitado };
}
export function estadoAnfitrion(invitado: boolean, presente: boolean, recibida: boolean) {
  if (!invitado || presente) return '';
  return recibida
    ? 'El anfitrión salió. Conservas el último mundo recibido.'
    : 'Esperando al anfitrión para recibir el mundo.';
}

export const REINTENTOS_DEMO = { inicialMs: 2000, maximoMs: 60000 };
/** Espera creciente y acotada para no saturar el emisor. */
export const esperaDemo = (intento: number) =>
  Math.min(REINTENTOS_DEMO.maximoMs, REINTENTOS_DEMO.inicialMs * 2 ** intento);
export const ERROR_RED_DEMO = 'No pudimos conectar; reintentando';
/** Incluye la carrera entre emitir un pase y ocupar el último lugar de LiveKit. */
export function mensajeConexion(causa: unknown): string {
  if (causa instanceof ErrorDemo) return causa.message;
  const texto = causa instanceof Error ? causa.message : String(causa);
  return /llena|room.*(full|capacity|limit)|max.*participants/i.test(texto)
    ? 'La sala está llena (25). Entrarás apenas se libere un lugar'
    : ERROR_RED_DEMO;
}
/** Sólo los errores de llave requieren intervención. */
export class ErrorDemo extends Error {
  constructor(
    mensaje: string,
    readonly reintentar: boolean,
  ) {
    super(mensaje);
  }
}
/** Solicitud sin credenciales en la URL, acotada por tiempo. */
export async function solicitarDemo(emisor: string, ruta: string, datos: object, fetcher = fetch) {
  const r = await fetcher(`${emisor}/${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
    signal: AbortSignal.timeout(5000),
  });
  if (r.status === 429)
    throw new ErrorDemo('Hay mucha gente entrando a la vez, reintentando…', true);
  if (r.status >= 500) throw new ErrorDemo(ERROR_RED_DEMO, true);
  const respuesta = await r.json();
  if (!r.ok)
    throw new ErrorDemo(respuesta.error || 'No se pudo entrar a la demo.', r.status === 409);
  return respuesta;
}
