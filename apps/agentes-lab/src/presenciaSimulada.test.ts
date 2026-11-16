import { describe, expect, it } from 'vitest';
import { estadoSimulado, presenciaSimulada } from './presenciaSimulada';

describe('estadoSimulado', () => {
  it('recorre escuchando → pensando → respondiendo y se apaga hasta el siguiente ciclo', () => {
    expect(estadoSimulado(1_000)).toBe('escuchando');
    expect(estadoSimulado(4_000)).toBe('pensando');
    expect(estadoSimulado(9_000)).toBe('respondiendo');
    expect(estadoSimulado(15_000)).toBeNull();
    expect(estadoSimulado(21_000)).toBe('escuchando');
  });
});

describe('presenciaSimulada', () => {
  it('crea la presencia con el instante del cambio y la conserva mientras el estado no cambia', () => {
    const p1 = presenciaSimulada('disenadora', 'p-camila', 1_000, null);
    expect(p1).toEqual({
      agenteId: 'disenadora',
      conPersonaId: 'p-camila',
      estado: 'escuchando',
      desde: 1_000,
    });
    expect(presenciaSimulada('disenadora', 'p-camila', 2_000, p1)).toBe(p1);
    const p2 = presenciaSimulada('disenadora', 'p-camila', 4_000, p1);
    expect(p2).toMatchObject({ estado: 'pensando', desde: 4_000 });
  });

  it('es null fuera de la conversación', () => {
    expect(presenciaSimulada('disenadora', 'p-camila', 16_000, null)).toBeNull();
  });

  it('un indicador huérfano expira pasado el ttl', () => {
    const vieja = {
      agenteId: 'disenadora',
      conPersonaId: 'p',
      estado: 'respondiendo' as const,
      desde: -10_000,
    };
    expect(presenciaSimulada('disenadora', 'p', 12_000, vieja)).toBeNull();
  });
});
