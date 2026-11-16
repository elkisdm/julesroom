import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { crearMando } from '../animacion/avatar';
import { crearEscenarioPrueba } from '../escenarios/prueba';
import { ContextoEscenario } from './escenarios/contexto';
import { Acciones, crearEstadoAvatar } from './Acciones';
import type { Accion } from '../escenarios/tipos';
let cuadro: (s: unknown, d: number) => void;
vi.mock('@react-three/fiber', () => ({
  useFrame: (f: typeof cuadro) => {
    cuadro = f;
  },
}));
it('el botón táctil consume cada pulsación una sola vez por el motor', () => {
  const mando = crearMando(),
    alAccion = vi.fn();
  renderToStaticMarkup(
    createElement(
      ContextoEscenario.Provider,
      { value: crearEscenarioPrueba() },
      createElement(Acciones, {
        avatar: { current: crearEstadoAvatar() },
        accion: { current: null },
        onAccionCercana: { current: undefined },
        mando,
        alAccion,
      }),
    ),
  );
  mando.acciones = 1;
  cuadro(null, 0.016);
  cuadro(null, 0.016);
  expect(alAccion).toHaveBeenCalledTimes(1);
  mando.acciones = 2;
  cuadro(null, 0.016);
  expect(alAccion).toHaveBeenCalledTimes(2);
});
describe('selección del componente', () => {
  it('girar sin desplazarse conserva la elección', () => {
    const e = crearEscenarioPrueba();
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
    e.acciones = [a, { ...a, id: 'b', z: -1 }];
    const avatar = { current: crearEstadoAvatar() },
      accion = { current: null as Accion | null };
    renderToStaticMarkup(
      createElement(
        ContextoEscenario.Provider,
        { value: e },
        createElement(Acciones, { avatar, accion, onAccionCercana: { current: undefined } }),
      ),
    );
    cuadro(null, 1);
    expect(accion.current?.id).toBe('a');
    avatar.current.rumbo = Math.PI;
    cuadro(null, 1);
    expect(accion.current?.id).toBe('a');
  });
});
