import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Uso } from '@oficina/agentes';

/** Una línea por respuesta terminada (también con error). Solo se mide (ADR 0008). */
export interface RegistroUso {
  t: number;
  agenteId: string;
  conversacionId: string;
  motivo: 'completo' | 'tope' | 'error';
  uso: Uso;
}

export type FnRegistroUso = (registro: RegistroUso) => void;

/** Añade una línea JSON por registro a `ruta` (crea la carpeta). */
export function crearRegistroUsoArchivo(ruta: string): FnRegistroUso {
  return (registro) => {
    mkdirSync(dirname(ruta), { recursive: true });
    appendFileSync(ruta, `${JSON.stringify(registro)}\n`);
  };
}
