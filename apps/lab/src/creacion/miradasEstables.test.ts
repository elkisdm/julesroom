/**
 * Unión de F (paso «Entrar» arma la sala con los agentes elegidos en cada render) con I
 * (useInteraccionFisica): al estar inactivo el hook vaciaba las miradas con un objeto nuevo en
 * cada efecto y React entraba en «Maximum update depth exceeded». El estado solo cambia si cambian
 * los agentes que miran.
 */
import { describe, expect, it } from 'vitest';
import { miradasSiguientes } from './interaccionFisica';

describe('miradas de los agentes: el estado no cambia si no cambian quiénes miran', () => {
  it('vaciar unas miradas ya vacías conserva el mismo objeto (sin nuevo render)', () => {
    const antes = {};
    expect(miradasSiguientes(antes, {})).toBe(antes);
  });

  it('los mismos agentes mirando conservan el objeto; otros agentes lo reemplazan', () => {
    const antes = { a: 'avatar-propio' };
    expect(miradasSiguientes(antes, { a: 'avatar-propio' })).toBe(antes);
    const otras = { b: 'avatar-propio' };
    expect(miradasSiguientes(antes, otras)).toBe(otras);
    expect(miradasSiguientes(antes, {})).toEqual({});
  });
});
