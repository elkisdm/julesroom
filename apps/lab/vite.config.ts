import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'vista-previa-estatica',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const publica =
            process.env.VITE_URL_PUBLICA ??
            loadEnv(mode, import.meta.dirname).VITE_URL_PUBLICA ??
            '';
          // Solo un origen HTTP(S) público; evita insertar atributos o credenciales en el HTML.
          const origen = /^https?:\/\/[^\s/"'<>?#@]+\/?$/.test(publica)
            ? new URL(publica).origin
            : '';
          return html.replaceAll('__URL_PUBLICA__', origen);
        },
      },
    },
  ],
  // Cada página del laboratorio es una entrada propia: sin esto la compilación solo empaqueta index.html.
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        [
          'index',
          'crear',
          'escenarios',
          'caminata',
          'movimiento',
          'grafica',
          'cuadro',
          'interfaz',
        ].map((n) => [n, resolve(import.meta.dirname, `${n}.html`)]),
      ),
      output: {
        manualChunks(id) {
          if (id.includes('packages/oficina') || id.includes('@oficina/motor')) {
            return 'motor-oficina';
          }
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('three') || id.includes('@react-three')) return 'motor-3d';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5321,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/vivo': {
        target: 'http://127.0.0.1:8797',
        rewrite: (p) => p.replace(/^\/vivo/, '/api'),
        configure(proxy) {
          proxy.on('error', (_error, _req, res) => {
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(204);
              res.end();
            }
          });
        },
      },
      '/api': { target: 'http://127.0.0.1:8798', rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
  preview: { host: '127.0.0.1' },
}));
