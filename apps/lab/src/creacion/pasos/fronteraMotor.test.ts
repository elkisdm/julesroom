import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

function fuentes(ruta: string): string[] {
  return readdirSync(ruta, { withFileTypes: true }).flatMap((e) => {
    if (['node_modules', 'dist', '.git'].includes(e.name)) return [];
    const archivo = resolve(ruta, e.name);
    return e.isDirectory() ? fuentes(archivo) : /\.[cm]?[jt]sx?$/.test(e.name) ? [archivo] : [];
  });
}
it('apps consume el motor por su API pública, nunca por rutas relativas a src', () => {
  const infractores = fuentes(resolve(import.meta.dirname, '../../../..')).filter((ruta) =>
    /(?:from\s*|import\s*\(?\s*)['"]\.\.[^'"]*packages\/oficina\/src/.test(
      readFileSync(ruta, 'utf8'),
    ),
  );
  expect(infractores).toEqual([]);
});
