import { describe, expect, it } from 'vitest';
import { agentePorId, EQUIPO_EJEMPLO } from './ejemplos';
import { construirSistema } from './prompt';

describe('agentes de ejemplo', () => {
  it('son tres, marcados como ejemplo, con los ids y parámetros pedidos', () => {
    expect(EQUIPO_EJEMPLO.map((a) => a.id)).toEqual(['analista', 'disenadora', 'soporte']);
    for (const a of EQUIPO_EJEMPLO) {
      expect(a.ejemplo).toBe(true);
      expect(a.modelo).toBe('claude-haiku-5-5');
      expect(a.maxTokens).toBe(300);
      expect(a.memoriaMaxMensajes).toBe(8);
      expect(a.maxCaracteresEntrada).toBe(600);
    }
  });

  it('cada agente tiene personalidad, tono, saludo y límites propios', () => {
    for (const campo of ['personalidad', 'tono', 'saludo', 'nombre'] as const) {
      expect(new Set(EQUIPO_EJEMPLO.map((a) => a[campo])).size).toBe(3);
    }
    expect(new Set(EQUIPO_EJEMPLO.map((a) => a.limites.join('|'))).size).toBe(3);
  });

  it('cada agente conoce a los otros dos y no a sí mismo', () => {
    for (const a of EQUIPO_EJEMPLO) {
      const otros = EQUIPO_EJEMPLO.filter((o) => o.id !== a.id).map((o) => o.nombre);
      expect(a.sabeDelEquipo.map((e) => e.nombre).sort()).toEqual(otros.sort());
    }
  });

  it('generan sistemas distintos entre sí', () => {
    expect(new Set(EQUIPO_EJEMPLO.map(construirSistema)).size).toBe(3);
  });

  it('agentePorId encuentra o devuelve undefined', () => {
    expect(agentePorId('soporte')?.nombre).toBe('Guía');
    expect(agentePorId('nadie')).toBeUndefined();
  });
});
