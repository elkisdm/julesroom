import { describe, expect, it } from 'vitest';
import {
  escenarioMansion,
  escenarioOficina,
  escenarioPorId,
  escenarioTrading,
  mundoVacio,
  parsearSala,
  serializarSala,
  migrarDefinicion,
  validarSala,
} from '@oficina/motor';
import type { Escenario, SalaGuardada } from '@oficina/motor';
import { ejemploEquipo } from '@oficina/motor';
import { elegirVariante, tieneVariantes, varianteActiva } from './variantes';

const base = { ...ejemploEquipo, plano: { plantilla: 'trading' } };
const sala = (): SalaGuardada => migrarDefinicion(base);
const con = (m: Partial<SalaGuardada['mundo']>): SalaGuardada => ({
  ...sala(),
  mundo: { ...mundoVacio(), ...m },
});

describe('variante de la sala', () => {
  it('elegirVariante deja la variante en el mundo de la sala', () => {
    const escenario = escenarioPorId('trading');
    const v = escenario.variantes[1]; // segunda variante ('ambar')
    expect(v).toBeDefined();
    if (!v) return;
    const s = elegirVariante(sala(), v.id);
    expect(s.mundo.variante).toBe(v.id);
  });

  it('exportar e importar conserva la variante', () => {
    const escenario = escenarioPorId('trading');
    const v = escenario.variantes[1];
    expect(v).toBeDefined();
    if (!v) return;
    const s = elegirVariante(sala(), v.id);
    const texto = serializarSala(s);
    const r = parsearSala(texto);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sala.mundo.variante).toBe(v.id);
      expect(varianteActiva(escenario, r.sala.mundo.variante)).toBe(v.id);
    }
  });

  it('una sala guardada sin variante carga con la variante por defecto y no lanza', () => {
    const s = sala();
    expect(s.mundo.variante).toBeUndefined();
    const escenario = escenarioPorId('trading');
    const activa = varianteActiva(escenario, s.mundo.variante);
    expect(activa).toBe(escenario.variantes[0]!.id);
  });

  it('un id de variante que no existe cae a la variante por defecto', () => {
    const escenario = escenarioPorId('trading');
    const activa = varianteActiva(escenario, 'no-existe-xyz');
    expect(activa).toBe(escenario.variantes[0]!.id);
  });

  it('una variante importada de otra plantilla (ej. ambar de trading en oficina) cae a la variante por defecto', () => {
    const oficina = escenarioPorId('oficina');
    // 'ambar' es una variante de trading, pero no existe en oficina
    const activa = varianteActiva(oficina, 'ambar');
    expect(activa).toBe(oficina.variantes[0]!.id);
  });

  it('validarSala acepta una sala con variante texto', () => {
    const s = con({ variante: 'cualquier-id' });
    const r = validarSala(s);
    expect(r.ok).toBe(true);
  });

  it('validarSala rechaza variante no texto', () => {
    const s = con({ variante: 42 as unknown as string });
    const r = validarSala(s);
    expect(r.ok).toBe(false);
    expect(r.errores.join(' ')).toMatch(/variante/);
  });
});

describe('tieneVariantes', () => {
  it('devuelve true para escenarios con más de una variante', () => {
    expect(tieneVariantes(escenarioTrading)).toBe(true);
    expect(tieneVariantes(escenarioOficina)).toBe(true);
    expect(tieneVariantes(escenarioMansion)).toBe(true);
  });

  it('devuelve false para escenarios con una sola variante', () => {
    const escenarioUnaVariante: Escenario = {
      ...escenarioTrading,
      variantes: [{ id: 'unica', nombre: 'Única', paleta: { hora: 12 } }],
    };
    expect(tieneVariantes(escenarioUnaVariante)).toBe(false);
  });

  it('devuelve false para escenarios sin variantes o undefined', () => {
    const sinVariantes: Escenario = { ...escenarioTrading, variantes: [] };
    expect(tieneVariantes(sinVariantes)).toBe(false);
    expect(tieneVariantes(undefined)).toBe(false);
  });
});
