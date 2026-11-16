import { expect, it } from 'vitest';
import { precargarEnTurnos } from './precargaModulos';
it('cede un turno entre módulos y permite cancelar la cola', async () => {
  const turnos: (() => void)[] = [];
  const hechos: string[] = [];
  const cancelar = precargarEnTurnos(
    [
      async () => {
        hechos.push('a');
      },
      async () => {
        hechos.push('b');
      },
    ],
    (t) => {
      turnos.push(t);
      return () => {
        turnos.splice(turnos.indexOf(t), 1);
      };
    },
  );
  expect(hechos).toEqual([]);
  turnos.shift()!();
  await Promise.resolve();
  await Promise.resolve();
  expect(hechos).toEqual(['a']);
  expect(turnos).toHaveLength(1);
  cancelar();
  expect(turnos).toHaveLength(0);
});
it('un fallo se informa y no bloquea el módulo siguiente', async () => {
  const turnos: (() => void)[] = [];
  const errores: unknown[] = [];
  let siguiente = false;
  precargarEnTurnos(
    [
      async () => {
        throw Error('sin red');
      },
      async () => {
        siguiente = true;
      },
    ],
    (t) => {
      turnos.push(t);
      return () => {};
    },
    (e) => errores.push(e),
  );
  turnos.shift()!();
  await new Promise((r) => setTimeout(r, 0));
  expect(errores).toHaveLength(1);
  turnos.shift()!();
  await new Promise((r) => setTimeout(r, 0));
  expect(siguiente).toBe(true);
});
