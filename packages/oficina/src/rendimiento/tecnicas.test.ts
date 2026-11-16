import { describe, expect, it } from 'vitest';
import { TECNICAS_POR_NIVEL, tecnicasDe } from './tecnicas';

describe('tecnicasDe', () => {
  it('sin sobrescrituras devuelve las del nivel', () => {
    expect(tecnicasDe('media')).toEqual(TECNICAS_POR_NIVEL.media);
  });
  it('una sobrescritura cambia solo esa técnica', () => {
    const t = tecnicasDe('alta', { rim: false });
    expect(t.rim).toBe(false);
    expect(t.volumen).toBe(TECNICAS_POR_NIVEL.alta.volumen);
  });
  it('no muta la tabla de niveles', () => {
    tecnicasDe('alta', { blob: false });
    expect(TECNICAS_POR_NIVEL.alta.blob).toBe(true);
  });
  it('alta es la que más enciende: nada que baja tenga y alta no', () => {
    for (const k of Object.keys(
      TECNICAS_POR_NIVEL.baja,
    ) as (keyof typeof TECNICAS_POR_NIVEL.baja)[]) {
      const b = TECNICAS_POR_NIVEL.baja[k];
      const a = TECNICAS_POR_NIVEL.alta[k];
      if (typeof b === 'boolean' && b) expect(a).toBe(true);
      if (typeof b === 'number') expect(a as number).toBeGreaterThanOrEqual(b);
    }
  });
});
