import { describe, expect, it } from 'vitest';
import { colocarLibros } from './libros';
import type { Estante } from './libros';

const ESTANTE: Estante = { x0: -1.2, x1: 1.2, alto: 0.42, fondo: 0.3 };
const solapan = (a0: number, a1: number, b0: number, b1: number) =>
  a1 > b0 + 1e-9 && a0 < b1 - 1e-9;

describe('colocarLibros', () => {
  const { libros } = colocarLibros(ESTANTE, 11);
  const muestras = Array.from({ length: 24 }, (_, i) => colocarLibros(ESTANTE, i + 1));

  it('llena el estante (más del 55 % del largo) con lomos de varios colores', () => {
    for (const m of muestras) {
      const ocupado = m.libros.reduce((s, l) => s + l.ancho, 0);
      expect(ocupado / (ESTANTE.x1 - ESTANTE.x0)).toBeGreaterThan(0.55);
    }
    expect(new Set(libros.map((l) => l.color)).size).toBeGreaterThanOrEqual(5);
  });

  it('cada libro queda dentro del estante, más bajo que la balda siguiente', () => {
    for (const m of muestras) {
      for (const l of m.libros) {
        expect(l.x - l.ancho / 2).toBeGreaterThanOrEqual(ESTANTE.x0 - 1e-9);
        expect(l.x + l.ancho / 2).toBeLessThanOrEqual(ESTANTE.x1 + 1e-9);
        expect(l.alto).toBeLessThan(ESTANTE.alto);
        expect(l.alto).toBeGreaterThan(0);
        expect(l.ancho).toBeGreaterThan(0);
        expect(l.fondo).toBeLessThanOrEqual(ESTANTE.fondo);
      }
    }
  });

  it('los libros no se solapan entre sí', () => {
    for (const m of muestras) {
      const orden = [...m.libros].sort((a, b) => a.x - b.x);
      for (let i = 1; i < orden.length; i++) {
        const prev = orden[i - 1]!;
        const act = orden[i]!;
        expect(act.x - act.ancho / 2).toBeGreaterThanOrEqual(prev.x + prev.ancho / 2 - 1e-9);
      }
    }
  });

  it('deja huecos libres para objetos, dentro del estante y sin libros encima', () => {
    expect(muestras.some((m) => m.huecos.length > 0)).toBe(true);
    for (const m of muestras) {
      for (const h of m.huecos) {
        expect(h.x1 - h.x0).toBeGreaterThan(0.1);
        expect(h.x0).toBeGreaterThanOrEqual(ESTANTE.x0 - 1e-9);
        expect(h.x1).toBeLessThanOrEqual(ESTANTE.x1 + 1e-9);
        for (const l of m.libros) {
          expect(solapan(l.x - l.ancho / 2, l.x + l.ancho / 2, h.x0, h.x1)).toBe(false);
        }
      }
    }
  });

  it('es determinista: la misma semilla da los mismos lomos', () => {
    expect(colocarLibros(ESTANTE, 11)).toEqual(colocarLibros(ESTANTE, 11));
    expect(colocarLibros(ESTANTE, 12)).not.toEqual(colocarLibros(ESTANTE, 11));
  });
});
