import { describe, expect, it } from 'vitest';
import { crearSeleccionAccion, seleccionarAccion, PARAMETROS_ACCIONES } from './acciones';
import type { Accion } from './tipos';

const a: Accion = {
  id: 'a',
  tipo: 'abrir',
  nombre: 'A',
  x: 0,
  z: 1,
  radio: 2,
  interes: 'a',
  panel: 'a',
};
const b: Accion = { ...a, id: 'b', z: -1 };
describe('selección estable por desplazamiento', () => {
  it('girar quieto o moverse bajo el umbral conserva la elegida', () => {
    const s = crearSeleccionAccion();
    expect(seleccionarAccion(s, [a, b], 0, 0, 0, 0)).toBe(a);
    expect(
      seleccionarAccion(s, [a, b], PARAMETROS_ACCIONES.umbralMovimiento / 2, 0, 0, Math.PI),
    ).toBe(a);
    expect(seleccionarAccion(s, [a, b], 0, 0, 0, Math.PI)).toBe(a);
    expect(
      seleccionarAccion(s, [a, b], 0, -PARAMETROS_ACCIONES.umbralMovimiento * 2, 0, Math.PI),
    ).toBe(b);
  });
  it('invalida inmediatamente una acción ocupada, retirada o en otra planta', () => {
    const s = crearSeleccionAccion();
    seleccionarAccion(s, [a, b], 0, 0, 0, 0);
    expect(seleccionarAccion(s, [a, b], 0, 0, 0, 0, new Set(['a']))).toBe(b);
    expect(seleccionarAccion(s, [a], 0, 0, 0, 0)).toBe(a);
    expect(seleccionarAccion(s, [{ ...a, y: 4 }], 0, 0, 0, 0)).toBeNull();
  });
});

it('dos objetivos en alcance conservan la selección aunque uno se acerque', () => {
  const s = crearSeleccionAccion();
  const movil = { ...b, z: -1 };
  expect(seleccionarAccion(s, [a, movil], 0, 0, 0, 0)).toBe(a);
  movil.z = 0.1;
  expect(seleccionarAccion(s, [a, movil], 0, 0, 0, 0)).toBe(a);
});
