import { describe, expect, it } from 'vitest';
import type { Interes } from '../escenarios/tipos';
import { HISTERESIS_INTERES, interesCercano } from './cercaniaInteres';

const interes = (id: string, x: number, z: number, radio = 2): Interes => ({
  id,
  nombre: id,
  x,
  z,
  radio,
  panel: id,
  zona: 'z',
});
const lista = [interes('aula', 0, 0), interes('mercado', 10, 0)];

describe('interesCercano', () => {
  it('sin intereses o lejos de todos no hay ninguno', () => {
    expect(interesCercano([], 0, 0, null, HISTERESIS_INTERES)).toBeNull();
    expect(interesCercano(lista, 5, 5, null, HISTERESIS_INTERES)).toBeNull();
  });

  it('entra al estar dentro del radio', () => {
    expect(interesCercano(lista, 1.9, 0, null, HISTERESIS_INTERES)).toBe('aula');
    expect(interesCercano(lista, 2.1, 0, null, HISTERESIS_INTERES)).toBeNull();
  });

  it('elige el más cercano cuando hay varios dentro de su radio', () => {
    const dos = [interes('a', 0, 0, 5), interes('b', 3, 0, 5)];
    expect(interesCercano(dos, 2, 0, null, HISTERESIS_INTERES)).toBe('b');
    expect(interesCercano(dos, 1, 0, null, HISTERESIS_INTERES)).toBe('a');
  });

  it('con histéresis: sigue dentro hasta radio + 0,3 y no parpadea en el borde', () => {
    expect(interesCercano(lista, 2.2, 0, 'aula', HISTERESIS_INTERES)).toBe('aula');
    expect(interesCercano(lista, 2.4, 0, 'aula', HISTERESIS_INTERES)).toBeNull();
    // Recién salido (2,4) ya no cuenta como dentro hasta volver a entrar (< 2).
    expect(interesCercano(lista, 2.2, 0, null, HISTERESIS_INTERES)).toBeNull();
  });

  it('la histéresis de uno no impide pasar a otro más cercano', () => {
    const dos = [interes('a', 0, 0, 2), interes('b', 3, 0, 2)];
    expect(interesCercano(dos, 2.1, 0, 'a', HISTERESIS_INTERES)).toBe('b');
  });

  it('la histéresis es de 0,3 m', () => {
    expect(HISTERESIS_INTERES).toBe(0.3);
  });
});
