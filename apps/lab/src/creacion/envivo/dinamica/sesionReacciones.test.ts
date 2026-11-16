import { it, expect } from 'vitest';
import { sesionReacciones } from './sesionReacciones';
it('conserva manos y sigue recibiéndolas mientras el anfitrión abre el constructor', () => {
  let recibir: (texto: string, emisor: string) => void = () => undefined;
  const fuente = {
    personas: () => [{ id: 'b' }],
    suscribirDatos: (fn: typeof recibir) => {
      recibir = fn;
      return () => undefined;
    },
  };
  const s = sesionReacciones(fuente, 'a', 'a');
  const salir = s.suscribir(() => undefined);
  salir();
  recibir(JSON.stringify({ tipo: 'd2-reaccion', reaccion: 3, activa: true }), 'b');
  const regreso = sesionReacciones(fuente, 'a', 'a');
  expect(regreso).toBe(s);
  expect(regreso.estado.manos()).toEqual(['b']);
});
it('cada fuente tiene un estado independiente', () => {
  const fuente = () => ({ personas: () => [], suscribirDatos: () => () => undefined });
  const a = sesionReacciones(fuente(), 'a', 'a');
  a.aplicar('a', 3, true);
  expect(sesionReacciones(fuente(), 'b', 'b').estado.manos()).toEqual([]);
});
