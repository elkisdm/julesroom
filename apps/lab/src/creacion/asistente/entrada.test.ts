import { expect, it } from 'vitest';
import { esMensajeParaJules } from './control';
it.each(['ven', 'Jules, espera', '@Jules ven', '@Jules, ven', '@JULES: sígueme'])(
  'dirige %s a Jules',
  (texto) => {
    expect(esMensajeParaJules(texto)).toBe(true);
  },
);
it.each(['@Nova hola', '@Julesia ven'])('conserva otras menciones: %s', (texto) => {
  expect(esMensajeParaJules(texto)).toBe(false);
});
