import { expect, it } from 'vitest';
import { encuadreMiniatura } from './encuadreMiniaturas';

it('amplía el rasgo que cambia en lugar de reducir siempre el cuerpo completo', () => {
  const cuerpo = encuadreMiniatura('acc', false);
  const ropa = encuadreMiniatura('top', false);
  const abajo = encuadreMiniatura('bottom', false);
  const cara = encuadreMiniatura('face', true);
  expect(ropa.escala).toBeLessThan(cuerpo.escala);
  expect(abajo.escala).toBeLessThan(cuerpo.escala);
  expect(cara.escala).toBeLessThan(cuerpo.escala);
  expect(ropa.altura).toBeGreaterThan(abajo.altura);
  expect(cara.altura).toBeGreaterThan(ropa.altura);
  expect(encuadreMiniatura('hair', true)).toEqual(cara);
});
