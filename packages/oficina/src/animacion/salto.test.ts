import { describe, expect, it } from 'vitest';
import {
  PARAMETROS_SALTO as P,
  aterrizar,
  avanzarSalto,
  caer,
  crearSalto,
  despegar,
  gravedadSalto,
  pedirSalto,
} from './salto';

const DT = 1 / 60;

function simular(pasos: number, dt = DT) {
  const s = crearSalto();
  pedirSalto(s);
  let maxY = 0;
  let aire = 0;
  for (let k = 0; k < pasos; k++) {
    avanzarSalto(s, P, dt);
    if (s.fase === 'aire') aire += dt;
    maxY = Math.max(maxY, s.y);
  }
  return { s, maxY, aire };
}

describe('salto', () => {
  it('alcanza la altura pedida y dura el tiempo en el aire pedido', () => {
    const { maxY, aire, s } = simular(120);
    expect(maxY).toBeGreaterThan(P.altura * 0.98);
    expect(maxY).toBeLessThanOrEqual(P.altura + 1e-9);
    expect(Math.abs(aire - P.tiempoAire)).toBeLessThan(2 * DT);
    expect(s.fase).toBe('suelo');
    expect(s.y).toBe(0);
    expect(s.saltos).toBe(1);
  });

  it('se agacha antes de despegar (impulso) y aterriza con impacto', () => {
    const s = crearSalto();
    pedirSalto(s);
    avanzarSalto(s, P, P.impulso / 2);
    expect(s.fase).toBe('impulso');
    expect(s.y).toBe(0);
    for (let k = 0; k < 60 && s.fase !== 'aterrizaje'; k++) avanzarSalto(s, P, DT);
    expect(s.fase).toBe('aterrizaje');
    expect(s.impacto).toBeGreaterThan(0.9);
  });

  it('no se puede saltar en el aire', () => {
    const s = crearSalto();
    despegar(s, P);
    expect(pedirSalto(s)).toBe(false);
    expect(s.fase).toBe('aire');
  });

  it('un dt enorme no atraviesa el piso ni deja NaN', () => {
    const s = crearSalto();
    pedirSalto(s);
    avanzarSalto(s, P, 5);
    expect(s.y).toBe(0);
    expect(Number.isFinite(s.vy)).toBe(true);
    expect(s.fase).toBe('suelo');
  });

  it('gravedad consistente con altura y tiempo', () => {
    const g = gravedadSalto(P);
    expect((g * (P.tiempoAire / 2) ** 2) / 2).toBeCloseTo(P.altura, 9);
  });

  it('dt 0 no cambia nada', () => {
    const s = crearSalto();
    pedirSalto(s);
    avanzarSalto(s, P, 0);
    expect(s.t).toBe(0);
  });
});

describe('salto en modo mundo (el suelo decide el aterrizaje)', () => {
  it('tras el impulso despega y sigue en el aire más allá del tiempo de un salto, sin altura propia', () => {
    const s = crearSalto();
    s.mundo = true;
    pedirSalto(s);
    for (let k = 0; k < 120; k++) avanzarSalto(s, P, DT);
    expect(s.fase).toBe('aire');
    expect(s.saltos).toBe(1);
    expect(s.y).toBe(0);
  });

  it('aterrizar pasa a aterrizaje con su impacto y luego al suelo', () => {
    const s = crearSalto();
    s.mundo = true;
    despegar(s, P);
    aterrizar(s, 0.7);
    expect(s.fase).toBe('aterrizaje');
    expect(s.impacto).toBe(0.7);
    expect(s.vy).toBe(0);
    avanzarSalto(s, P, P.aterrizaje + DT);
    expect(s.fase).toBe('suelo');
  });

  it('caer (salir de un borde) entra al aire sin contar un salto', () => {
    const s = crearSalto();
    s.mundo = true;
    caer(s);
    expect(s.fase).toBe('aire');
    expect(s.saltos).toBe(0);
    expect(pedirSalto(s)).toBe(false);
  });
});
