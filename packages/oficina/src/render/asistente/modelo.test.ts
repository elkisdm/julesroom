import { describe, expect, it } from 'vitest';
import { geometriasAsistente } from './modelo';

describe('geometriasAsistente', () => {
  it('funde todas las piezas (bloques y aros) sin error de atributos o índice', () => {
    const g = geometriasAsistente();
    for (const parte of [g.cuerpo, g.cabeza, g.brazoTableta, g.brazoSuperior, g.brazoInferior]) {
      expect(parte.getAttribute('position').count).toBeGreaterThan(0);
      expect(parte.getAttribute('color').count).toBe(parte.getAttribute('position').count);
    }
  });

  it('comparte la misma instancia entre llamadas', () => {
    expect(geometriasAsistente()).toBe(geometriasAsistente());
  });
});
