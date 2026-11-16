import { describe, expect, it } from 'vitest';
import { escenarioMansion } from '../escenarios/mansion';
import { sueloDe } from '../escenarios/suelo';
import { avanzarAvatar, crearAvatar, crearMando, PARAMETROS_AVATAR, RADIO_AVATAR } from './avatar';
import { crearMapaDeSuelo } from './colision';
import { conducir, crearLocomocion, PARAMETROS_LOCOMOCION } from './locomocion';
import { crearNavegacion } from './navegacion';
import {
  crearEstadoPies,
  inclinarEnPendiente,
  PARAMETROS_ESCALERA as PE,
  pendienteSuelo,
  topeVelocidadEscalera,
} from './pisada';
import { calcularCaminata, crearSalidaCaminata } from './caminata';

const DT = 1 / 60;
const suelo = sueloDe(escenarioMansion);
const mapa = crearMapaDeSuelo(suelo);
const nav = crearNavegacion(mapa, 0.25, RADIO_AVATAR);

describe('topeVelocidadEscalera', () => {
  it('en llano no hay tope; en pendiente, más lento al subir que al bajar, y más rápido corriendo', () => {
    expect(topeVelocidadEscalera(0, false)).toBe(Number.POSITIVE_INFINITY);
    expect(topeVelocidadEscalera(PE.pendienteMinima * 0.9, true)).toBe(Number.POSITIVE_INFINITY);
    expect(topeVelocidadEscalera(0.7, false)).toBe(PE.velocidadSube);
    expect(topeVelocidadEscalera(-0.7, false)).toBe(PE.velocidadBaja);
    expect(PE.velocidadSube).toBeLessThan(PE.velocidadBaja);
    expect(PE.velocidadSube).toBeLessThan(PARAMETROS_LOCOMOCION.velMax);
    expect(topeVelocidadEscalera(0.7, true)).toBe(PE.velocidadSubeCorriendo);
    expect(PE.velocidadSubeCorriendo).toBeLessThan(PARAMETROS_LOCOMOCION.velCorrer);
  });
});

describe('pendienteSuelo', () => {
  it('sube en la escalera mirando hacia arriba, baja mirando hacia abajo y es cero en llano', () => {
    // Escultórica 1–2: sube hacia −z (rumbo π). Pendiente real: 0,186 / 0,248 ≈ 0,75.
    expect(pendienteSuelo(suelo, 3.2, 0.5, Math.PI, 1.5)).toBeGreaterThan(0.5);
    expect(pendienteSuelo(suelo, 3.2, 0.5, 0, 1.5)).toBeLessThan(-0.5);
    expect(pendienteSuelo(suelo, -8, 6, 1, 0)).toBe(0);
  });
});

describe('locomoción con tope de terreno', () => {
  it('corriendo no pasa del tope; al quitarlo vuelve a acelerar', () => {
    const l = crearLocomocion(0, 0, 0);
    l.correr = true;
    l.topeVelocidad = 1.2;
    for (let i = 0; i < 120; i++) conducir(l, 0, 1, 1, PARAMETROS_LOCOMOCION, DT);
    expect(l.velocidad).toBeCloseTo(1.2, 3);
    l.topeVelocidad = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 120; i++) conducir(l, 0, 1, 1, PARAMETROS_LOCOMOCION, DT);
    expect(l.velocidad).toBeGreaterThan(4);
  });

  it('el avatar sube la escalera más lento que en llano (con el tope que le pone el terreno)', () => {
    const correr = (x: number, z: number, y: number, rumbo: number) => {
      const a = crearAvatar(x, z, rumbo, y);
      const m = crearMando();
      m.adelante = 1;
      m.correr = true;
      let maxima = 0;
      for (let i = 0; i < 60 * 3; i++) {
        a.loc.topeVelocidad = topeVelocidadEscalera(
          pendienteSuelo(suelo, a.x, a.z, a.rumbo, a.ySuelo),
          a.loc.correr,
        );
        avanzarAvatar(a, m, 0, mapa, nav, PARAMETROS_AVATAR, DT);
        // En la escalera (entre el tercer peldaño y el último) o, en llano, desde que alcanzó la carrera.
        if ((a.y > 0.5 && a.y < 3.2) || (y === 0 && x < 0 && i > 60))
          maxima = Math.max(maxima, a.velocidad);
      }
      return { maxima, y: a.y };
    };
    const escalera = correr(3.2, 4.6, 0, Math.PI);
    const llano = correr(-12, 8, 0, Math.PI);
    expect(escalera.y).toBeGreaterThan(1); // subió
    expect(escalera.maxima).toBeLessThanOrEqual(PE.velocidadSubeCorriendo + 0.05);
    expect(llano.maxima).toBeGreaterThan(4);
  });
});

describe('inclinarEnPendiente', () => {
  it('inclina hacia delante al subir y algo menos al bajar; en llano nada', () => {
    const lean = (pendiente: number) => {
      const e = crearEstadoPies();
      const c = calcularCaminata(0, 0, crearSalidaCaminata());
      const base = c.inclinacion;
      for (let i = 0; i < 120; i++) {
        c.inclinacion = base;
        inclinarEnPendiente(e, c, pendiente, DT);
      }
      e.iniciado = true;
      return c.inclinacion - base;
    };
    expect(lean(0)).toBe(0);
    expect(lean(0.75)).toBeCloseTo(PE.inclinacionSube, 2);
    expect(lean(-0.75)).toBeCloseTo(PE.inclinacionBaja, 2);
    expect(lean(0.75)).toBeGreaterThan(lean(-0.75));
  });
});
