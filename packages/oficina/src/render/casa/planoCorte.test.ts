import { afterEach, expect, it } from 'vitest';
import { NIVEL_Y } from '../../mansion/plano';
import { alturaDeCorteSeguir, SIN_CORTE } from './corte';
import { actualizarCorteSeguimiento, planoCorte } from './planoCorte';

afterEach(() => {
  actualizarCorteSeguimiento(null, 0);
  planoCorte.constant = SIN_CORTE;
});

it('un dibujo sin seguimiento no vuelve a tapar con losas al avatar seguido', () => {
  actualizarCorteSeguimiento(0, 1 / 60);
  planoCorte.constant = SIN_CORTE;
  expect(planoCorte.constant).toBe(alturaDeCorteSeguir(0));
  actualizarCorteSeguimiento(null, 0);
  expect(planoCorte.constant).toBe(SIN_CORTE);
});

it('al subir conserva el corte suave y al bajar oculta inmediatamente la losa de arriba', () => {
  actualizarCorteSeguimiento(0, 1 / 60);
  const inicial = planoCorte.constant;
  actualizarCorteSeguimiento(NIVEL_Y.piso2, 1 / 60);
  expect(planoCorte.constant).toBeGreaterThan(inicial);
  expect(planoCorte.constant).toBeLessThan(alturaDeCorteSeguir(NIVEL_Y.piso2));
  actualizarCorteSeguimiento(0, 1 / 60);
  expect(planoCorte.constant).toBe(alturaDeCorteSeguir(0));
});
