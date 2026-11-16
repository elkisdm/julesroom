import { describe, expect, it } from 'vitest';
import { azarSecuencia } from '../test-utils';
import { caraPorEstado, estaParpadeando, planParpadeo } from './expresion';

describe('caraPorEstado', () => {
  it('trabajando -> concentrado y esperando_decision -> sonrisa', () => {
    expect(caraPorEstado('trabajando', azarSecuencia(0.5))).toBe('concentrado');
    expect(caraPorEstado('esperando_decision', azarSecuencia(0.5))).toBe('sonrisa');
  });

  it('libre -> una variante neutra elegida por azar', () => {
    const vistas = new Set([0, 0.4, 0.99].map((r) => caraPorEstado('libre', azarSecuencia(r))));
    expect(vistas.size).toBe(3);
    for (const cara of vistas) expect(['feliz', 'guino', 'serio']).toContain(cara);
  });
});

describe('planParpadeo', () => {
  it('la espera cae entre 2 y 6 s', () => {
    expect(planParpadeo(azarSecuencia(0, 0.99)).espera).toBeCloseTo(2, 6);
    expect(planParpadeo(azarSecuencia(0.9999, 0.99)).espera).toBeLessThanOrEqual(6);
  });

  it('parpadeo simple: un cierre de 0.13 s', () => {
    const plan = planParpadeo(azarSecuencia(0.5, 0.99));
    expect(plan.cierres).toEqual([{ desde: 0, duracion: 0.13 }]);
  });

  it('parpadeo doble ocasional: dos cierres separados', () => {
    const plan = planParpadeo(azarSecuencia(0.5, 0.01));
    expect(plan.cierres).toHaveLength(2);
    expect(plan.cierres[1]?.desde).toBeGreaterThan(plan.cierres[0]?.desde ?? 0);
  });

  it('estaParpadeando refleja los cierres tras la espera', () => {
    const plan = planParpadeo(azarSecuencia(0, 0.01)); // espera 2, doble
    expect(estaParpadeando(plan, 1)).toBe(false);
    expect(estaParpadeando(plan, 2.05)).toBe(true);
    expect(estaParpadeando(plan, 2.2)).toBe(false);
    expect(estaParpadeando(plan, 2.3)).toBe(true);
    expect(estaParpadeando(plan, 3)).toBe(false);
  });
});
