import { describe, expect, it } from 'vitest';
import { plano } from '../../../mansion/plano';
import { BAJA_SENTADO } from '../../animador';
import { ALTURA_ASIENTO, ASIENTOS, BAJO_MUSLO, esSentable } from './asientos';

/** Tipos de mueble en los que el plano sienta a alguien. */
const tiposConPersona = [
  ...new Set(
    plano.lugares
      .filter((l) => l.silla !== null)
      .map((l) => plano.muebles.find((m) => m.id === l.silla)?.tipo ?? '¿sin mueble?'),
  ),
];

describe('asientos', () => {
  it('la altura de asiento sale del cuerpo: pelvis de pie (0,62) menos lo que baja al sentarse', () => {
    expect(ALTURA_ASIENTO).toBeCloseTo(0.62 - BAJA_SENTADO, 9);
    expect(ALTURA_ASIENTO).toBeCloseTo(0.45, 2);
  });

  it('todo mueble donde el plano sienta a alguien tiene su asiento medido', () => {
    expect(tiposConPersona.length).toBeGreaterThan(0);
    for (const tipo of tiposConPersona) expect(esSentable(tipo), tipo).toBe(true);
  });

  it.each(Object.entries(ASIENTOS))('%s: la cara del asiento queda a 0,45 ± 0,02', (_, a) => {
    expect(Math.abs(a.arriba - 0.45)).toBeLessThanOrEqual(0.02);
  });

  it.each(Object.entries(ASIENTOS))(
    '%s: el cuerpo del asiento baja hasta el muslo (no asoma por debajo)',
    (_, a) => {
      expect(a.abajo).toBeLessThanOrEqual(BAJO_MUSLO + 1e-9);
      expect(a.abajo).toBeGreaterThan(0);
    },
  );

  it('un tipo cualquiera no es sentable', () => {
    expect(esSentable('librero')).toBe(false);
  });
});
