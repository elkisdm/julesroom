import { describe, expect, it } from 'vitest';
import { PARAMETROS_INTERES, planEnvioInteres } from './interes';

const yo = { x: 0, z: 0 };
const gente = (n: number, d: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, x: d, z: 0 }));

describe('interés', () => {
  it('valores iniciales: apagada', () => {
    expect(PARAMETROS_INTERES).toEqual({
      habilitada: false,
      umbral: 50,
      radioCerca: 12,
      hzCerca: 10,
      hzLejos: 2,
    });
  });

  it('apagada → a todos y no toca ultimoEnvio', () => {
    const ultimo = new Map<string, number>();
    const r = planEnvioInteres(yo, gente(100, 5), 0, ultimo);
    expect(r).toEqual({ aTodos: true, identidades: [] });
    expect(ultimo.size).toBe(0);
  });

  it('habilitada con menos personas que el umbral → a todos', () => {
    const r = planEnvioInteres(yo, gente(10, 5), 0, new Map(), {
      ...PARAMETROS_INTERES,
      habilitada: true,
    });
    expect(r.aTodos).toBe(true);
  });

  it('habilitada sobre el umbral: cerca a hzCerca, lejos a hzLejos', () => {
    const parametros = { ...PARAMETROS_INTERES, habilitada: true, umbral: 2 };
    const otros = [
      { id: 'cerca', x: 5, z: 0 },
      { id: 'lejos', x: 30, z: 0 },
      { id: 'lejos2', x: 0, z: 40 },
    ];
    const ultimo = new Map<string, number>();

    const r0 = planEnvioInteres(yo, otros, 0, ultimo, parametros);
    expect(r0.aTodos).toBe(false);
    expect(r0.identidades.sort()).toEqual(['cerca', 'lejos', 'lejos2']);
    expect(ultimo.get('cerca')).toBe(0);

    expect(planEnvioInteres(yo, otros, 100, ultimo, parametros).identidades).toEqual(['cerca']);
    expect(planEnvioInteres(yo, otros, 200, ultimo, parametros).identidades).toEqual(['cerca']);
    expect(planEnvioInteres(yo, otros, 500, ultimo, parametros).identidades.sort()).toEqual([
      'cerca',
      'lejos',
      'lejos2',
    ]);
  });

  it('entre cuadros no envía a quien aún no toca', () => {
    const parametros = { ...PARAMETROS_INTERES, habilitada: true, umbral: 1 };
    const ultimo = new Map<string, number>();
    planEnvioInteres(yo, gente(2, 5), 0, ultimo, parametros);
    expect(planEnvioInteres(yo, gente(2, 5), 50, ultimo, parametros).identidades).toEqual([]);
  });
});
