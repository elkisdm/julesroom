import { describe, expect, it } from 'vitest';
import { presenciaPropia } from './presenciaPropia';

describe('presenciaPropia', () => {
  it('es null con la conversación cerrada', () => {
    expect(presenciaPropia('cerrada', null, 1, null)).toBeNull();
  });

  it('traduce la fase al estado de presencia, sin contenido', () => {
    const p = presenciaPropia('pensando', 'analista', 100, null);
    expect(p).toEqual({
      agenteId: 'analista',
      conPersonaId: 'avatar-propio',
      estado: 'pensando',
      desde: 100,
    });
    expect(presenciaPropia('abierta', 'analista', 5, null)?.estado).toBe('escuchando');
    expect(presenciaPropia('respondiendo', 'analista', 5, null)?.estado).toBe('respondiendo');
  });

  it('conserva la misma presencia mientras el estado no cambia', () => {
    const p = presenciaPropia('abierta', 'analista', 1, null);
    expect(presenciaPropia('error', 'analista', 9, p)).toBe(p);
    expect(presenciaPropia('pensando', 'analista', 9, p)?.desde).toBe(9);
  });
});
