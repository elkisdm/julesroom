import { describe, expect, it } from 'vitest';
import { dibujoDe, registrarDibujo } from './registroDibujo';

const Falso = (): null => null;

describe('registro de dibujos', () => {
  it('devuelve el componente registrado por id', () => {
    registrarDibujo('dibujo-prueba', Falso);
    expect(dibujoDe('dibujo-prueba')).toBe(Falso);
  });

  it('un id sin dibujo da undefined', () => {
    expect(dibujoDe('sin-dibujo')).toBeUndefined();
  });

  it('registrar dos veces el mismo id lanza', () => {
    registrarDibujo('dibujo-doble', Falso);
    expect(() => registrarDibujo('dibujo-doble', Falso)).toThrow(/dibujo-doble/);
  });
});
