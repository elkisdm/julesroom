import { describe, expect, it } from 'vitest';
import { DIENTES, SALA, SOL_FRANJAS, VENTANA_Y } from '../../../escenarios/oficina/plano';
import { CAJA_FRANJAS, poligonosDeSol, proyectar, uvFranja } from './franjas';

const sol = SOL_FRANJAS;

describe('proyección del sol al piso', () => {
  it('un punto del piso queda donde está', () => {
    expect(proyectar({ x: 2, y: 0, z: -3 }, sol)).toEqual({ x: 2, z: -3 });
  });

  it('un punto alto cae lejos del sol (al oeste y hacia la cámara si el sol está al noreste)', () => {
    const p = proyectar({ x: 0, y: 5, z: 0 }, sol);
    expect(p.x).toBeCloseTo((-5 * sol.x) / sol.y, 9);
    expect(p.z).toBeCloseTo((-5 * sol.z) / sol.y, 9);
    expect(p.x).toBeLessThan(0);
    expect(p.z).toBeGreaterThan(0);
  });
});

describe('polígonos de las franjas', () => {
  const polis = poligonosDeSol(sol);

  it('hay luz por las vidrieras del diente de sierra, cada una en su banda de z', () => {
    for (const z of DIENTES) {
      const z0 = proyectar({ x: 0, y: SALA.alto, z }, sol).z;
      const z1 = proyectar({ x: 0, y: SALA.cumbrera, z }, sol).z;
      const banda = polis.filter((p) =>
        p.every((q) => q.z >= Math.min(z0, z1) - 1e-6 && q.z <= Math.max(z0, z1) + 1e-6),
      );
      expect(banda.length, `diente ${z}`).toBeGreaterThan(4);
    }
  });

  it('los parteluces cortan las bandas: los paños no se tocan', () => {
    const z = DIENTES[1];
    const z0 = proyectar({ x: 0, y: SALA.alto, z }, sol).z;
    const banda = polis
      .filter((p) => Math.abs(p[0]!.z - z0) < 1e-6)
      .map((p) => Math.min(...p.map((q) => q.x)))
      .sort((a, b) => a - b);
    for (let i = 0; i + 1 < banda.length; i++) expect(banda[i + 1]! - banda[i]!).toBeGreaterThan(1);
  });

  it('la ventana del muro este proyecta paños dentro de la nave, al oeste del muro', () => {
    const lejos = proyectar({ x: SALA.x1, y: VENTANA_Y.y1, z: 0 }, sol).x;
    const cerca = proyectar({ x: SALA.x1, y: VENTANA_Y.y0, z: 0 }, sol).x;
    const deEste = polis.filter((p) =>
      p.every((q) => Math.abs(q.x - lejos) < 1e-6 || Math.abs(q.x - cerca) < 1e-6),
    );
    expect(deEste.length).toBeGreaterThan(4);
    expect(lejos).toBeGreaterThan(SALA.x0);
    expect(cerca).toBeLessThan(SALA.x1);
  });

  it('cada polígono tiene 4 vértices', () => {
    for (const p of polis) expect(p).toHaveLength(4);
  });
});

describe('uv de una superficie a cierta altura', () => {
  it('en el piso, la uv es la posición en la caja de franjas', () => {
    expect(uvFranja(CAJA_FRANJAS.x0, CAJA_FRANJAS.z1, 0, sol)).toEqual([0, 0]);
    const [u, v] = uvFranja(CAJA_FRANJAS.x1, CAJA_FRANJAS.z0, 0, sol);
    expect(u).toBeCloseTo(1, 9);
    expect(v).toBeCloseTo(1, 9);
  });

  it('a la altura de una mesa lee el piso donde cae el rayo que pasa por ella', () => {
    const h = 0.75;
    const piso = proyectar({ x: 1, y: h, z: -2 }, sol);
    expect(uvFranja(1, -2, h, sol)).toEqual(uvFranja(piso.x, piso.z, 0, sol));
  });
});
