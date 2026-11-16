import { describe, expect, it } from 'vitest';
import { crearHistoria, deshacer, hacer, puedeDeshacer, puedeRehacer, rehacer } from './historia';

describe('historia', () => {
  it('hacer, deshacer y rehacer recorren los estados', () => {
    let h = crearHistoria(0);
    h = hacer(hacer(h, 1, 10), 2, 10);
    expect(h.presente).toBe(2);
    h = deshacer(h);
    expect(h.presente).toBe(1);
    expect(puedeRehacer(h)).toBe(true);
    h = rehacer(h);
    expect(h.presente).toBe(2);
    expect(puedeRehacer(h)).toBe(false);
  });

  it('un cambio nuevo descarta el futuro', () => {
    let h = hacer(hacer(crearHistoria(0), 1, 10), 2, 10);
    h = hacer(deshacer(h), 9, 10);
    expect(h.futuro).toEqual([]);
    expect(h.pasado).toEqual([0, 1]);
  });

  it('el mismo estado no agrega paso', () => {
    const h = crearHistoria('a');
    expect(hacer(h, 'a', 10)).toBe(h);
  });

  it('recorta el pasado al tope', () => {
    let h = crearHistoria(0);
    for (let i = 1; i <= 5; i++) h = hacer(h, i, 3);
    expect(h.pasado).toEqual([2, 3, 4]);
  });

  it('en los extremos deshacer y rehacer no hacen nada y es inmutable', () => {
    const h = crearHistoria(1);
    expect(puedeDeshacer(h)).toBe(false);
    expect(deshacer(h)).toBe(h);
    expect(rehacer(h)).toBe(h);
    hacer(h, 2, 5);
    expect(h).toEqual({ pasado: [], presente: 1, futuro: [] });
  });
});
