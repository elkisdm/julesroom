import { describe, expect, it } from 'vitest';
import { accionLlegada, fechaRelativa, moverSala } from './biblioteca';
describe('estados de llegada', () => {
  it('sin salas invita a crear, con salas nombra la última y ofrece biblioteca', () => {
    expect(accionLlegada([])).toEqual({ principal: 'Crear mi sala', conSalas: false });
    expect(accionLlegada([{ nombre: 'Estudio' }])).toEqual({
      principal: 'Entrar a Estudio',
      conSalas: true,
    });
  });
  it('recorre con flechas y tolera el vacío', () => {
    expect(moverSala(0, 2, 'ArrowLeft')).toBe(1);
    expect(moverSala(1, 2, 'ArrowDown')).toBe(0);
    expect(moverSala(1, 2, 'ArrowUp')).toBe(0);
    expect(moverSala(0, 0, 'ArrowRight')).toBe(-1);
    expect(moverSala(0, 2, 'Enter')).toBe(0);
  });
  it('muestra fechas relativas, sin depender de la zona horaria', () => {
    const dia = 86400000;
    expect(fechaRelativa(dia, dia)).toBe('hoy');
    expect(fechaRelativa(0, dia)).toBe('ayer');
    expect(fechaRelativa(0, 2 * dia)).toBe('hace 2 días');
    expect(fechaRelativa(dia, 0)).toBe('hoy');
  });
});
