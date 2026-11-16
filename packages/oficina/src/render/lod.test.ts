import { BoxGeometry, type BufferGeometry, PlaneGeometry, SphereGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { describe, expect, it } from 'vitest';
import { elegirLod, geometriaSimple, LOD_INICIAL } from './lod';

const cfg = LOD_INICIAL;

function triangulos(g: BufferGeometry): number {
  return (g.index ? g.index.count : g.attributes.position!.count) / 3;
}

describe('elegirLod', () => {
  it('pasa a 1 cuando supera distanciaSimple + histeresis', () => {
    expect(elegirLod(20.5, 0, cfg)).toBe(1);
  });

  it('vuelve a 0 cuando baja de distanciaSimple - histeresis', () => {
    expect(elegirLod(15.5, 1, cfg)).toBe(0);
  });

  it('en la zona media conserva el nivel actual (0)', () => {
    expect(elegirLod(18, 0, cfg)).toBe(0);
  });

  it('en la zona media conserva el nivel actual (1)', () => {
    expect(elegirLod(18, 1, cfg)).toBe(1);
  });

  it('exactamente en el umbral superior no cambia de 0', () => {
    expect(elegirLod(20, 0, cfg)).toBe(0);
  });

  it('exactamente en el umbral inferior no cambia de 1', () => {
    expect(elegirLod(16, 1, cfg)).toBe(1);
  });

  it('respeta una config distinta (parametrizable)', () => {
    expect(elegirLod(11, 0, { distanciaSimple: 10, histeresis: 0.5 })).toBe(1);
  });
});

describe('geometriaSimple', () => {
  it('una RoundedBoxGeometry se reduce a caja con la misma bounding box', () => {
    const g = new RoundedBoxGeometry(1, 2, 0.5, 4, 0.1);
    const s = geometriaSimple(g);
    expect(s).not.toBe(g);
    expect(triangulos(s)).toBeLessThan(triangulos(g) / 4);
    g.computeBoundingBox();
    s.computeBoundingBox();
    const a = g.boundingBox!;
    const b = s.boundingBox!;
    for (const k of ['x', 'y', 'z'] as const) {
      expect(b.min[k]).toBeCloseTo(a.min[k], 6);
      expect(b.max[k]).toBeCloseTo(a.max[k], 6);
    }
  });

  it('conserva position, normal, uv e índice', () => {
    const s = geometriaSimple(new RoundedBoxGeometry(1, 1, 1, 4, 0.1));
    expect(s.attributes.position).toBeDefined();
    expect(s.attributes.normal).toBeDefined();
    expect(s.attributes.uv).toBeDefined();
    expect(s.index).not.toBeNull();
  });

  it('un PlaneGeometry se devuelve idéntico', () => {
    const p = new PlaneGeometry(2, 2, 8, 8);
    expect(geometriaSimple(p)).toBe(p);
  });

  it('una geometría con <= 24 vértices se devuelve idéntica', () => {
    const b = new BoxGeometry(1, 1, 1);
    expect(b.attributes.position!.count).toBe(24);
    expect(geometriaSimple(b)).toBe(b);
  });

  it('la segunda llamada devuelve la misma instancia cacheada', () => {
    const g = new RoundedBoxGeometry(1, 1, 1, 4, 0.1);
    expect(geometriaSimple(g)).toBe(geometriaSimple(g));
  });

  it('una esfera se reemplaza por caja', () => {
    const e = new SphereGeometry(1, 16, 12);
    const s = geometriaSimple(e);
    expect(s).not.toBe(e);
    expect(s.attributes.position!.count).toBe(24);
  });

  it('traslada la caja al centro de la bounding box original', () => {
    const e = new SphereGeometry(1, 16, 12).translate(3, 4, 5);
    const s = geometriaSimple(e);
    s.computeBoundingBox();
    const c = s.boundingBox!.getCenter(new Vector3());
    expect(c.x).toBeCloseTo(3, 6);
    expect(c.y).toBeCloseTo(4, 6);
    expect(c.z).toBeCloseTo(5, 6);
  });
});
