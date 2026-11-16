import { describe, expect, it } from 'vitest';
import {
  ACTIVOS,
  activo,
  formatoPct,
  formatoPrecio,
  generarVelas,
  niveles,
  serie,
  variacion,
} from './mercado';

describe('mercado de ejemplo', () => {
  it('trae activos genéricos (cripto, forex, oro) sin datos de cliente', () => {
    expect(ACTIVOS.map((a) => a.simbolo)).toEqual(['BTC/USDT', 'ETH/USDT', 'EUR/USD', 'XAU/USD']);
    expect(activo('eur').decimales).toBe(4);
    expect(() => activo('zzz' as never)).toThrow(/zzz/);
  });

  it('las velas son deterministas por semilla y coherentes (mín ≤ cuerpo ≤ máx)', () => {
    const a = generarVelas({ semilla: 7, cantidad: 40, precioInicial: 100, volatilidad: 0.01 });
    const b = generarVelas({ semilla: 7, cantidad: 40, precioInicial: 100, volatilidad: 0.01 });
    const c = generarVelas({ semilla: 8, cantidad: 40, precioInicial: 100, volatilidad: 0.01 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(40);
    for (const v of a) {
      expect(v.min).toBeLessThanOrEqual(Math.min(v.apertura, v.cierre));
      expect(v.max).toBeGreaterThanOrEqual(Math.max(v.apertura, v.cierre));
      expect(v.min).toBeGreaterThan(0);
    }
  });

  it('cada activo tiene su serie cerca de su precio base y una variación finita', () => {
    for (const a of ACTIVOS) {
      const s = serie(a.id);
      const ultimo = s.at(-1)!.cierre;
      expect(Math.abs(ultimo / a.precioBase - 1)).toBeLessThan(0.2);
      expect(Number.isFinite(variacion(a.id))).toBe(true);
    }
  });

  it('el soporte queda bajo el último precio y la resistencia sobre él', () => {
    const s = serie('btc');
    const n = niveles(s);
    const ultimo = s.at(-1)!.cierre;
    expect(n.soporte).toBeLessThan(n.resistencia);
    expect(n.soporte).toBeLessThanOrEqual(ultimo);
    expect(n.resistencia).toBeGreaterThanOrEqual(ultimo);
  });

  it('formatea precios con punto de miles y coma decimal, y porcentajes con signo', () => {
    expect(formatoPrecio(64210.5, 0)).toBe('64.211');
    expect(formatoPrecio(1.08537, 4)).toBe('1,0854');
    expect(formatoPrecio(-2350.4, 2)).toBe('−2.350,40');
    expect(formatoPct(1.236)).toBe('+1,24 %');
    expect(formatoPct(-0.8)).toBe('−0,80 %');
    expect(formatoPct(0)).toBe('0,00 %');
  });
});
