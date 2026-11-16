import { describe, expect, it } from 'vitest';
import { AGENTES_SALA } from './agentes';
import {
  asignarTarea,
  avanzarTareas,
  estadoInicial,
  progresoTarea,
  TAREAS,
  type EstadoAgentes,
} from './tareas';

const agentes = AGENTES_SALA;
const T0 = 1_000_000;
const PROHIBIDAS = /compr[aá]|vend[eé]|garantiz|rentabilidad|gananc|señal/i;

describe('tareas de ejemplo', () => {
  it('cada agente de la sala tiene entre dos y cuatro tareas con resultado', () => {
    for (const a of agentes) {
      const lista = TAREAS[a.depto]();
      expect(lista.length, a.depto).toBeGreaterThanOrEqual(2);
      expect(lista.length, a.depto).toBeLessThanOrEqual(4);
      for (const t of lista) {
        expect(t.texto.length).toBeGreaterThan(8);
        expect(t.resultado.length).toBeGreaterThan(8);
        expect(t.segundos).toBeGreaterThanOrEqual(4);
        expect(`${t.texto} ${t.resultado}`).not.toMatch(PROHIBIDAS);
      }
    }
  });
});

describe('asignar y avanzar', () => {
  const inicial = estadoInicial(agentes);
  const id = agentes[0]!.id;
  const tarea = TAREAS[agentes[0]!.depto]()[0]!;

  it('al partir nadie tiene tarea y cada uno muestra su último resultado', () => {
    for (const a of agentes) {
      expect(inicial[a.id]!.tarea).toBeNull();
      expect(inicial[a.id]!.ultimo).toBe(a.resultado);
    }
  });

  it('asignar deja al agente trabajando en esa tarea', () => {
    const e = asignarTarea(inicial, id, tarea, T0);
    expect(e[id]!.tarea).toMatchObject({
      id: tarea.id,
      desde: T0,
      hasta: T0 + tarea.segundos * 1000,
    });
    expect(inicial[id]!.tarea).toBeNull();
  });

  it('no se le da otra tarea mientras trabaja', () => {
    const e = asignarTarea(inicial, id, tarea, T0);
    expect(() => asignarTarea(e, id, tarea, T0 + 10)).toThrow(/ya tiene una tarea/);
  });

  it('avanzar antes de tiempo no cambia nada (misma referencia)', () => {
    const e = asignarTarea(inicial, id, tarea, T0);
    const r = avanzarTareas(e, T0 + 500);
    expect(r.estados).toBe(e);
    expect(r.terminadas).toEqual([]);
  });

  it('al cumplirse el tiempo deja el resultado y queda libre', () => {
    const e: EstadoAgentes = asignarTarea(inicial, id, tarea, T0);
    const r = avanzarTareas(e, T0 + tarea.segundos * 1000);
    expect(r.estados[id]!.tarea).toBeNull();
    expect(r.estados[id]!.ultimo).toBe(tarea.resultado);
    expect(r.estados[id]!.hechas).toBe(1);
    expect(r.terminadas).toEqual([
      { agenteId: id, tarea: tarea.texto, resultado: tarea.resultado },
    ]);
  });

  it('el progreso va de 0 a 1 y no se pasa', () => {
    const t = asignarTarea(inicial, id, tarea, T0)[id]!.tarea!;
    expect(progresoTarea(t, T0)).toBe(0);
    expect(progresoTarea(t, T0 + (tarea.segundos * 1000) / 2)).toBeCloseTo(0.5);
    expect(progresoTarea(t, T0 + tarea.segundos * 5000)).toBe(1);
  });

  it('un agente desconocido es un error', () => {
    expect(() => asignarTarea(inicial, 'nadie', tarea, T0)).toThrow(/desconocido/);
  });
});
