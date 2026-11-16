import { describe, expect, it } from 'vitest';
import { crearPresenciaConversacion, expiro } from './presencia';

describe('presencia de conversación', () => {
  it('crea solo datos: agente, persona, estado y marca de tiempo', () => {
    expect(crearPresenciaConversacion('analista', 'p1', 'pensando', 1000)).toEqual({
      agenteId: 'analista',
      conPersonaId: 'p1',
      estado: 'pensando',
      desde: 1000,
    });
  });

  it('expira pasado el ttl (15 s por defecto) y no antes', () => {
    const p = crearPresenciaConversacion('a', 'p', 'escuchando', 1000);
    expect(expiro(p, 1000 + 15000)).toBe(false);
    expect(expiro(p, 1000 + 15001)).toBe(true);
  });

  it('acepta un ttl propio', () => {
    const p = crearPresenciaConversacion('a', 'p', 'escuchando', 0);
    expect(expiro(p, 600, 500)).toBe(true);
    expect(expiro(p, 400, 500)).toBe(false);
  });
});
