import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { servidorSala } from './server/vitePlugin';

export default defineConfig({
  plugins: [react(), servidorSala()],
  // host abierto: la sala se prueba desde otro equipo de la red local.
  server: { port: 5328, strictPort: true, host: true },
  preview: { host: true },
});
