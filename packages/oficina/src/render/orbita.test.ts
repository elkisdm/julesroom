import { describe, expect, it } from 'vitest';
import { plano } from '../mansion/plano';
import { encuadreAmbiente, encuadreCasa } from './camara';
import { escenarioMansion } from '../escenarios/mansion';
import { acotarObjetivo, cajaPaneo, limitesOrbita } from './orbita';

const casa = encuadreCasa(1440, 900);
const ventas = plano.ambientes.find((a) => a.id === 'ventas');
if (!ventas) throw new Error('falta ventas en el plano');
const encVentas = encuadreAmbiente(ventas, 1440, 900);

describe('limitesOrbita', () => {
  const general = limitesOrbita(null, casa, null);
  const dentro = limitesOrbita(ventas, casa, encVentas);

  it('en la vista general se puede dar la vuelta completa', () => {
    expect(general.azimutMax).toBe(Infinity);
  });

  it('la elevación nunca baja del terreno ni llega al cenital', () => {
    for (const l of [general, dentro]) {
      expect(l.elevacionMin).toBeGreaterThan(0);
      expect(l.elevacionMax).toBeLessThan(Math.PI / 2 - 0.2);
    }
  });

  it('el zoom está acotado: ni dentro de la casa ni lejos de ella', () => {
    expect(general.distanciaMin).toBeGreaterThanOrEqual(3);
    expect(general.distanciaMax).toBeGreaterThan(casa.distancia);
    expect(general.distanciaMax).toBeLessThan(casa.distancia * 1.3);
  });

  it('dentro de un ambiente la órbita es corta y más cerrada que la general', () => {
    expect(dentro.azimutMax).toBeLessThan(Math.PI / 2);
    expect(dentro.elevacionMax).toBeLessThan(general.elevacionMax);
    expect(dentro.distanciaMax).toBeLessThan(general.distanciaMax);
  });

  it('el paneo dentro de un ambiente no sale de él (con holgura) ni a otro piso', () => {
    expect(dentro.caja.x0).toBeGreaterThan(ventas.x0 - 3);
    expect(dentro.caja.x1).toBeLessThan(ventas.x1 + 3);
    expect(dentro.caja.y0).toBeGreaterThanOrEqual(ventas.y);
    expect(dentro.caja.y1).toBeLessThanOrEqual(ventas.y + ventas.alto + 0.01);
  });

  it('el punto de mira de la vista general cabe en su caja de paneo', () => {
    const { x, y, z } = casa.objetivo;
    expect(x).toBeGreaterThanOrEqual(general.caja.x0);
    expect(x).toBeLessThanOrEqual(general.caja.x1);
    expect(y).toBeGreaterThanOrEqual(general.caja.y0);
    expect(y).toBeLessThanOrEqual(general.caja.y1);
    expect(z).toBeGreaterThanOrEqual(general.caja.z0);
    expect(z).toBeLessThanOrEqual(general.caja.z1);
  });
});

describe('acotarObjetivo', () => {
  const caja = { x0: -1, x1: 1, y0: 0, y1: 2, z0: -3, z1: 3 };
  const desvio = { x: 0, y: 0, z: 0 };

  it('un punto dentro no se mueve y el desvío es cero', () => {
    const p = { x: 0.5, y: 1, z: 0 };
    acotarObjetivo(p, caja, desvio);
    expect(p).toEqual({ x: 0.5, y: 1, z: 0 });
    expect(desvio).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('un punto fuera vuelve al borde y el desvío dice cuánto', () => {
    const p = { x: 5, y: -2, z: 1 };
    acotarObjetivo(p, caja, desvio);
    expect(p).toEqual({ x: 1, y: 0, z: 1 });
    expect(desvio).toEqual({ x: -4, y: 2, z: 0 });
  });
});

describe('cajaPaneo', () => {
  it('para la mansión es la caja de paneo de siempre', () => {
    expect(cajaPaneo(escenarioMansion.vistas.general)).toEqual({
      x0: -20,
      x1: 20,
      y0: 0,
      y1: 16,
      z0: -6,
      z1: 10,
    });
  });

  it('limitesOrbita usa la caja del escenario en la vista general', () => {
    const caja = cajaPaneo({ x0: -14, x1: 14, y0: 0, y1: 5, z0: -9, z1: 9 });
    expect(limitesOrbita(null, casa, null, caja).caja).toBe(caja);
  });
});
