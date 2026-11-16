import { describe, it, expect } from 'vitest';
import { encuadrarBurbuja } from './encuadre';
describe('burbuja legible dentro de la ventana', () => {
  it('conserva el anclaje cuando cabe', () => {
    expect(encuadrarBurbuja({ x: 720, y: 400 }, 320, 100, 1440, 900)).toEqual({ x: 720, y: 400 });
  });
  it('entra completa por ambos bordes en móvil', () => {
    expect(encuadrarBurbuja({ x: -30, y: 40 }, 270, 100, 390, 844)).toEqual({ x: 147, y: 130 });
    expect(encuadrarBurbuja({ x: 900, y: 400 }, 270, 100, 390, 844).x).toBe(243);
  });
});
