import { getRequestListener } from '@hono/node-server';
import type { Plugin } from 'vite';
import { crearApp } from './app';
import { leerConfigLiveKit } from './config';

/** Plugin de Vite que monta el servidor de tokens bajo `/api` en el mismo origen. */
export function servidorSala(): Plugin {
  return {
    name: 'servidor-sala',
    configureServer(server) {
      const escuchar = getRequestListener(crearApp(leerConfigLiveKit(process.env)).fetch);
      server.middlewares.use((req, res, next) => {
        const ruta = (req.url ?? '').split('?')[0];
        if (ruta !== '/api' && !ruta?.startsWith('/api/')) return next();
        void escuchar(req, res);
      });
    },
  };
}
