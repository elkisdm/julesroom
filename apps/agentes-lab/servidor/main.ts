import { serve } from '@hono/node-server';
import { crearProveedorClaude } from '@oficina/agentes/claude';
import { EQUIPO_EJEMPLO, ErrorProveedor, type Proveedor } from '@oficina/agentes';
import { fileURLToPath } from 'node:url';
import { crearApp } from './app';
import { CONFIG_INICIAL } from './config';
import { leerClave } from './env';
import { crearRegistroUsoArchivo } from './registroUso';

/**
 * La clave vive fuera del repo (`~/.config/oficina-agentes/.env`) para que no se versione ni la lea la guardia de
 * datos; `apps/agentes-lab/.env` (sin versionar) sirve de respaldo. `AGENTES_ENV` fuerza otra ruta.
 */
const rutasEnv = [
  process.env.AGENTES_ENV,
  `${process.env.HOME ?? ''}/.config/oficina-agentes/.env`,
  fileURLToPath(new URL('../.env', import.meta.url)),
].filter((r): r is string => !!r);
const rutaUso = fileURLToPath(new URL('../.uso/uso.jsonl', import.meta.url));

const clave = rutasEnv.map((r) => leerClave(r)).find((c) => !!c);
/** Sin clave la sala sigue: el agente lo dice en su voz (`sin-clave`). */
const sinClave: Proveedor = {
  async *transmitir() {
    throw new ErrorProveedor('sin-clave');
  },
};
const proveedor = clave ? crearProveedorClaude({ clave }) : sinClave;

const app = crearApp({
  proveedor,
  clave: clave !== undefined,
  registroUso: crearRegistroUsoArchivo(rutaUso),
});

const servidor = serve(
  { fetch: app.fetch, port: CONFIG_INICIAL.puerto, hostname: '127.0.0.1' },
  () => {
    console.log(
      `agentes-lab servidor: puerto ${CONFIG_INICIAL.puerto}, modelo ${EQUIPO_EJEMPLO[0]?.modelo}, clave ${clave ? 'sí' : 'no'}`,
    );
  },
);

function cerrar(): void {
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
