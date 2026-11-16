import { atuendoPorRol } from '@oficina/motor';
import type { Atuendo } from '@oficina/motor';

/** Apariencias rápidas: un rol del vestuario base y el color de su prenda para el selector. */
export const APARIENCIAS = [
  { rol: 'Front designer', etiqueta: 'Diseño', color: '#b98ad6' },
  { rol: 'Backend', etiqueta: 'Código', color: '#2b2f36' },
  { rol: 'QA', etiqueta: 'Calidad', color: '#7fc4de' },
  { rol: 'Ejecutivo de ventas', etiqueta: 'Ventas', color: '#3b3f46' },
  { rol: 'Redactor', etiqueta: 'Texto', color: '#d9825f' },
  { rol: 'Planificador', etiqueta: 'Plan', color: '#3f6b52' },
  { rol: 'Coach', etiqueta: 'Deporte', color: '#5b7fd6' },
  { rol: 'Científico', etiqueta: 'Ciencia', color: '#e9ecef' },
] as const;

/** Atuendo de una apariencia rápida; `variante` cambia piel, cara y pelo. */
export function atuendoDe(rol: string, variante: number): Atuendo {
  return atuendoPorRol(rol, variante);
}

/** Identidad corta y única por pestaña (letras y números: la acepta el servidor de tokens). */
export function nuevaIdentidad(azar: () => number = Math.random): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = 'u-';
  for (let i = 0; i < 8; i++) s += letras[Math.floor(azar() * letras.length)];
  return s;
}

/** Nombre de la sala de LiveKit de una oficina: `org:<id>:oficina:<id>` (ADR-0006). */
export function nombreDeSala(oficina: string, organizacion = 'demo'): string {
  const limpio = (t: string) => t.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 24) || 'x';
  return `org:${limpio(organizacion)}:oficina:${limpio(oficina)}`;
}

/** URL del servidor de LiveKit a partir de la página: mismo equipo, otro puerto (`ws`, o `wss` bajo https). */
export function urlLiveKit(pagina: { protocol: string; hostname: string }, puerto: number): string {
  const esquema = pagina.protocol === 'https:' ? 'wss' : 'ws';
  const host = pagina.hostname.includes(':') ? `[${pagina.hostname}]` : pagina.hostname;
  return `${esquema}://${host}:${puerto}`;
}

/** Enlace de la sala para abrir en otro equipo: si la página está en `localhost`, usa la IP de la red local. */
export function enlaceDeSala(
  pagina: { protocol: string; hostname: string; port: string },
  ipLocal: string | undefined,
  sala: string,
  escenario: string,
): string {
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(pagina.hostname);
  const host = local && ipLocal ? ipLocal : pagina.hostname;
  const puerto = pagina.port ? `:${pagina.port}` : '';
  return `${pagina.protocol}//${host}${puerto}/?sala=${encodeURIComponent(sala)}&escenario=${encodeURIComponent(escenario)}`;
}
