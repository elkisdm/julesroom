import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5329,
    strictPort: true,
    host: '127.0.0.1',
    // El navegador solo habla con su propio origen; la clave vive en el servidor.
    proxy: { '/api': { target: 'http://127.0.0.1:8791', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
});
