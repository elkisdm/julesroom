import { describe, expect, it } from 'vitest';
import { paletaLuz } from './luz';
import {
  CIELO_FONDO,
  GLSL_OCLUSION,
  luzCielo,
  luzDirecta,
  PASO_VIDRIO,
  VOLUMENES,
} from './oclusion';

const sol = (h: number) => paletaLuz(h).sol.direccion;

describe('luzDirecta (sol que entra solo por las aberturas)', () => {
  it('a mediodía el centro de un piso queda en sombra: la losa de arriba tapa el sol', () => {
    expect(luzDirecta({ x: -10, y: 3.9, z: 0 }, sol(13.3))).toBe(0);
    expect(luzDirecta({ x: 10, y: 0, z: 1 }, sol(13.3))).toBe(0);
  });

  it('a mediodía entra una franja de sol por el muro cortina del fondo (norte)', () => {
    const junto = luzDirecta({ x: 10, y: 0, z: -3.9 }, sol(13.3));
    expect(junto).toBeGreaterThan(0.5);
    expect(junto).toBeLessThanOrEqual(PASO_VIDRIO);
  });

  it('afuera, sobre el techo y en la terraza, el sol llega entero', () => {
    expect(luzDirecta({ x: 10, y: 11.7, z: 0 }, sol(13.3))).toBe(1);
    expect(luzDirecta({ x: 0, y: 0, z: 7 }, sol(13.3))).toBe(1);
    expect(luzDirecta({ x: 20, y: 0, z: 0 }, sol(13.3))).toBe(1);
  });

  it('el sol rasante de la mañana entra por el corte del frente; el de mediodía no', () => {
    const p = { x: -6, y: 3.9, z: 1 };
    expect(luzDirecta(p, sol(7.5))).toBeGreaterThan(0.9);
    expect(luzDirecta(p, sol(13.3))).toBe(0);
  });

  it('un muro de costado tapa el sol que viene de su lado', () => {
    // Al atardecer el sol viene del oeste (-x) y algo del frente: cerca del corte entraría,
    // pero junto al muro oeste, por dentro, el muro lo tapa.
    expect(luzDirecta({ x: -8, y: 0, z: 3 }, sol(19))).toBeGreaterThan(0.9);
    expect(luzDirecta({ x: -15.8, y: 0, z: 3 }, sol(19))).toBe(0);
  });

  it('con el astro bajo el horizonte no entra nada', () => {
    expect(luzDirecta({ x: 0, y: 0, z: 3.9 }, { x: 0, y: -0.2, z: 0.98 })).toBe(0);
    expect(luzDirecta({ x: 0, y: 0, z: 3.9 }, { x: 0, y: 0, z: 1 })).toBe(0);
  });

  it('el atrio es de doble altura: su techo es la losa del tercer piso', () => {
    // Un rayo empinado desde el frente: en el atrio pasa; bajo la losa del segundo piso, no.
    const a = { x: 0, y: 0.5, z: 0.7071 };
    const n = Math.hypot(a.x, a.y, a.z);
    const astro = { x: a.x / n, y: a.y / n, z: a.z / n };
    expect(luzDirecta({ x: 0, y: 0, z: -2 }, astro)).toBeGreaterThan(0.9);
    expect(luzDirecta({ x: 10, y: 0, z: -3 }, astro)).toBe(0);
  });
});

describe('luzCielo (la luz del cielo baja hacia el fondo de cada piso)', () => {
  it('afuera es 1 y en lo hondo de un piso baja a CIELO_FONDO', () => {
    expect(luzCielo({ x: 0, y: 0, z: 8 })).toBe(1);
    expect(luzCielo({ x: 10, y: 3.9, z: -1 })).toBeCloseTo(CIELO_FONDO, 2);
  });

  it('junto al corte del frente casi no baja', () => {
    expect(luzCielo({ x: 10, y: 3.9, z: 3.95 })).toBeGreaterThan(0.95);
  });
});

describe('GLSL_OCLUSION', () => {
  it('lleva los mismos volúmenes que la versión en TypeScript', () => {
    for (const v of VOLUMENES) expect(GLSL_OCLUSION).toContain(v.y1.toFixed(4));
    expect(GLSL_OCLUSION.match(/return true/g)).toHaveLength(VOLUMENES.length);
  });
});
