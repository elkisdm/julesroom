import { describe, expect, it } from 'vitest';
import { crearAsignador, escalaDeCelda, uvDeCelda } from './celdas';
import type { GeometriaAtlas } from './celdas';

const atlas: GeometriaAtlas = { columnas: 4, filas: 2, celdaAncho: 128, celdaAlto: 100, margen: 4 };

describe('crearAsignador', () => {
  it('asigna índices consecutivos y devuelve el mismo para la misma clave', () => {
    const celdas = crearAsignador(3);
    expect(celdas.asignar('a')).toEqual({ indice: 0, nueva: true });
    expect(celdas.asignar('b')).toEqual({ indice: 1, nueva: true });
    expect(celdas.asignar('a')).toEqual({ indice: 0, nueva: false });
  });

  it('falla con un mensaje claro cuando el atlas está lleno', () => {
    const celdas = crearAsignador(1);
    celdas.asignar('a');
    expect(() => celdas.asignar('b')).toThrow(/lleno/);
  });
});

describe('uvDeCelda / escalaDeCelda', () => {
  it('la celda 0 queda arriba a la izquierda del lienzo (v alto), con margen', () => {
    const salida = { x: 0, y: 0 };
    uvDeCelda(atlas, 0, salida);
    expect(salida.x).toBeCloseTo(4 / 512, 6);
    // la celda ocupa filas 0..100 de 200 desde arriba: su borde inferior (con margen) está en v = 1 - 96/200
    expect(salida.y).toBeCloseTo(1 - 96 / 200, 6);
  });

  it('avanza por columnas y luego por filas', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    uvDeCelda(atlas, 5, a); // columna 1, fila 1
    uvDeCelda(atlas, 1, b); // columna 1, fila 0
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(b.y - a.y).toBeCloseTo(100 / 200, 6);
    expect(a.x).toBeCloseTo((128 + 4) / 512, 6);
  });

  it('la escala excluye el margen de ambos lados', () => {
    const escala = escalaDeCelda(atlas);
    expect(escala.x).toBeCloseTo(120 / 512, 6);
    expect(escala.y).toBeCloseTo(92 / 200, 6);
  });

  it('el recorte de la última celda no se sale de la textura', () => {
    const salida = { x: 0, y: 0 };
    uvDeCelda(atlas, 7, salida);
    const escala = escalaDeCelda(atlas);
    expect(salida.x + escala.x).toBeLessThanOrEqual(1);
    expect(salida.y).toBeGreaterThanOrEqual(0);
  });
});
