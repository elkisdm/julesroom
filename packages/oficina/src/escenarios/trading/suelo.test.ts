import { describe, expect, it } from 'vitest';
import { crearMapaDeSuelo, puntoLibre } from '../../animacion/colision';
import { alturaEn, sueloDe } from '../suelo';
import { escenarioTrading } from './index';
import { AULA, DESCANSO } from './plano';

const suelo = sueloDe(escenarioTrading);
const mapa = crearMapaDeSuelo(suelo);
const R = 0.3;

describe('suelo de la sala de trading', () => {
  it('la tarima del aula (0,25 m) se sube caminando desde el piso', () => {
    const t = AULA.tarima;
    expect(alturaEn(suelo, (t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2, 0)).toBeCloseTo(t.alto, 9);
    expect(puntoLibre(mapa, (t.x0 + t.x1) / 2, t.z1 - 0.05, R, 0)).toBe(true);
  });

  it('el graderío se sube grada a grada; entre filas de butacas se camina, por las butacas no', () => {
    const [, f1, f2] = AULA.filas;
    expect(alturaEn(suelo, -14, -7.4, 0)).toBeCloseTo(f1!.y, 9);
    expect(alturaEn(suelo, -14, -5.8, f1!.y)).toBeCloseTo(f2!.y, 9);
    // Desde el piso, la segunda grada (0,6) no se alcanza de un paso.
    expect(alturaEn(suelo, -14, -5.8, 0)).toBe(0);
    expect(puntoLibre(mapa, -14, -7.4, R, f1!.y)).toBe(true);
    expect(puntoLibre(mapa, AULA.butacasX[1], f1!.z, R, f1!.y)).toBe(false);
  });

  it('el sofá del descanso se alcanza solo saltando; un escritorio (mesa de puesto) es sólido', () => {
    const { x, z } = DESCANSO.sofa;
    expect(alturaEn(suelo, x, z, 0)).toBe(0);
    expect(alturaEn(suelo, x, z, 0.3)).toBeCloseTo(0.45, 9);
    expect(puntoLibre(mapa, -7.5, -8.2, R, 0)).toBe(false);
    // Un puesto de trabajo no se pisa ni se sobrevuela: bloquea hasta lo que alcanza un salto.
    expect(puntoLibre(mapa, -7.5, -8.2, R, 0.9)).toBe(false);
  });

  it('los muros y el frente abierto bloquean', () => {
    expect(puntoLibre(mapa, -10, -10, R, 0)).toBe(false);
    expect(puntoLibre(mapa, 0, 8.2, R, 0)).toBe(false);
  });
});
