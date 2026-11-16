import { afterEach, describe, expect, it, vi } from 'vitest';
import { escenarioMansion } from './mansion';
import { crearEscenarioPrueba } from './prueba';
import { escenarioPorId, hayEscenario, listarEscenarios, registrarEscenario } from './registro';

afterEach(() => vi.restoreAllMocks());

describe('registro de escenarios', () => {
  it('trae la mansión registrada', () => {
    expect(hayEscenario('mansion')).toBe(true);
    expect(escenarioPorId('mansion')).toBe(escenarioMansion);
    expect(listarEscenarios()).toContain(escenarioMansion);
  });

  it('registra un escenario nuevo y lo encuentra por id', () => {
    const e = crearEscenarioPrueba('prueba-registro');
    registrarEscenario(e);
    expect(hayEscenario('prueba-registro')).toBe(true);
    expect(escenarioPorId('prueba-registro')).toBe(e);
    expect(listarEscenarios().map((x) => x.id)).toContain('prueba-registro');
  });

  it('registrar dos veces el mismo id lanza', () => {
    registrarEscenario(crearEscenarioPrueba('prueba-doble'));
    expect(() => registrarEscenario(crearEscenarioPrueba('prueba-doble'))).toThrow(/prueba-doble/);
  });

  it('un id desconocido cae en la mansión con un aviso', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(escenarioPorId('no-existe')).toBe(escenarioMansion);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(hayEscenario('no-existe')).toBe(false);
  });
});
