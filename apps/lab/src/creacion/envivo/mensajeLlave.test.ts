import { describe, expect, it } from 'vitest';
import { mensajeLlave } from './mensajeLlave';

describe('mensaje de la llave de demo', () => {
  const incorrecta = 'La llave de demo es incorrecta.';
  it('sin llave escrita pide escribirla, no dice «incorrecta»', () => {
    expect(mensajeLlave(incorrecta, '')).toBe(
      'Escribe la llave de la demo para abrir tu sala a invitados.',
    );
  });
  it('con una llave escrita que falló, dice «incorrecta»', () => {
    expect(mensajeLlave(incorrecta, 'abc')).toBe(incorrecta);
  });
  it('otros errores pasan tal cual', () => {
    expect(mensajeLlave('No pudimos conectar; reintentando', '')).toBe(
      'No pudimos conectar; reintentando',
    );
  });
});
