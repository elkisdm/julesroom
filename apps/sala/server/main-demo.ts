/** Entrada del emisor público: no importa servidores ni rutas del laboratorio. */
import { serve } from '@hono/node-server';
import { leerConfigLiveKit } from './config';
import { crearAppDemo, leerOpcionesDemo } from './demo';

if (process.env.NODE_ENV !== 'production')
  throw new Error('El emisor público requiere NODE_ENV=production.');
const config = leerConfigLiveKit(process.env);
const url = new URL(config.url);
if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password)
  throw new Error('LIVEKIT_URL debe ser una URL WebSocket sin credenciales.');
const puerto = Number(process.env.PUERTO ?? '5370');
if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new Error('PUERTO inválido.');
const app = crearAppDemo(config, leerOpcionesDemo(process.env));
const servidor = serve({
  hostname: process.env.HOST ?? '0.0.0.0',
  port: puerto,
  fetch: (solicitud, entorno) =>
    app.fetch(solicitud, { ip: entorno.incoming.socket.remoteAddress }),
});
console.log(`Emisor de demo escuchando en el puerto ${puerto}.`);
for (const senal of ['SIGINT', 'SIGTERM'] as const) process.on(senal, () => servidor.close());
