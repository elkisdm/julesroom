import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { leerClave } from './env';

const dirs: string[] = [];
function env(contenido: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'env-'));
  dirs.push(dir);
  const ruta = join(dir, '.env');
  writeFileSync(ruta, contenido);
  return ruta;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('leerClave', () => {
  it('lee la clave simple', () => {
    expect(leerClave(env('ANTHROPIC_API_KEY=falsa-123\n'))).toBe('falsa-123');
  });
  it('ignora comentarios, otras variables, export y comillas', () => {
    expect(leerClave(env('# nota\nOTRA=x\nexport ANTHROPIC_API_KEY="falsa-456"\n'))).toBe(
      'falsa-456',
    );
  });
  it('quita comentario al final de la línea sin comillas', () => {
    expect(leerClave(env('ANTHROPIC_API_KEY=falsa-789 # mi clave\n'))).toBe('falsa-789');
  });
  it('devuelve undefined si falta, está vacía o el archivo no existe', () => {
    expect(leerClave(env('OTRA=1\n'))).toBeUndefined();
    expect(leerClave(env('ANTHROPIC_API_KEY=\n'))).toBeUndefined();
    expect(leerClave('/ruta/que/no/existe/.env')).toBeUndefined();
  });
});
