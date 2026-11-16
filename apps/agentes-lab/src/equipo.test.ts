import { describe, expect, it } from 'vitest';
import { EQUIPO_EJEMPLO } from '@oficina/agentes';
import { escenarioPorId } from '@oficina/motor';
import { DEPARTAMENTOS_SALA, agentesDeEquipo } from './equipo';

describe('agentesDeEquipo', () => {
  it('crea un agente por definición, cada uno en un departamento distinto y trabajando', () => {
    const agentes = agentesDeEquipo(EQUIPO_EJEMPLO);
    expect(agentes.map((a) => a.id)).toEqual(['analista', 'disenadora', 'soporte']);
    expect(new Set(agentes.map((a) => a.departamento)).size).toBe(3);
    expect(agentes.every((a) => a.estado === 'trabajando')).toBe(true);
  });

  it('cada agente cae en una mesa real de la Nave (tiene lugares, y con silla)', () => {
    const escenario = escenarioPorId('oficina');
    expect(escenario.asignacion).toBe('por-orden');
    for (const a of agentesDeEquipo(EQUIPO_EJEMPLO)) {
      const clave = `equipo-${DEPARTAMENTOS_SALA.findIndex((d) => d.id === a.departamento) + 1}`;
      const suyos = escenario.planta.lugares.filter((l) => l.departamento === clave);
      expect(suyos.length, a.nombre).toBeGreaterThan(0);
      expect(
        suyos.some((l) => l.asiento),
        a.nombre,
      ).toBe(true);
    }
  });

  it('falla con claridad si hay más agentes que mesas', () => {
    const def = EQUIPO_EJEMPLO[0];
    if (!def) throw new Error('sin ejemplo');
    expect(() => agentesDeEquipo([def, def, def, def, def])).toThrow(/mesas/);
  });
});
