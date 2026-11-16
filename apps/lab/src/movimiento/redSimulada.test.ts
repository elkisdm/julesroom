import { describe, expect, it } from 'vitest';
import { crearFuenteSimulada } from '@oficina/motor';
import { crearRedSimulada } from './redSimulada';

/** Avanza el mundo y la red a 60 Hz durante `segundos`. */
function correr(
  red: ReturnType<typeof crearRedSimulada>,
  base: ReturnType<typeof crearFuenteSimulada>,
  segundos: number,
) {
  const dt = 1 / 60;
  for (let t = 0; t < segundos; t += dt) {
    base.avanzar(dt);
    red.avanzar(dt);
  }
}

describe('red simulada', () => {
  it('publica la lista de personas de la fuente base', () => {
    const base = crearFuenteSimulada({ cantidad: 5, semilla: 1 });
    const red = crearRedSimulada(base, {
      hz: 10,
      retardoMs: 100,
      jitterMs: 0,
      perdida: 0,
      semilla: 1,
    });
    expect(red.personas().map((p) => p.id)).toEqual(base.personas().map((p) => p.id));
  });

  it('las posiciones cambian a saltos de 10 Hz, no cada cuadro', () => {
    const base = crearFuenteSimulada({ cantidad: 1, semilla: 2 });
    const red = crearRedSimulada(base, {
      hz: 10,
      retardoMs: 50,
      jitterMs: 0,
      perdida: 0,
      semilla: 1,
    });
    const persona = red.personas()[0]!;
    let cambios = 0;
    let anterior = `${persona.x},${persona.z}`;
    const dt = 1 / 60;
    for (let t = 0; t < 2; t += dt) {
      base.avanzar(dt);
      red.avanzar(dt);
      const ahora = `${persona.x},${persona.z}`;
      if (ahora !== anterior) cambios++;
      anterior = ahora;
    }
    expect(cambios).toBeGreaterThanOrEqual(15);
    expect(cambios).toBeLessThanOrEqual(21);
  });

  it('llega con retraso: va detrás de la posición real', () => {
    const base = crearFuenteSimulada({ cantidad: 1, semilla: 3 });
    const red = crearRedSimulada(base, {
      hz: 10,
      retardoMs: 200,
      jitterMs: 0,
      perdida: 0,
      semilla: 1,
    });
    // El mayor atraso del recorrido (en un instante dado puede estar detenida en su destino).
    let atraso = 0;
    for (let i = 0; i < 30; i++) {
      correr(red, base, 0.1);
      const real = base.personas()[0]!;
      const vista = red.personas()[0]!;
      atraso = Math.max(atraso, Math.hypot(real.x - vista.x, real.z - vista.z));
    }
    expect(atraso).toBeGreaterThan(0.1);
  });

  it('con pérdida del 50 % llegan bastantes menos actualizaciones', () => {
    const contar = (perdida: number) => {
      const base = crearFuenteSimulada({ cantidad: 1, semilla: 4 });
      const red = crearRedSimulada(base, {
        hz: 10,
        retardoMs: 50,
        jitterMs: 0,
        perdida,
        semilla: 7,
      });
      const persona = red.personas()[0]!;
      let n = 0;
      let anterior = persona.x;
      const dt = 1 / 60;
      for (let t = 0; t < 6; t += dt) {
        base.avanzar(dt);
        red.avanzar(dt);
        if (persona.x !== anterior) n++;
        anterior = persona.x;
      }
      return n;
    };
    expect(contar(0.5)).toBeLessThan(contar(0) * 0.75);
  });

  it('es determinista con la misma semilla', () => {
    const una = () => {
      const base = crearFuenteSimulada({ cantidad: 3, semilla: 5 });
      const red = crearRedSimulada(base, {
        hz: 10,
        retardoMs: 120,
        jitterMs: 40,
        perdida: 0.1,
        semilla: 9,
      });
      correr(red, base, 4);
      return red.personas().map((p) => [p.x, p.z]);
    };
    expect(una()).toEqual(una());
  });

  it('un cambio de parámetros se aplica sin recrear la red', () => {
    const base = crearFuenteSimulada({ cantidad: 1, semilla: 6 });
    const red = crearRedSimulada(base, {
      hz: 10,
      retardoMs: 50,
      jitterMs: 0,
      perdida: 0,
      semilla: 1,
    });
    red.parametros.hz = 5;
    expect(red.parametros.hz).toBe(5);
  });
});
