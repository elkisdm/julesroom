import { expect, it, vi } from 'vitest';
import { alEstarActivo, salaDeFondo } from './bancosInactivos';

it('un banco oculto no ejecuta animaciones, y al activarlo reanuda sin remontar', () => {
  const activo = { current: false };
  const callback = vi.fn();
  const cuadro = alEstarActivo(activo, callback);
  cuadro(0.016);
  expect(callback).not.toHaveBeenCalled();
  activo.current = true;
  cuadro(0.016);
  expect(callback).toHaveBeenCalledWith(0.016);
  activo.current = false;
  cuadro(0.02);
  expect(callback).toHaveBeenCalledTimes(1);
});
it('la comparación conserva el fondo del motor y al salir entrega la selección actual', () => {
  const vieja = { mundo: 'a' };
  const nueva = { mundo: 'b' };
  expect(salaDeFondo(nueva, vieja, true)).toBe(vieja);
  expect(salaDeFondo(nueva, vieja, false)).toBe(nueva);
  expect(nueva.mundo).toBe('b');
});

it('la llegada conserva su primer render; la comparación espera el banco preparado', async () => {
  const { puedeDibujarBanco } = await import('./bancosInactivos');
  expect(puedeDibujarBanco(false, undefined)).toBe(true);
  expect(puedeDibujarBanco(true, undefined)).toBe(false);
  expect(puedeDibujarBanco(true, 'lista')).toBe(true);
  expect(puedeDibujarBanco(true, 'error')).toBe(true);
});
