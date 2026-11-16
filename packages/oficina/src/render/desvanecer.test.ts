import { describe, expect, it } from 'vitest';
import {
  escribirDesvanecidas,
  limpiarDesvanecidas,
  MAX_DESVANECIDAS,
  parchearDesvanecido,
  uniformesDesvanecido,
} from './desvanecer';
import type { Caja3 } from './visual';

const caja = (i: number): Caja3 => ({ x0: i, x1: i + 1, y0: 0, y1: 3, z0: -i, z1: -i + 1 });
const sombreador = () => ({
  uniforms: {} as Record<string, unknown>,
  vertexShader: 'void main() {\n#include <project_vertex>\n}',
  fragmentShader: 'void main() {\n#include <clipping_planes_fragment>\n}',
});

describe('desvanecimiento de obstáculos', () => {
  it('solo escribe las cajas que no están opacas, las más invisibles primero y hasta el tope', () => {
    const cajas = Array.from({ length: 12 }, (_, i) => caja(i));
    const opacidad = cajas.map((_, i) => (i === 3 ? 1 : 0.9 - i * 0.05));
    escribirDesvanecidas(cajas, opacidad);
    expect(uniformesDesvanecido.uDesvN.value).toBe(MAX_DESVANECIDAS);
    const ops = uniformesDesvanecido.uDesvOp.value.slice(0, MAX_DESVANECIDAS);
    expect([...ops].sort((a, b) => a - b)).toEqual(ops);
    expect(ops[0]).toBeCloseTo(0.9 - 11 * 0.05, 6);
    limpiarDesvanecidas();
    expect(uniformesDesvanecido.uDesvN.value).toBe(0);
  });

  it('publica también la caja del asistente cuando está a medio desvanecer', () => {
    const jules = caja(20);
    escribirDesvanecidas([caja(0)], [1], jules, 0.3);
    expect(uniformesDesvanecido.uDesvN.value).toBe(1);
    expect(uniformesDesvanecido.uDesvOp.value[0]).toBeCloseTo(0.3, 6);
    expect(uniformesDesvanecido.uDesvCaja.value[0]!.x).toBeLessThan(jules.x0);
    escribirDesvanecidas([caja(0), caja(1)], [0.6, 1], jules, 0.2);
    expect(uniformesDesvanecido.uDesvN.value).toBe(2);
    expect([...uniformesDesvanecido.uDesvOp.value.slice(0, 2)]).toEqual([0.2, 0.6]);
    escribirDesvanecidas([caja(0)], [1], jules, 1);
    expect(uniformesDesvanecido.uDesvN.value).toBe(0);
    escribirDesvanecidas([caja(0)], [1], null, 0);
    expect(uniformesDesvanecido.uDesvN.value).toBe(0);
  });

  it('con todo opaco no escribe nada', () => {
    escribirDesvanecidas([caja(0)], [1]);
    expect(uniformesDesvanecido.uDesvN.value).toBe(0);
  });

  it('parchea una vez los sombreadores estándar y deja intactos los ajenos', () => {
    const s = sombreador();
    parchearDesvanecido(s as never);
    expect(s.fragmentShader).toContain('uDesvOp');
    expect(s.vertexShader).toContain('vDesvPos');
    expect(s.uniforms.uDesvN).toBe(uniformesDesvanecido.uDesvN);
    const copia = JSON.stringify(s);
    parchearDesvanecido(s as never);
    expect(JSON.stringify(s)).toBe(copia);
    const ajeno = {
      uniforms: {},
      vertexShader: 'void main() { gl_Position = vec4(0.); }',
      fragmentShader: 'void main() {}',
    };
    parchearDesvanecido(ajeno as never);
    expect(ajeno.fragmentShader).toBe('void main() {}');
  });
});
