import { describe, expect, it } from 'vitest';
import { BoxGeometry, Color, IcosahedronGeometry, Matrix4, MeshBasicMaterial } from 'three';
import { fusionar } from './fusion';
import type { Familia, Estilo } from './flota';

const conColor: Familia = {
  clave: 'a',
  material: new MeshBasicMaterial(),
  fusion: new MeshBasicMaterial({ vertexColors: true }),
};
const otra: Familia = {
  clave: 'b',
  material: new MeshBasicMaterial(),
  fusion: new MeshBasicMaterial({ vertexColors: true }),
};
const sinColor: Familia = { clave: 'vidrio', material: new MeshBasicMaterial() };
const estilo = (familia: Familia, color: Color | null = null): Estilo => ({ familia, color });
const mover = (x: number) => new Matrix4().makeTranslation(x, 0, 0);
const caja = new BoxGeometry(1, 1, 1);

describe('fusionar', () => {
  it('junta en una sola geometría todas las piezas de una misma familia', () => {
    const [una, ...resto] = fusionar([
      { geometria: caja, estilo: estilo(conColor, new Color(1, 0, 0)), matriz: mover(0) },
      { geometria: caja, estilo: estilo(conColor, new Color(0, 1, 0)), matriz: mover(5) },
    ]);
    expect(resto).toHaveLength(0);
    // 12 triángulos por caja × 3 vértices × 2 cajas (sin índice)
    expect(una?.geometria.getAttribute('position').count).toBe(72);
    expect(una?.material).toBe(conColor.fusion);
  });

  it('hornea la transformación de cada pieza en sus vértices', () => {
    const [fusion] = fusionar([{ geometria: caja, estilo: estilo(conColor), matriz: mover(10) }]);
    fusion?.geometria.computeBoundingBox();
    expect(fusion?.geometria.boundingBox?.min.x).toBeCloseTo(9.5, 6);
    expect(fusion?.geometria.boundingBox?.max.x).toBeCloseTo(10.5, 6);
  });

  it('el color de cada pieza queda en sus vértices', () => {
    const [fusion] = fusionar([
      { geometria: caja, estilo: estilo(conColor, new Color(1, 0, 0)), matriz: mover(0) },
      { geometria: caja, estilo: estilo(conColor, new Color(0, 0, 1)), matriz: mover(5) },
    ]);
    const color = fusion?.geometria.getAttribute('color');
    expect([color?.getX(0), color?.getY(0), color?.getZ(0)]).toEqual([1, 0, 0]);
    expect([color?.getX(40), color?.getY(40), color?.getZ(40)]).toEqual([0, 0, 1]);
  });

  it('familias distintas dan mallas distintas', () => {
    const lista = fusionar([
      { geometria: caja, estilo: estilo(conColor), matriz: mover(0) },
      { geometria: caja, estilo: estilo(otra), matriz: mover(0) },
    ]);
    expect(lista).toHaveLength(2);
  });

  it('una familia sin variante de fusión conserva su material y no lleva color por vértice', () => {
    const [fusion] = fusionar([{ geometria: caja, estilo: estilo(sinColor), matriz: mover(0) }]);
    expect(fusion?.material).toBe(sinColor.material);
    expect(fusion?.geometria.getAttribute('color')).toBeUndefined();
  });

  it('mezcla geometrías con y sin índice', () => {
    const [fusion] = fusionar([
      { geometria: caja, estilo: estilo(conColor), matriz: mover(0) },
      { geometria: new IcosahedronGeometry(0.5, 0), estilo: estilo(conColor), matriz: mover(2) },
    ]);
    expect(fusion?.geometria.getAttribute('position').count).toBe(36 + 60);
  });

  it('no modifica la geometría original', () => {
    fusionar([{ geometria: caja, estilo: estilo(conColor), matriz: mover(7) }]);
    expect(caja.getAttribute('color')).toBeUndefined();
    expect(caja.getIndex()).not.toBeNull();
  });
});
