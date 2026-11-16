import { expect, it } from 'vitest';
import { estadoElegido } from './precargaElegida';
it('habilita con el mundo elegido sin esperar otros mundos', () => {
  expect(estadoElegido({ 'trading:noche': 'lista' }, 'trading:noche')).toEqual({
    terminada: true,
    porcentaje: 100,
    fallos: 0,
  });
  expect(estadoElegido({ 'trading:noche': 'lista' }, 'oficina:dia').terminada).toBe(false);
});
it('un fallo permite seguir sin dejar el botón bloqueado', () => {
  expect(estadoElegido({ 'trading:noche': 'error' }, 'trading:noche')).toEqual({
    terminada: true,
    porcentaje: 100,
    fallos: 1,
  });
});
