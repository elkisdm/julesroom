import { describe, expect, it } from 'vitest';
import { apilarEtiquetas, elegirEtiquetas, yDibujada, type RectEtiqueta } from './textoEtiquetas';
import { candidatoVivo, correccionNombre } from './nombresVivos';

describe('nombres de personas conectadas', () => {
  it('conserva veinte nombres aunque el nivel gráfico admita solo cuatro', () => {
    const lista = Array.from({ length: 20 }, (_, i) => candidatoVivo(`p${i}`, 100 + i, true));
    expect(elegirEtiquetas(lista, 4, new Set(), 0)).toHaveLength(20);
  });
  it('apila veinte nombres coincidentes sin descartar ninguno', () => {
    const rects: RectEtiqueta[] = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      x: 300,
      y: 500,
      ancho: 100,
      alto: 20,
      distancia: i,
      forzada: true,
    }));
    const salida = new Map<string, number>();
    apilarEtiquetas(rects, { maxNiveles: 3, ventaja: 0, tope: 20 }, new Map(), salida);
    expect(salida.size).toBe(20);
    expect(new Set(salida.values()).size).toBe(20);
  });
  it('reparte veinte nombres hacia arriba y abajo dentro del encuadre', () => {
    const rects: RectEtiqueta[] = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      x: 150,
      y: 120,
      ancho: 100,
      alto: 20,
      distancia: i,
      forzada: true,
    }));
    const opciones = { maxNiveles: 3, ventaja: 0, tope: 20, altoPantalla: 640 };
    const salida = new Map<string, number>();
    apilarEtiquetas(rects, opciones, new Map(), salida);
    expect(salida.size).toBe(20);
    for (const r of rects) {
      const y = yDibujada(r, salida.get(r.id)!, opciones);
      expect(y).toBeGreaterThanOrEqual(30);
      expect(y).toBeLessThanOrEqual(630);
    }
  });
  it('mantiene el nombre completo dentro de los bordes laterales', () => {
    expect(correccionNombre(0, 100, 320)).toBe(58);
    expect(correccionNombre(320, 100, 320)).toBe(-58);
    expect(correccionNombre(160, 100, 320)).toBe(0);
  });
  it('mantiene las restricciones gráficas para agentes', () => {
    expect(candidatoVivo('agente', 30, false).hablando).toBe(false);
  });
});
