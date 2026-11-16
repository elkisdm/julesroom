import { describe, expect, it } from 'vitest';
import { PARAMETROS_VOZ, distancia3, ganancia, planVoz } from './voz';

const yo = { x: 0, y: 0, z: 0 };
const en = (id: string, d: number, sala?: string | null) => ({ id, x: d, y: 0, z: 0, sala });

describe('voz', () => {
  it('valores iniciales', () => {
    expect(PARAMETROS_VOZ).toEqual({ radio: 4.5, factorSalida: 1.25, distanciaPlena: 1 });
  });

  it('distancia3 cuenta y', () => {
    expect(distancia3({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5);
    expect(distancia3({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toBe(0);
  });

  it('ganancia: 1 hasta la distancia plena, cae a 0 en radio*factor, clamp', () => {
    expect(ganancia(0, PARAMETROS_VOZ)).toBe(1);
    expect(ganancia(1, PARAMETROS_VOZ)).toBe(1);
    const salida = 4.5 * 1.25;
    expect(ganancia(salida, PARAMETROS_VOZ)).toBe(0);
    expect(ganancia(100, PARAMETROS_VOZ)).toBe(0);
    const medio = ganancia((1 + salida) / 2, PARAMETROS_VOZ);
    expect(medio).toBeCloseTo(0.25);
    expect(ganancia(2, PARAMETROS_VOZ)).toBeGreaterThan(ganancia(3, PARAMETROS_VOZ));
  });

  it('entra a ≤ radio y no antes', () => {
    expect(planVoz(yo, [en('a', 4.5)], new Set()).suscritos.has('a')).toBe(true);
    expect(planVoz(yo, [en('a', 4.6)], new Set()).suscritos.has('a')).toBe(false);
  });

  it('histéresis: oscilar 4.4↔4.6 no entra y sale cada cuadro', () => {
    let previo = new Set<string>();
    const estados: boolean[] = [];
    for (const d of [4.6, 4.4, 4.6, 4.4, 4.6]) {
      previo = planVoz(yo, [en('a', d)], previo).suscritos;
      estados.push(previo.has('a'));
    }
    expect(estados).toEqual([false, true, true, true, true]);
  });

  it('entra a 4.5, sigue a 5.5, sale a 5.7', () => {
    let previo = planVoz(yo, [en('a', 4.5)], new Set()).suscritos;
    expect(previo.has('a')).toBe(true);
    previo = planVoz(yo, [en('a', 5.5)], previo).suscritos;
    expect(previo.has('a')).toBe(true);
    previo = planVoz(yo, [en('a', 5.7)], previo).suscritos;
    expect(previo.has('a')).toBe(false);
  });

  it('entrega volumen por persona suscrita', () => {
    const plan = planVoz(yo, [en('a', 0.5), en('b', 3)], new Set());
    expect(plan.volumen.get('a')).toBe(1);
    expect(plan.volumen.get('b')).toBeGreaterThan(0);
    expect(plan.volumen.get('b')).toBeLessThan(1);
  });

  it('misma sala cuenta siempre, con volumen mínimo 0.35', () => {
    const plan = planVoz(
      { ...yo, sala: 'r1' },
      [en('a', 50, 'r1'), en('b', 50, 'r2'), en('c', 50, null)],
      new Set(),
    );
    expect(plan.suscritos.has('a')).toBe(true);
    expect(plan.volumen.get('a')).toBe(0.35);
    expect(plan.suscritos.has('b')).toBe(false);
    expect(plan.suscritos.has('c')).toBe(false);
  });

  it('sala nula en ambos no cuenta como misma sala', () => {
    const plan = planVoz({ ...yo, sala: null }, [en('a', 50, null)], new Set());
    expect(plan.suscritos.size).toBe(0);
  });

  it('en la misma sala y cerca usa la curva si supera 0.35', () => {
    const plan = planVoz({ ...yo, sala: 'r1' }, [en('a', 0.5, 'r1')], new Set());
    expect(plan.volumen.get('a')).toBe(1);
  });
});
