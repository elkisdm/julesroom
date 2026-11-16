import { describe, expect, it } from 'vitest';
import { ACTIVOS, analizar, formatoPrecio, serieVelas } from './analisis';

describe('serie de ejemplo', () => {
  it('es determinista y coherente (máximo ≥ cuerpo ≥ mínimo)', () => {
    const a = serieVelas('btc', '1h');
    expect(serieVelas('btc', '1h')).toEqual(a);
    expect(a.length).toBeGreaterThanOrEqual(60);
    for (const v of a) {
      expect(v.max).toBeGreaterThanOrEqual(Math.max(v.apertura, v.cierre));
      expect(v.min).toBeLessThanOrEqual(Math.min(v.apertura, v.cierre));
    }
  });
  it('cada activo y temporalidad da una serie distinta', () => {
    expect(serieVelas('btc', '1h')).not.toEqual(serieVelas('btc', '4h'));
    expect(serieVelas('btc', '1h')).not.toEqual(serieVelas('eth', '1h'));
  });
});

describe('análisis de ejemplo', () => {
  it('siempre hay un soporte bajo el precio y una resistencia sobre él', () => {
    for (const { id } of ACTIVOS)
      for (const tf of ['15m', '1h', '4h'] as const) {
        const r = analizar(id, tf);
        expect(r.soportes[0]!.precio, `${id} ${tf}`).toBeLessThan(r.precio);
        expect(r.resistencias[0]!.precio, `${id} ${tf}`).toBeGreaterThan(r.precio);
        expect(r.soportes[0]!.toques).toBeGreaterThanOrEqual(1);
      }
  });
  it('las probabilidades suman 100 y los escenarios se invalidan en el nivel contrario', () => {
    const r = analizar('eth', '1h');
    const p = r.probabilidades;
    expect(p.alcista + p.lateral + p.bajista).toBe(100);
    expect(r.escenarios.alcista.invalidez).toBe(r.soportes[0]!.precio);
    expect(r.escenarios.bajista.invalidez).toBe(r.resistencias[0]!.precio);
  });
  it('formatea el precio con sus decimales', () => {
    expect(formatoPrecio(1234.5, 2)).toMatch(/1.234,50/);
  });
});
