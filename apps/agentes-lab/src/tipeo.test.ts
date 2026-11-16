import { describe, expect, it } from 'vitest';
import { avanceTipeo } from './tipeo';

describe('avanceTipeo', () => {
  it('avanza al menos un carácter por cuadro y nunca pasa del total', () => {
    expect(avanceTipeo(0, 5, false)).toBe(1);
    expect(avanceTipeo(4, 5, false)).toBe(5);
    expect(avanceTipeo(5, 5, false)).toBe(5);
  });
  it('acelera cuando hay mucho pendiente', () => {
    expect(avanceTipeo(0, 1000, false)).toBeGreaterThan(50);
  });
  it('con movimiento reducido muestra todo de golpe', () => {
    expect(avanceTipeo(0, 400, true)).toBe(400);
  });
  it('llega siempre al total en un número finito de cuadros', () => {
    let n = 0;
    let m = 0;
    while (m < 300 && n < 1000) {
      m = avanceTipeo(m, 300, false);
      n++;
    }
    expect(m).toBe(300);
  });
});
