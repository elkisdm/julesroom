import { expect, it } from 'vitest';
import { indicePorTecla } from './navegacionOpciones';

it('recorre opciones con flechas y vuelve por ambos bordes', () => {
  expect(indicePorTecla(0, 5, 'ArrowLeft')).toBe(4);
  expect(indicePorTecla(4, 5, 'ArrowRight')).toBe(0);
  expect(indicePorTecla(3, 5, 'ArrowUp')).toBe(2);
  expect(indicePorTecla(3, 5, 'ArrowDown')).toBe(4);
  expect(indicePorTecla(3, 5, 'Home')).toBe(0);
  expect(indicePorTecla(3, 5, 'End')).toBe(4);
  expect(indicePorTecla(0, 0, 'ArrowRight')).toBeNull();
  expect(indicePorTecla(0, 5, 'Enter')).toBeNull();
  expect(indicePorTecla(0, 5, 'Escape')).toBeNull();
});
