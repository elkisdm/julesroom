import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  avanzarAvatar,
  crearAvatar,
  crearMando,
  PARAMETROS_AVATAR,
  RADIO_AVATAR,
} from '../animacion/avatar';
import type { Avatar } from '../animacion/avatar';
import { crearMapaDeSuelo } from '../animacion/colision';
import { crearNavegacion } from '../animacion/navegacion';
import { encenderTodo } from '../animacion/opciones';
import { pendienteSuelo, topeVelocidadEscalera } from '../animacion/pisada';
import { escenarioMansion } from '../escenarios/mansion';
import { sueloDe } from '../escenarios/suelo';
import { NIVEL_Y } from '../mansion/plano';
import { avanzarSeguimiento, crearSeguimiento, PARAMETROS_SEGUIMIENTO } from './camara';
import type { EntradaSeguimiento } from './camara';

const DT = 1 / 60;
const suelo = sueloDe(escenarioMansion);
const mapa = crearMapaDeSuelo(suelo);
const nav = crearNavegacion(mapa, 0.25, RADIO_AVATAR);

beforeEach(() => encenderTodo());
afterEach(() => encenderTodo());

interface Registro {
  /** Altura de los pies que sigue la cámara (`ySuelo`, la de la raíz del rig). */
  ySuelo: number[];
  /** Altura del punto de mira de la cámara. */
  mira: number[];
  /** Velocidad del avatar. */
  v: number[];
}

/**
 * Sube con las teclas hacia −z (azimut 0) desde (x, z) a la altura `y`, con la cámara que sigue al avatar
 * (`avanzarSeguimiento` con la `ySuelo` suavizada, como `ControlesCamara`), y registra la altura de la mira.
 */
function subir(
  x: number,
  z: number,
  y: number,
  rumbo: number,
  segundos: number,
  correr = false,
): Registro {
  const a: Avatar = crearAvatar(x, z, rumbo, y);
  const m = crearMando();
  m.adelante = 1;
  m.correr = correr;
  const s = crearSeguimiento();
  const e: EntradaSeguimiento = {
    dt: DT,
    x,
    y,
    z,
    adelante: 1,
    lateral: 0,
    azimut: 0,
    elevacion: (25 * Math.PI) / 180,
    distanciaActual: 8,
    cajas: [],
  };
  const r: Registro = { ySuelo: [], mira: [], v: [] };
  for (let i = 0; i < Math.round(segundos / DT); i++) {
    a.loc.topeVelocidad = topeVelocidadEscalera(
      pendienteSuelo(suelo, a.x, a.z, a.rumbo, a.ySuelo),
      a.loc.correr,
    );
    avanzarAvatar(a, m, 0, mapa, nav, PARAMETROS_AVATAR, DT);
    e.x = a.x;
    e.y = a.ySuelo;
    e.z = a.z;
    avanzarSeguimiento(s, e, PARAMETROS_SEGUIMIENTO);
    r.ySuelo.push(a.ySuelo);
    r.mira.push(s.mira.y);
    r.v.push(a.velocidad);
  }
  return r;
}

/** Velocidad vertical (m/s) entre cuadros de una serie de alturas. */
const velocidadVertical = (y: number[]) => y.slice(1).map((v, i) => (v - (y[i] as number)) / DT);

describe('cámara que sigue al avatar en la escalera', () => {
  it.each([
    ['caminando', false],
    ['corriendo', true],
  ])('la altura de la mira sube con el piso sin trepidar por peldaño, %s', (_n, correr) => {
    // Escultórica 1–2 (x = 3,2): del piso a la pasarela, mirando hacia −z.
    const r = subir(3.2, 4.6, 0, Math.PI, 5, correr);
    const sube = r.ySuelo.findIndex((y) => y > 0.4);
    const llega = r.ySuelo.findIndex((y) => y > NIVEL_Y.piso2 - 0.4);
    expect(sube).toBeGreaterThan(0);
    expect(llega).toBeGreaterThan(sube + 60);
    // Tramo de subida firme (se descartan el arranque y el final).
    const desde = sube + 30;
    const hasta = llega - 30;
    const mira = r.mira.slice(desde, hasta);
    const vy = velocidadVertical(mira);
    const media = vy.reduce((s, v) => s + v, 0) / vy.length;
    expect(media).toBeGreaterThan(0.4);
    const ySuelo = velocidadVertical(r.ySuelo.slice(desde, hasta));
    const oscilacion = (v: number[]) => (Math.max(...v) - Math.min(...v)) / media;
    // La mira nunca baja mientras se sube y su velocidad vertical no oscila más del 20 % de la media…
    expect(Math.min(...vy)).toBeGreaterThanOrEqual(0);
    expect(oscilacion(vy)).toBeLessThan(0.2);
    // …mientras que el apoyo de la raíz, que va de a un peldaño, oscila muchas veces la media.
    expect(oscilacion(ySuelo)).toBeGreaterThan(2);
  });
});

describe('cámara en el salto', () => {
  it('no sigue el arco del salto: la mira queda a la altura del piso', () => {
    const a = crearAvatar(-8, 6, 0, 0);
    const m = crearMando();
    const s = crearSeguimiento();
    const e: EntradaSeguimiento = {
      dt: DT,
      x: a.x,
      y: a.ySuelo,
      z: a.z,
      adelante: 0,
      lateral: 0,
      azimut: 0,
      elevacion: (25 * Math.PI) / 180,
      distanciaActual: 8,
      cajas: [],
    };
    const paso = () => {
      avanzarAvatar(a, m, 0, mapa, nav, PARAMETROS_AVATAR, DT);
      e.y = a.ySuelo;
      avanzarSeguimiento(s, e, PARAMETROS_SEGUIMIENTO);
    };
    for (let i = 0; i < 30; i++) paso();
    const base = s.mira.y;
    m.saltos++;
    let altoCuerpo = 0;
    let desvio = 0;
    for (let i = 0; i < 90; i++) {
      paso();
      altoCuerpo = Math.max(altoCuerpo, a.yCuerpo - a.ySuelo);
      desvio = Math.max(desvio, Math.abs(s.mira.y - base));
    }
    expect(altoCuerpo).toBeGreaterThan(0.3); // sí saltó
    expect(desvio).toBeLessThan(0.01); // y la cámara no se movió
  });
});
