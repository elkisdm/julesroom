import { describe, expect, it } from 'vitest';
import { crearVentana } from './percentiles';

describe('crearVentana', () => {
  it('calcula p50 y p95 por rango más cercano', () => {
    const v = crearVentana(100);
    for (let i = 1; i <= 100; i++) v.agregar(i);
    expect(v.percentil(50)).toBe(50);
    expect(v.percentil(95)).toBe(95);
    expect(v.percentil(100)).toBe(100);
  });

  it('descarta lo más viejo al llenarse (ring buffer)', () => {
    const v = crearVentana(3);
    [100, 100, 100, 1, 2, 3].forEach((x) => v.agregar(x));
    expect(v.tamano()).toBe(3);
    expect(v.percentil(95)).toBe(3);
  });

  it('con ventana vacía devuelve 0 y tamaño 0', () => {
    const v = crearVentana(10);
    expect(v.tamano()).toBe(0);
    expect(v.percentil(95)).toBe(0);
  });

  it('un solo dato es todos los percentiles', () => {
    const v = crearVentana(10);
    v.agregar(16.7);
    expect(v.percentil(50)).toBe(16.7);
    expect(v.percentil(95)).toBe(16.7);
  });

  it('no depende del orden de llegada', () => {
    const v = crearVentana(5);
    [9, 1, 7, 3, 5].forEach((x) => v.agregar(x));
    expect(v.percentil(50)).toBe(5);
  });

  it('rechaza una capacidad inválida', () => {
    expect(() => crearVentana(0)).toThrow(/capacidad/);
  });
});
