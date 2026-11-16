import { describe, expect, it } from 'vitest';
import { escenarioPorId } from '@oficina/motor';
import { crearPresenciaDemo, PERSONAS } from './escenaDemo';

describe('presencia de la sala de ejemplo', () => {
  it('hay cinco visitantes más el avatar propio, sin duplicar las altas conocidas', () => {
    const fuente = crearPresenciaDemo(escenarioPorId('oficina'));
    expect(fuente.personas()).toHaveLength(5);
    expect(
      fuente
        .personas()
        .map((p) => p.id)
        .sort(),
    ).toEqual(PERSONAS.map((p) => p.id).sort());
  });
  it('usa el suelo cero cuando el escenario no declara entradas', () => {
    const escenario = { ...escenarioPorId('oficina'), entradas: [] };
    expect(
      crearPresenciaDemo(escenario)
        .personas()
        .every((p) => p.y === 0),
    ).toBe(true);
  });
  it('la fuente avanza en ambos escenarios sin servicios externos', () => {
    for (const id of ['oficina', 'trading']) {
      const fuente = crearPresenciaDemo(escenarioPorId(id));
      const antes = fuente.personas().map((p) => [p.x, p.z]);
      for (let i = 0; i < 200; i++) fuente.avanzar(0.05);
      const despues = fuente.personas().map((p) => [p.x, p.z]);
      expect(despues).not.toEqual(antes);
      expect(despues.flat().every(Number.isFinite)).toBe(true);
    }
  });
});
