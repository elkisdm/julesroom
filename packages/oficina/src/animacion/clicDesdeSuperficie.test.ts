import { afterEach, describe, expect, it } from 'vitest';
import { cajaDe } from '../mansion/plano';
import type { Caja, Mueble } from '../mansion/plano';
import { crearSuelo, sueloPlano } from '../escenarios/suelo';
import { avanzarAvatar, crearAvatar, crearMando, fijarDestino, PARAMETROS_AVATAR } from './avatar';
import type { Avatar, Mando } from './avatar';
import { crearMapaDeSuelo, puntoLibre } from './colision';
import { crearNavegacion } from './navegacion';
import { encenderTodo } from './opciones';

const DT = 1 / 60;
const R = 0.3;
const LIMITES: Caja = { x0: 0, x1: 14, z0: 0, z1: 14 };

const mueble = (id: string, o: Partial<Mueble> & Pick<Mueble, 'x' | 'z'>): Mueble => ({
  tipo: 'mesa',
  ambiente: 'sala',
  y: 0,
  ancho: 1.6,
  fondo: 0.8,
  alto: 0.74,
  giro: 0,
  conjunto: id,
  id,
  ...o,
});

function mundo(muebles: Mueble[]) {
  const cajas = muebles.map((m) => cajaDe(m));
  const suelo = crearSuelo(sueloPlano({ cajas, limites: LIMITES }, 0, muebles));
  const mapa = crearMapaDeSuelo(suelo);
  return { suelo, mapa, nav: crearNavegacion(mapa, 0.25, R) };
}

/** Un avatar de pie sobre la tapa de la mesa, en su centro. */
function arribaDe(mesa: Mueble): { a: Avatar; m: Mando } {
  const a = crearAvatar(mesa.x, mesa.z, Math.PI, 0);
  a.y = mesa.alto;
  a.ySuelo = mesa.alto;
  return { a, m: crearMando() };
}

/** Camina hasta 8 s y devuelve el mínimo de la distancia al destino y los cuadros dentro de un sólido. */
function ir(w: ReturnType<typeof mundo>, a: Avatar, m: Mando, x: number, z: number, y: number) {
  fijarDestino(m, x, z, false, y);
  let dentro = 0;
  let minimo = Infinity;
  for (let i = 0; i < 8 * 60; i++) {
    avanzarAvatar(a, m, 0, w.mapa, w.nav, PARAMETROS_AVATAR, DT);
    minimo = Math.min(minimo, Math.hypot(a.x - x, a.z - z));
    if (!puntoLibre(w.mapa, a.x, a.z, R * 0.9, a.y)) dentro++;
  }
  return { minimo, dentro };
}

afterEach(() => encenderTodo());

describe('clic para caminar estando sobre un mueble', () => {
  const mesa = mueble('mesa', { x: 6, z: 6 });

  it('a un punto del piso: camina hasta el borde, baja y llega', () => {
    const w = mundo([mesa]);
    const { a, m } = arribaDe(mesa);
    const r = ir(w, a, m, 6, 9, 0);
    expect(r.minimo).toBeLessThan(0.15);
    expect(a.y).toBeCloseTo(0, 6);
    expect(a.enSuelo).toBe(true);
    expect(r.dentro).toBe(0);
  });

  it('a otro punto de la misma superficie: camina sobre ella sin bajar', () => {
    const w = mundo([mesa]);
    const { a, m } = arribaDe(mesa);
    const r = ir(w, a, m, 6.5, 6, mesa.alto);
    expect(r.minimo).toBeLessThan(0.15);
    expect(a.y).toBeCloseTo(mesa.alto, 6);
  });

  it('a otra mesa pisable no sube solo: va al piso junto a ella', () => {
    const otra = mueble('otra', { x: 6, z: 9 });
    const w = mundo([mesa, otra]);
    const { a, m } = arribaDe(mesa);
    const r = ir(w, a, m, 6, 9, otra.alto);
    expect(a.y).toBeCloseTo(0, 6);
    expect(a.z).toBeGreaterThan(cajaDe(otra).z1 - 0.01);
    expect(Math.hypot(a.x - 6, a.z - 9)).toBeLessThan(1.5);
    expect(r.dentro).toBe(0);
  });

  it('desde el piso, un clic sobre una mesa no la sube: va al piso más cercano', () => {
    const w = mundo([mesa]);
    const a = crearAvatar(6, 10, Math.PI, 0);
    const m = crearMando();
    ir(w, a, m, 6, 6, mesa.alto);
    expect(a.y).toBeCloseTo(0, 6);
    expect(Math.hypot(a.x - 6, a.z - 6)).toBeLessThan(1.5);
  });

  it('un destino dentro de una mesa baja (sin altura) lleva al piso junto a ella, no se queda quieto', () => {
    const baja = mueble('baja', { x: 6, z: 6, alto: 0.4 });
    const w = mundo([baja]);
    const a = crearAvatar(6, 10, Math.PI, 0);
    const m = crearMando();
    const r = ir(w, a, m, 6, 6, Number.NaN);
    expect(a.y).toBeCloseTo(0, 6);
    expect(Math.hypot(a.x - 6, a.z - 6)).toBeLessThan(1.5);
    expect(r.dentro).toBe(0);
  });
});
