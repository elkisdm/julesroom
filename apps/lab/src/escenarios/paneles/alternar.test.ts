import { expect, it } from 'vitest';
import { alternarPanel, estadoInicial } from './abrir';
it('E abre y la siguiente E cierra el mismo panel, incluso fijado', () => {
  const abierto = alternarPanel(estadoInicial, 'aula');
  expect(abierto.panel).toEqual({ tipo: 'aula' });
  expect(alternarPanel({ ...abierto, fijado: true }, 'aula')).toEqual(estadoInicial);
  expect(alternarPanel(abierto, 'videos').panel).toEqual({ tipo: 'videos' });
  expect(alternarPanel(abierto, 'desconocido')).toBe(abierto);
});
