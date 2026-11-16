import { expect, it } from 'vitest';
import { escenarioAuditorio, escenarioOficina } from '@oficina/motor';
import { lugaresDe } from './lugares';
it('ofrece solo lugares existentes y puntos libres en auditorio y oficina', () => {
  for (const escenario of [escenarioAuditorio, escenarioOficina]) {
    const lugares = lugaresDe(escenario);
    expect(lugares.some((p) => p.id === 'centro')).toBe(true);
    expect(lugares.some((p) => p.id === 'asientos')).toBe(true);
    expect(lugares.some((p) => p.id === 'pantalla')).toBe(true);
    expect(lugares.every((p) => [p.x, p.y, p.z].every(Number.isFinite))).toBe(true);
  }
  expect(lugaresDe(escenarioAuditorio).some((p) => p.id === 'escenario')).toBe(true);
  expect(lugaresDe(escenarioOficina).some((p) => p.id === 'escenario')).toBe(false);
  expect(lugaresDe({ ...escenarioOficina, pantallas: [] }).some((p) => p.id === 'pantalla')).toBe(
    false,
  );
});

it('incluye una pantalla colocada aunque el mundo no tenga pantallas fijas', () => {
  const mundo = { ...escenarioOficina, pantallas: [] };
  const entrada = mundo.entradas[0]!;
  expect(lugaresDe(mundo, entrada, { ...entrada, giro: 0 }).some((p) => p.id === 'pantalla')).toBe(
    true,
  );
});
