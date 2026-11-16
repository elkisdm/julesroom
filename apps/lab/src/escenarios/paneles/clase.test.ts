import { describe, expect, it } from 'vitest';
import { avanceClase, claseInicial, detalleClase, exponer, SEGUNDOS_CLASE } from './clase';
import { CURSOS } from './contenido';

const T0 = 5_000_000;

describe('clase del aula', () => {
  it('al entrar ya hay una clase en curso, con algo de avance', () => {
    const c = claseInicial(T0);
    const avance = avanceClase(c, T0);
    expect(avance).toBeGreaterThan(0);
    expect(avance).toBeLessThan(0.5);
    expect(detalleClase(c).leccion.titulo.length).toBeGreaterThan(3);
  });

  it('exponer otra lección la deja en la pantalla desde cero, con quien expone', () => {
    const curso = CURSOS[2]!;
    const leccion = curso.lecciones[1]!;
    const c = exponer(curso.id, leccion.id, 'Tú', T0);
    expect(c).toMatchObject({ cursoId: curso.id, leccionId: leccion.id, expositor: 'Tú' });
    expect(avanceClase(c, T0)).toBe(0);
    const d = detalleClase(c);
    expect(d.curso.id).toBe(curso.id);
    expect(d.numero).toBe(2);
    expect(d.total).toBeGreaterThanOrEqual(d.numero);
  });

  it('el avance corre con el tiempo y se detiene al final', () => {
    const c = exponer(CURSOS[0]!.id, CURSOS[0]!.lecciones[0]!.id, 'Andrés', T0);
    expect(avanceClase(c, T0 + (SEGUNDOS_CLASE * 1000) / 4)).toBeCloseTo(0.25);
    expect(avanceClase(c, T0 + SEGUNDOS_CLASE * 3000)).toBe(1);
  });

  it('una lección que no existe es un error', () => {
    expect(() => exponer('nada', 'x', 'Tú', T0)).toThrow(/no existe/);
    expect(() => exponer(CURSOS[0]!.id, 'x', 'Tú', T0)).toThrow(/no existe/);
  });
});
