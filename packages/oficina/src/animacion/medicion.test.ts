import { describe, expect, it } from 'vitest';
import { crearMedidor, estadisticas, registrar } from './medicion';
import type { EstadisticasMedidor } from './medicion';

function vacia(): EstadisticasMedidor {
  return { media: -1, p50: -1, p95: -1, max: -1, n: -1 };
}

describe('medidor circular', () => {
  it('sin datos devuelve ceros', () => {
    const s = vacia();
    estadisticas(crearMedidor(), s);
    expect(s).toEqual({ media: 0, p50: 0, p95: 0, max: 0, n: 0 });
  });

  it('calcula media, percentiles y máximo', () => {
    const m = crearMedidor();
    for (let i = 1; i <= 100; i++) registrar(m, i);
    const s = vacia();
    estadisticas(m, s);
    expect(s.n).toBe(100);
    expect(s.media).toBeCloseTo(50.5, 9);
    expect(s.p50).toBeCloseTo(50.5, 9);
    expect(s.p95).toBeGreaterThan(94);
    expect(s.p95).toBeLessThanOrEqual(96);
    expect(s.max).toBe(100);
  });

  it('al llenarse descarta lo más viejo', () => {
    const m = crearMedidor(4);
    for (const v of [100, 1, 2, 3, 4]) registrar(m, v);
    const s = vacia();
    estadisticas(m, s);
    expect(s.n).toBe(4);
    expect(s.max).toBe(4);
    expect(s.media).toBe(2.5);
  });

  it('ignora valores no finitos', () => {
    const m = crearMedidor(4);
    registrar(m, Number.NaN);
    registrar(m, 2);
    const s = vacia();
    estadisticas(m, s);
    expect(s.n).toBe(1);
    expect(s.media).toBe(2);
  });
});
