import { expect, it } from 'vitest';
import { eventoDelRecorrido, eventoDeTecla } from './ayuda';
const yo = { x: 0, y: 0, z: 0, velocidad: 0, estado: 'de-pie' };
it('completa solo acciones físicas del paso actual', () => {
  expect(eventoDelRecorrido({ paso: 0 }, yo, 0, null)).toBeNull();
  expect(eventoDelRecorrido({ paso: 0 }, { ...yo, velocidad: 4 }, 0, null)).toBe('correr');
  expect(eventoDelRecorrido({ paso: 1 }, { ...yo, y: 0.6 }, 0, null)).toBe('saltar');
  expect(eventoDelRecorrido({ paso: 2 }, { ...yo, estado: 'sentado' }, 0, null)).toBe('sentado');
  expect(eventoDelRecorrido({ paso: 3 }, { ...yo, velocidad: 4 }, 0, null)).toBeNull();
  expect(eventoDelRecorrido(null, yo, 0, yo)).toBeNull();
});
it('sin pantalla requiere siguiente; una pantalla lejana tampoco completa', () => {
  expect(eventoDelRecorrido({ paso: 4 }, yo, 0, null)).toBeNull();
  expect(eventoDelRecorrido({ paso: 4 }, yo, 0, { ...yo, x: 8 })).toBeNull();
  expect(eventoDelRecorrido({ paso: 4 }, yo, 0, { ...yo, x: 2 })).toBe('pantalla');
});

it('salto por teclado y reacciones: ignora formularios, repetición y modificadores', () => {
  expect(eventoDeTecla('Space', false, false, false)).toBe('saltar');
  expect(eventoDeTecla('Digit2', false, false, false)).toBe('reaccion');
  expect(eventoDeTecla('Space', true, false, false)).toBeNull();
  expect(eventoDeTecla('Space', false, true, false)).toBeNull();
  expect(eventoDeTecla('Digit2', false, false, true)).toBeNull();
  expect(eventoDeTecla('KeyE', false, false, false)).toBeNull();
});
