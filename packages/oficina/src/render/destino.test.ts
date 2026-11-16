import { describe, expect, it } from 'vitest';
import { crearMando, fijarDestino } from '../animacion/avatar';
import { opacidadMarcaDestino, PARAMETROS_DESTINO } from './entradaAvatar';

describe('marca de destino', () => {
  it('aparece al pedir un punto y se desvanece en el tiempo configurado', () => {
    const m = crearMando();
    expect(opacidadMarcaDestino(m, 0)).toBe(0);
    fijarDestino(m, 4, 3);
    const inicio = opacidadMarcaDestino(m, 0);
    expect(inicio).toBeGreaterThan(0);
    expect(opacidadMarcaDestino(m, PARAMETROS_DESTINO.duracion / 2)).toBeLessThan(inicio);
    expect(opacidadMarcaDestino(m, PARAMETROS_DESTINO.duracion)).toBe(0);
  });

  it('el teclado o la palanca la ocultan al cancelar el recorrido', () => {
    const m = crearMando();
    fijarDestino(m, 4, 3);
    m.adelante = 1;
    expect(opacidadMarcaDestino(m, 0)).toBe(0);
    m.adelante = 0;
    m.lateral = 0.1;
    expect(opacidadMarcaDestino(m, 0)).toBe(0);
  });
});
