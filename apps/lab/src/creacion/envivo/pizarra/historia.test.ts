import { expect, it } from 'vitest';
import { agregar, mover, vacia } from './historia';
import { ejemplos } from './modelo';
it('historial acotado, volver/siguiente y nueva rama tras volver', () => {
  const a = agregar(vacia(), ejemplos('idea'));
  const b = agregar(a, ejemplos('mapa'));
  expect(mover(b, -1).indice).toBe(0);
  expect(mover(b, 1).indice).toBe(1);
  const c = agregar(mover(b, -1), ejemplos('capas'));
  expect(c.laminas.map((p) => p.tipo)).toEqual(['idea', 'capas']);
  let h = c;
  for (let i = 0; i < 40; i++) h = agregar(h, ejemplos('idea'));
  expect(h.laminas).toHaveLength(30);
  expect(h.indice).toBe(29);
});
