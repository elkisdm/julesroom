import { describe, expect, it } from 'vitest';
import { horaChile, horaDeLuz, luzDelDia } from './hora';

describe('horaChile', () => {
  it('usa America/Santiago en verano (UTC-3), no UTC', () => {
    // 02:30 UTC del 1 nov 2026 = 23:30 del 31 oct en Santiago
    expect(horaChile(new Date('2026-11-01T02:30:00Z'))).toBeCloseTo(23.5, 6);
  });

  it('usa America/Santiago en invierno (UTC-4)', () => {
    expect(horaChile(new Date('2026-07-01T03:30:00Z'))).toBeCloseTo(23.5, 6);
  });

  it('incluye minutos y segundos como fracción de hora', () => {
    expect(horaChile(new Date('2026-07-01T17:00:36Z'))).toBeCloseTo(13 + 36 / 3600, 6);
  });

  it('medianoche es 0, nunca 24', () => {
    expect(horaChile(new Date('2026-07-01T04:00:00Z'))).toBe(0);
  });
});

describe('luzDelDia', () => {
  it('23:30 es noche y 13:00 es día', () => {
    expect(luzDelDia(23.5).fase).toBe('noche');
    expect(luzDelDia(13).fase).toBe('dia');
    expect(luzDelDia(13).factor).toBe(1);
    expect(luzDelDia(23.5).factor).toBe(0);
  });

  it('distingue alba y ocaso', () => {
    expect(luzDelDia(7).fase).toBe('alba');
    expect(luzDelDia(19).fase).toBe('ocaso');
  });

  it('las lámparas dominan de noche y el sol de día', () => {
    const noche = luzDelDia(2);
    const dia = luzDelDia(12);
    expect(noche.intensidadSol).toBe(0);
    expect(dia.intensidadSol).toBeGreaterThan(noche.intensidadSol);
    expect(noche.intensidadLamparas).toBeGreaterThan(dia.intensidadLamparas);
  });

  it('es continua: sin saltos al barrer las 24 h, incluida la medianoche', () => {
    const paso = 0.001;
    let anterior = luzDelDia(0);
    for (let h = paso; h <= 24 + 1e-9; h += paso) {
      const actual = luzDelDia(h);
      expect(Math.abs(actual.factor - anterior.factor)).toBeLessThan(0.002);
      expect(Math.abs(actual.intensidadSol - anterior.intensidadSol)).toBeLessThan(0.002);
      expect(Math.abs(actual.intensidadLamparas - anterior.intensidadLamparas)).toBeLessThan(0.002);
      anterior = actual;
    }
    expect(luzDelDia(24).factor).toBeCloseTo(luzDelDia(0).factor, 9);
  });

  it('factor siempre en [0, 1] y acepta horas fuera de rango', () => {
    for (let h = -30; h <= 60; h += 0.37) {
      const { factor } = luzDelDia(h);
      expect(factor).toBeGreaterThanOrEqual(0);
      expect(factor).toBeLessThanOrEqual(1);
    }
    expect(luzDelDia(-1).fase).toBe(luzDelDia(23).fase);
  });
});

describe('horaDeLuz', () => {
  const reloj = new Date('2026-07-01T17:00:00Z'); // 13:00 en Santiago
  it('la fecha que llega manda sobre la del escenario', () => {
    expect(horaDeLuz(new Date('2026-07-01T03:30:00Z'), 21, reloj)).toBeCloseTo(23.5, 6);
  });
  it('sin fecha usa la hora fija del escenario', () => {
    expect(horaDeLuz(undefined, 21, reloj)).toBe(21);
    expect(horaDeLuz(undefined, 0, reloj)).toBe(0);
  });
  it('sin fecha ni hora fija sigue el reloj', () => {
    expect(horaDeLuz(undefined, null, reloj)).toBeCloseTo(13, 6);
  });
});
