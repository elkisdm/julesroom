import { describe, expect, it } from 'vitest';
import { crearMemoriaOclusion, ocluye } from './oclusion';

// Cámara a 8 m de altura media detrás del avatar, mirando a su cabeza (como el seguimiento).
const camara = { x: 0, y: 6, z: 7 };
const cabeza = { x: 0, y: 1.2, z: 0 };
const persona = (x: number, z: number, y = 0) => ({ x, y, z });
const tapa = (p: { x: number; y: number; z: number }) =>
  ocluye(camara, cabeza, p.x, p.y, p.z, 0.3, 1.8, 0.25);

describe('ocluye', () => {
  it('una persona sobre el segmento cámara→cabeza se marca', () => {
    // A z=0.8 el segmento va a y≈1,8: dentro de la altura de la persona.
    expect(tapa(persona(0, 0.8))).toBe(true);
  });

  it('una persona al lado, fuera del radio más el margen, no se marca', () => {
    expect(tapa(persona(1.2, 0.8))).toBe(false);
  });

  it('el margen cuenta: justo fuera del radio pero dentro del margen se marca', () => {
    expect(tapa(persona(0.5, 0.8))).toBe(true);
    expect(tapa(persona(0.62, 0.8))).toBe(false);
  });

  it('una persona detrás de la cámara o más allá del avatar no se marca', () => {
    expect(tapa(persona(0, 12))).toBe(false);
    expect(tapa(persona(0, -3))).toBe(false);
  });

  it('una persona lejos de la cámara cuyo segmento pasa por encima de su cabeza no se marca', () => {
    // A z=5 el segmento va a y≈4,7: muy por encima de 1,8 m.
    expect(tapa(persona(0, 5))).toBe(false);
  });

  it('una persona en otro piso (pies sobre la cabeza del avatar) no se marca', () => {
    expect(tapa(persona(0, 0.8, 3.6))).toBe(false);
  });

  it('una cámara casi vertical sobre el avatar no marca a quien está a su lado', () => {
    const arriba = { x: 0, y: 9, z: 0.1 };
    expect(ocluye(arriba, cabeza, 1, 0, 0, 0.3, 1.8, 0.25)).toBe(false);
  });
});

describe('memoria de oclusión', () => {
  it('mantiene oculta a una persona un rato tras dejar de tapar, para no parpadear', () => {
    const m = crearMemoriaOclusion(0.3);
    m.marcar('a', 1);
    expect(m.oculta('a', 1.1)).toBe(true);
    expect(m.oculta('a', 1.29)).toBe(true);
    expect(m.oculta('a', 1.31)).toBe(false);
    expect(m.oculta('b', 1.1)).toBe(false);
  });

  it('volver a marcar renueva el plazo', () => {
    const m = crearMemoriaOclusion(0.3);
    m.marcar('a', 1);
    m.marcar('a', 1.2);
    expect(m.oculta('a', 1.45)).toBe(true);
  });

  it('olvidar quita a quienes ya no están', () => {
    const m = crearMemoriaOclusion(0.3);
    m.marcar('a', 1);
    m.marcar('b', 1);
    m.olvidar(new Set(['b']));
    expect(m.oculta('a', 1.1)).toBe(false);
    expect(m.oculta('b', 1.1)).toBe(true);
  });
});
