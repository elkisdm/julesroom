import { describe, expect, it } from 'vitest';
import { dibujoDe } from '../registroDibujo';
import { DibujoOficina } from './DibujoOficina';

describe('DibujoOficina', () => {
  it('queda registrado para el escenario «oficina»', () => {
    expect(dibujoDe('oficina')).toBe(DibujoOficina);
  });
});
