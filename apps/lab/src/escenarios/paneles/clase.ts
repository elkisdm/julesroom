import { CURSOS, lecciones } from './contenido';
import type { Curso, Leccion } from './contenido';

/**
 * La lección que se proyecta en la pantalla del aula. La expone quien anima la sala; todos la ven
 * igual. La barra avanza sola (no hay video real).
 */
export interface Clase {
  cursoId: string;
  leccionId: string;
  expositor: string;
  desde: number;
}

/** Lo que dura en la demo una lección proyectada, sea cual sea su duración real. */
export const SEGUNDOS_CLASE = 150;
const INICIAL = { cursoId: 'soportes-y-resistencias', leccionId: 'n1', expositor: 'Andrés' };
/** La clase con la que parte la sala: ya lleva un rato. */
const YA_VA = 0.18;

export function exponer(cursoId: string, leccionId: string, expositor: string, ahora: number): Clase {
  const curso = CURSOS.find((c) => c.id === cursoId);
  if (!curso) throw new Error(`El curso ${cursoId} no existe`);
  if (!lecciones(curso).some((l) => l.id === leccionId))
    throw new Error(`La lección ${leccionId} no existe en ${cursoId}`);
  return { cursoId, leccionId, expositor, desde: ahora };
}

export const claseInicial = (ahora: number): Clase => ({
  ...exponer(INICIAL.cursoId, INICIAL.leccionId, INICIAL.expositor, ahora),
  desde: ahora - YA_VA * SEGUNDOS_CLASE * 1000,
});

/** Cuánto de la lección se ha proyectado (0 a 1). */
export const avanceClase = (c: Clase, ahora: number) =>
  Math.min(1, Math.max(0, (ahora - c.desde) / (SEGUNDOS_CLASE * 1000)));

export interface DetalleClase {
  curso: Curso;
  leccion: Leccion;
  numero: number;
  total: number;
}

export function detalleClase(c: Clase): DetalleClase {
  const curso = CURSOS.find((x) => x.id === c.cursoId)!;
  const todas = lecciones(curso);
  const numero = todas.findIndex((l) => l.id === c.leccionId) + 1;
  return { curso, leccion: todas[numero - 1]!, numero, total: todas.length };
}
