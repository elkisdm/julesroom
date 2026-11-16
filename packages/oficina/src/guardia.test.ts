import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de datos: el repositorio es público, así que no puede arrastrar rutas de la máquina de
 * quien desarrolla ni claves. Recorre todo el monorepo (rutas y contenido). Si una regla falla,
 * se reemplaza el texto por uno genérico; no se agrega una excepción.
 */
export const REGLAS_GUARDIA = [
  { regla: 'ruta-personal', patron: /\/Users\/|homedir/i },
  { regla: 'ruta-personal', patron: /\/home\/[a-z]+\// },
  { regla: 'clave', patron: /sk-ant-|sk-proj-|BEGIN (RSA|PRIVATE)/ },
] as const;

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** `knowledge` queda fuera: es la base de conocimiento instalada por devground, no código del producto. */
const IGNORADOS = new Set(['node_modules', '.git', 'dist', 'coverage', '.husky', 'knowledge']);
const IGNORADOS_ARCHIVO = new Set(['pnpm-lock.yaml']);
const BINARIO = /\.(webp|png|jpe?g|gif|ico|avif|glb|bin|ktx2|woff2?|ttf|otf|zip|mp3|wav|mp4)$/i;
/** La propia guardia nombra lo que busca. */
const EXENTOS = new Set(['packages/oficina/src/guardia.test.ts']);

function* archivos(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORADOS.has(e.name) || IGNORADOS_ARCHIVO.has(e.name)) continue;
    const ruta = join(dir, e.name);
    if (e.isDirectory()) yield* archivos(ruta);
    else if (e.isFile()) yield ruta;
  }
}

export function revisar(texto: string, ruta: string): string[] {
  return REGLAS_GUARDIA.filter((r) => r.patron.test(texto)).map((r) => `${ruta}: ${r.regla}`);
}

describe('guardia de datos', () => {
  it('cada regla detecta su caso borde', () => {
    expect(revisar('/Users/alguien/proyecto', 'a.md')).toHaveLength(1);
    expect(revisar('cd /home/alguien/proyecto', 'a.md')).toHaveLength(1);
    expect(revisar('ANTHROPIC=sk-ant-abc', 'a.env')).toHaveLength(1);
    expect(revisar('Flechas/Home/End seleccionan', 'a.md')).toHaveLength(0);
    expect(revisar('Asistente genérico del equipo', 'a.ts')).toHaveLength(0);
  });

  it('ningún archivo del monorepo contiene rutas personales ni claves', () => {
    const hallazgos: string[] = [];
    for (const abs of archivos(RAIZ)) {
      const ruta = relative(RAIZ, abs);
      if (EXENTOS.has(ruta)) continue;
      hallazgos.push(...revisar(ruta, `${ruta} (ruta)`));
      if (BINARIO.test(ruta)) continue;
      const lineas = readFileSync(abs, 'utf8').split('\n');
      lineas.forEach((l, i) => hallazgos.push(...revisar(l, `${ruta}:${i + 1}`)));
    }
    expect(hallazgos).toEqual([]);
  });
});
