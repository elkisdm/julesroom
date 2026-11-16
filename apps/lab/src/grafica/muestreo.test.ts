import { describe, expect, it } from 'vitest';
import { percentil, resumir, simuladasPara } from './muestreo';

describe('muestreo', () => {
  it('percentil de una lista vacía es 0', () => {
    expect(percentil([], 95)).toBe(0);
  });
  it('resume p50/p95/p99 y fps de 100 cuadros', () => {
    const cuadros = Array.from({ length: 100 }, (_, i) => i + 1);
    const r = resumir(cuadros);
    expect(r.p50).toBe(50);
    expect(r.p95).toBe(95);
    expect(r.p99).toBe(99);
    expect(r.max).toBe(100);
    expect(r.fps).toBeCloseTo(100000 / 5050, 5);
  });
  it('un solo cuadro lento se ve en p99 y max pero no en p50', () => {
    const r = resumir([...Array(99).fill(8), 60]);
    expect(r.p50).toBe(8);
    expect(r.max).toBe(60);
  });
  it('perdidos: cuadros a 60 Hz con un 10 % que tarda el doble', () => {
    const cuadros = [...Array(90).fill(16.7), ...Array(10).fill(34)];
    expect(resumir(cuadros).perdidos).toBeCloseTo(0.1, 5);
  });
  it('perdidos es 0 si todos los cuadros son parejos', () => {
    expect(resumir(Array(50).fill(16.7)).perdidos).toBe(0);
  });
  it('simuladasPara no baja de cero', () => {
    expect(simuladasPara(100, 9)).toBe(91);
    expect(simuladasPara(5, 9)).toBe(0);
  });
});
