import { describe, expect, it } from 'vitest';
import { crearMapaColisionDe, puntoLibre } from '../animacion/colision';
import type { Azar } from '../azar';
import { escenarioMansion } from './mansion';
import { puntoDeReunion, reunionDe } from './reuniones';
import { escenarioOficina } from './oficina';
import { escenarioTrading } from './trading';

function mulberry32(semilla: number): Azar {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe.each([escenarioTrading, escenarioOficina, escenarioMansion])('reuniones de $id', (e) => {
  const cupoTotal = e.reuniones.reduce((s, r) => s + r.cupo, 0);

  it('hay reuniones con radio y cupo positivos', () => {
    expect(e.reuniones.length).toBeGreaterThan(0);
    for (const r of e.reuniones) {
      expect(r.radio).toBeGreaterThan(0);
      expect(r.cupo).toBeGreaterThan(0);
    }
  });

  it('respeta los cupos: nadie pasa del cupo de su reunión y el resto no tiene reunión', () => {
    const cuenta = new Map<unknown, number>();
    for (let i = 0; i < cupoTotal + 30; i++) {
      const r = reunionDe(e.reuniones, i);
      if (i >= cupoTotal) expect(r).toBeNull();
      else {
        expect(r).not.toBeNull();
        cuenta.set(r!.reunion, (cuenta.get(r!.reunion) ?? 0) + 1);
      }
    }
    for (const r of e.reuniones) expect(cuenta.get(r)).toBe(r.cupo);
  });

  it('cada persona cae dentro del círculo de su reunión y mira a su centro', () => {
    const azar = mulberry32(7);
    for (let i = 0; i < cupoTotal; i++) {
      const { reunion } = reunionDe(e.reuniones, i)!;
      const p = puntoDeReunion(e, i, azar);
      if (p.mirar) {
        expect(Math.hypot(p.x - reunion.x, p.z - reunion.z)).toBeLessThanOrEqual(
          reunion.radio + 1e-6,
        );
        expect(p.mirar).toEqual({ x: reunion.x, z: reunion.z });
      } else {
        // Sin lugar libre en su círculo se junta al paseo.
        expect(p.x).toBeGreaterThanOrEqual(e.paseo.x0);
        expect(p.x).toBeLessThanOrEqual(e.paseo.x1);
      }
    }
  });

  it('nunca cae en una celda bloqueada, con cualquier azar y también pasado el cupo', () => {
    const mapa = crearMapaColisionDe(e, e.entradas[0]?.y ?? 0);
    for (const semilla of [1, 2, 3, 4, 5]) {
      const azar = mulberry32(semilla);
      for (let i = 0; i < cupoTotal + 20; i++) {
        const p = puntoDeReunion(e, i, azar);
        expect(puntoLibre(mapa, p.x, p.z, 0.25), `${e.id} #${i} (${p.x}, ${p.z})`).toBe(true);
      }
    }
  });

  it('quien queda fuera de los cupos pasea por el paseo, sin reunión', () => {
    const p = puntoDeReunion(e, cupoTotal + 5, mulberry32(9));
    expect(p.mirar).toBeUndefined();
    expect(p.x).toBeGreaterThanOrEqual(e.paseo.x0);
    expect(p.x).toBeLessThanOrEqual(e.paseo.x1);
    expect(p.z).toBeGreaterThanOrEqual(e.paseo.z0);
    expect(p.z).toBeLessThanOrEqual(e.paseo.z1);
  });
});
