import { readFileSync } from 'node:fs';

/**
 * Lee `ANTHROPIC_API_KEY` de un .env sin versionar con un parser mínimo.
 * Nunca registra ni imprime la clave, ni siquiera en un error: si algo falla, devuelve `undefined`.
 */
export function leerClave(rutaEnv: string): string | undefined {
  let contenido: string;
  try {
    contenido = readFileSync(rutaEnv, 'utf8');
  } catch {
    return undefined;
  }
  let clave: string | undefined;
  for (const cruda of contenido.split(/\r?\n/)) {
    const linea = cruda.trim().replace(/^export\s+/, '');
    if (linea === '' || linea.startsWith('#')) continue;
    const igual = linea.indexOf('=');
    if (igual === -1 || linea.slice(0, igual).trim() !== 'ANTHROPIC_API_KEY') continue;
    let valor = linea.slice(igual + 1).trim();
    const comilla = valor[0];
    if ((comilla === '"' || comilla === "'") && valor.endsWith(comilla) && valor.length >= 2) {
      valor = valor.slice(1, -1);
    } else {
      valor = valor.replace(/\s+#.*$/, '');
    }
    clave = valor;
  }
  return clave === undefined || clave === '' ? undefined : clave;
}
