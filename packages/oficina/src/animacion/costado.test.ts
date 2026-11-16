import { describe, expect, it } from 'vitest';
import { cajaDe, plano } from '../mansion/plano';
import { costadoLibre, debePararse, giroHacia, UMBRAL_GIRO_SENTADO } from './costado';

const sentados = plano.lugares.filter((l) => l.asiento && l.silla);

describe('umbral de giro sentado', () => {
  it('hasta 45° se queda sentado y pasado eso se para', () => {
    expect(debePararse(UMBRAL_GIRO_SENTADO - 0.01)).toBe(false);
    expect(debePararse(UMBRAL_GIRO_SENTADO + 0.01)).toBe(true);
  });

  it('mide el giro hacia la cámara respecto de la silla (y envuelve ±π)', () => {
    const l = sentados[0];
    if (!l) throw new Error('sin lugares sentados');
    // Un punto delante de la silla no pide giro; uno detrás pide casi media vuelta.
    const delante = giroHacia(l, l.x + Math.sin(l.yaw) * 5, l.z + Math.cos(l.yaw) * 5);
    const detras = giroHacia(l, l.x - Math.sin(l.yaw) * 5, l.z - Math.cos(l.yaw) * 5);
    expect(delante).toBeCloseTo(0);
    expect(detras).toBeCloseTo(Math.PI);
  });
});

describe('costadoLibre', () => {
  it('hay un punto de pie libre para (casi) todos los lugares sentados', () => {
    const salida = { x: 0, z: 0 };
    const sin = sentados.filter((l) => !costadoLibre(l, l.x, l.z + 20, salida));
    expect(sin.map((l) => l.id)).toEqual([]);
  });

  it('el punto no cae sobre ningún mueble ni sobre la silla, y queda junto al asiento', () => {
    const salida = { x: 0, z: 0 };
    for (const l of sentados) {
      expect(costadoLibre(l, l.x - 10, l.z - 10, salida)).toBe(true);
      expect(Math.hypot(salida.x - l.x, salida.z - l.z)).toBeLessThan(1.51);
      for (const m of plano.muebles.filter((m) => m.ambiente === l.ambiente)) {
        const c = cajaDe(m);
        const dentro = salida.x > c.x0 && salida.x < c.x1 && salida.z > c.z0 && salida.z < c.z1;
        expect(dentro, `${l.id} cae sobre ${m.id}`).toBe(false);
      }
    }
  });

  it('prefiere el lado de la cámara', () => {
    const l = sentados[0];
    if (!l) throw new Error('sin lugares sentados');
    const a = { x: 0, z: 0 };
    const b = { x: 0, z: 0 };
    costadoLibre(l, l.x + 30, l.z, a);
    costadoLibre(l, l.x - 30, l.z, b);
    expect(a.x).toBeGreaterThanOrEqual(b.x);
  });
});
