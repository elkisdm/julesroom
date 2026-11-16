import { describe, expect, it } from 'vitest';
import { escenarioPorId } from '@oficina/motor';
import { entradaDe, puntoDeAparicion } from './aparicion';

describe('dónde aparece el avatar propio', () => {
  const entrada = escenarioPorId('trading').entradas[0]!;

  it('si todavía no caminó en esta sala (onboarding: nombre o ropa cambiados), aparece en la entrada', () => {
    // Antes caía en (0, 0): detrás de la mesa «Forex» de la sala de trading.
    expect(puntoDeAparicion(null, entrada)).toEqual({ x: entrada.x, z: entrada.z });
  });

  it('si ya caminó, al cambiarse de ropa sigue donde estaba', () => {
    expect(puntoDeAparicion({ x: -3.2, z: 1.5 }, entrada)).toEqual({ x: -3.2, z: 1.5 });
  });

  it('sin entrada en el escenario, el origen', () => {
    expect(puntoDeAparicion(null, undefined)).toEqual({ x: 0, z: 0 });
  });
});

describe('qué entrada usa cada persona', () => {
  const auditorio = escenarioPorId('auditorio').entradas;
  const ids = Array.from({ length: 20 }, (_, i) => `invitado-${i}-${'abcdef'[i % 6]}${i * 7919}`);

  it('el dueño (o quien está solo) usa siempre la primera entrada', () => {
    expect(entradaDe(auditorio, 'dueno-sala', false)).toBe(auditorio[0]);
  });

  it('los invitados se reparten entre las otras entradas, de forma estable por identidad', () => {
    const elegidas = ids.map((id) => entradaDe(auditorio, id, true));
    expect(elegidas.every((e) => e !== auditorio[0])).toBe(true);
    expect(new Set(elegidas).size).toBeGreaterThanOrEqual(10);
    expect(entradaDe(auditorio, ids[3]!, true)).toBe(elegidas[3]);
  });

  it('con una sola entrada, todos usan esa', () => {
    const una = escenarioPorId('trading').entradas;
    expect(entradaDe(una, ids[0]!, true)).toBe(una[0]);
    expect(entradaDe([], ids[0]!, true)).toBeUndefined();
  });
});
