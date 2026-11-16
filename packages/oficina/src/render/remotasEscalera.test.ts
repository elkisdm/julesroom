import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  avanzarAvatar,
  crearAvatar,
  crearMando,
  PARAMETROS_AVATAR,
  RADIO_AVATAR,
} from '../animacion/avatar';
import { crearMapaDeSuelo } from '../animacion/colision';
import { crearNavegacion } from '../animacion/navegacion';
import { encenderTodo, fijarOpciones } from '../animacion/opciones';
import { pendienteSuelo, topeVelocidadEscalera } from '../animacion/pisada';
import { escenarioMansion } from '../escenarios/mansion';
import { sueloDe } from '../escenarios/suelo';
import { NIVEL_Y } from '../mansion/plano';
import type { PersonaPresente } from '../presencia/tipos';
import type { Rig } from './animador';
import { animarRemotas, cuerpoRemoto } from './remotas';
import { crearRigPrueba } from './rigPrueba';

vi.mock('./texturas', () => ({ celdasCara: () => [0, 1], celdaIcono: () => 0 }));

const DT = 1 / 60;
const ATUENDO = { face: 'feliz' } as unknown as PersonaPresente['atuendo'];
const suelo = sueloDe(escenarioMansion);
const mapa = crearMapaDeSuelo(suelo);
const nav = crearNavegacion(mapa, 0.25, RADIO_AVATAR);

beforeEach(() => encenderTodo());
afterEach(() => encenderTodo());

/**
 * Una persona que sube la escalera escultórica (del piso 1 a la pasarela, 3,9 m) y la ve otro cliente: la
 * `y` que envía son los pies (`a.y`: peldaño a peldaño), a 10 Hz y sin pérdida. Devuelve la altura de la raíz
 * dibujada en cada cuadro.
 */
function verSubir(conSuelo = true): {
  y: number[];
  crudo: number[];
  llega: number;
  inclinacion: number;
} {
  const a = crearAvatar(3.2, 5.6, Math.PI, 0);
  const m = crearMando();
  m.adelante = 1;
  const persona: PersonaPresente = {
    id: 'a',
    nombre: 'A',
    atuendo: ATUENDO,
    x: a.x,
    y: a.y,
    z: a.z,
    rumbo: a.rumbo,
  };
  const { rig } = crearRigPrueba();
  const rigs = new Map<string, Rig>([['a', rig]]);
  const y: number[] = [];
  const crudo: number[] = [];
  let llega = -1;
  let inclinacion = 0;
  for (let f = 0; f < 60 * 9; f++) {
    a.loc.topeVelocidad = topeVelocidadEscalera(
      pendienteSuelo(suelo, a.x, a.z, a.rumbo, a.ySuelo),
      a.loc.correr,
    );
    avanzarAvatar(a, m, 0, mapa, nav, PARAMETROS_AVATAR, DT);
    if (f % 6 === 0) {
      persona.x = a.x;
      persona.y = a.y;
      persona.z = a.z;
      persona.rumbo = a.rumbo;
    }
    const t = f * DT;
    animarRemotas({
      presentes: [persona],
      rigs,
      dt: DT,
      t,
      tAhora: t,
      dibujar: () => {},
      cuadro: f,
      suelo: conSuelo ? suelo : null,
    });
    inclinacion = Math.max(inclinacion, cuerpoRemoto(rigs, 'a')?.pies.inclinacion ?? 0);
    y.push(rig.raiz.position.y);
    crudo.push(persona.y);
    if (llega < 0 && a.y >= NIVEL_Y.piso2) llega = f;
  }
  return { y, crudo, llega, inclinacion };
}

const saltoMaximo = (y: number[]) =>
  Math.max(...y.slice(1).map((v, i) => Math.abs(v - (y[i] as number))));

describe('personas remotas que cambian de planta', () => {
  it('la altura se interpola a 10 Hz sin escalones, también al pasar de planta', () => {
    const { y, llega } = verSubir();
    expect(llega).toBeGreaterThan(60); // subió los 3,9 m
    const subida = y.slice(0, llega + 30);
    // Termina arriba y nunca retrocede: un solo movimiento continuo entre las dos plantas.
    expect(subida.at(-1)).toBeGreaterThan(NIVEL_Y.piso2 - 0.35);
    for (let i = 1; i < subida.length; i++)
      expect(subida[i]).toBeGreaterThanOrEqual((subida[i - 1] as number) - 1e-6);
    // Un peldaño mide 0,186 m: ningún cuadro (a 60 Hz) salta ni la sexta parte de eso.
    expect(saltoMaximo(subida)).toBeLessThan(0.03);
  });

  it('la `y` que llega sí da escalones de un peldaño: es lo que la interpolación evita', () => {
    const { crudo, llega } = verSubir();
    expect(saltoMaximo(crudo.slice(0, llega + 30))).toBeGreaterThan(0.15);
  });

  it('otra planta de golpe (teletransporte) no se desliza por el aire', () => {
    fijarOpciones({ snapshots: false });
    const persona: PersonaPresente = {
      id: 'a',
      nombre: 'A',
      atuendo: ATUENDO,
      x: 0,
      y: 0,
      z: 0,
      rumbo: 0,
    };
    const { rig } = crearRigPrueba();
    const rigs = new Map<string, Rig>([['a', rig]]);
    const cuadro = (f: number) =>
      animarRemotas({
        presentes: [persona],
        rigs,
        dt: DT,
        t: f * DT,
        tAhora: f * DT,
        dibujar: () => {},
        cuadro: f,
        suelo,
      });
    for (let f = 0; f < 10; f++) cuadro(f);
    persona.y = NIVEL_Y.piso3;
    cuadro(10);
    expect(rig.raiz.position.y).toBeCloseTo(NIVEL_Y.piso3, 6);
    expect(cuerpoRemoto(rigs, 'a')?.pendiente).toBe(0);
  });
});

describe('personas remotas en la escalera', () => {
  it.each([
    ['con el suelo del escenario', true],
    ['sin suelo (pendiente por la velocidad vertical)', false],
  ])('suben con el torso inclinado hacia delante, %s', (_n, conSuelo) => {
    const { inclinacion } = verSubir(conSuelo);
    expect(inclinacion).toBeGreaterThan(0.1);
    expect(inclinacion).toBeLessThan(0.25);
  });
});
