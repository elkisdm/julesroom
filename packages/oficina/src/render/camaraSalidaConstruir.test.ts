import { describe, expect, it } from 'vitest';
import { escenarioTrading } from '../escenarios/trading';
import { avanzarSeguimiento, crearSeguimiento } from './camara';
import type { EntradaSeguimiento } from './camara';
import { cajasDeLaCasa } from './visual';

const DT = 1 / 60;

/**
 * Al salir del modo construir la cámara vuelve desde la vista general (lejos) al seguimiento.
 * Junto a una columna el rodeo se activa en ese mismo momento: el tope de rapidez de la distancia
 * (pensado para que el brazo no bombee durante el rodeo) no debe frenar ese acercamiento.
 */
describe('volver de construir junto a una columna', () => {
  const simular = (cajas: EntradaSeguimiento['cajas'], segundos: number) => {
    const v = escenarioTrading.vistas.seguir;
    const e: EntradaSeguimiento = {
      dt: DT,
      // Justo detrás de la columna derecha (10; −1,2), con la cámara del lado +z.
      x: 10,
      y: 0,
      z: -1.95,
      adelante: 0,
      lateral: 0,
      azimut: 0,
      elevacion: (v.elevacion * Math.PI) / 180,
      orbitando: false,
      distanciaActual: 53,
      cajas,
    };
    const s = crearSeguimiento();
    for (let i = 0; i < Math.round(segundos / DT); i++) {
      avanzarSeguimiento(s, e);
      e.azimut = s.azimut;
      e.distanciaActual = s.distancia;
    }
    return s;
  };

  it('se acerca igual de rápido que sin la columna, y además la rodea', () => {
    const columnas = cajasDeLaCasa(escenarioTrading.planta);
    const libre = simular([], 2);
    const conColumna = simular(columnas, 2);
    expect(Math.abs(conColumna.azimut)).toBeGreaterThan(0.3);
    expect(conColumna.distancia).toBeLessThan(libre.distancia + 1);
  });
});
