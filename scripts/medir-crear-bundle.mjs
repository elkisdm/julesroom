/**
 * Suma gzip de cada JS que crear.html pide al cargar (script + modulepreload).
 * Uso: node scripts/medir-crear-bundle.mjs [ruta/dist]
 */
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';

const dist = process.argv[2] ?? join(import.meta.dirname, '../apps/lab/dist');
const html = readFileSync(join(dist, 'crear.html'), 'utf8');
const hrefs = new Set();
for (const m of html.matchAll(/(?:src|href)="([^"]+\.js)"/g)) hrefs.add(m[1].replace(/^\//, ''));

const filas = [];
let total = 0;
for (const href of [...hrefs].sort()) {
  const ruta = join(dist, href);
  if (!existsSync(ruta)) continue;
  const raw = readFileSync(ruta);
  const gz = gzipSync(raw).length;
  filas.push({ archivo: href.split('/').pop(), href, bytes: raw.length, gzip: gz });
  total += gz;
}
console.log(JSON.stringify({ dist, totalGzip: total, archivos: filas }, null, 2));
