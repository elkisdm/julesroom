import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { crearRegistroUsoArchivo, type RegistroUso } from './registroUso';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const registro = (n: number): RegistroUso => ({
  t: n,
  agenteId: 'analista',
  conversacionId: 'conv-0001',
  motivo: 'completo',
  uso: { entrada: n, salida: 1, cacheLeida: 0, cacheEscrita: 0 },
});

describe('crearRegistroUsoArchivo', () => {
  it('crea la carpeta y añade una línea JSON por registro', () => {
    const dir = mkdtempSync(join(tmpdir(), 'uso-'));
    dirs.push(dir);
    const ruta = join(dir, 'nueva', 'uso.jsonl');
    const escribir = crearRegistroUsoArchivo(ruta);
    expect(existsSync(ruta)).toBe(false);
    escribir(registro(1));
    escribir(registro(2));
    const lineas = readFileSync(ruta, 'utf8').trimEnd().split('\n');
    expect(lineas.map((l) => JSON.parse(l))).toEqual([registro(1), registro(2)]);
  });
});
