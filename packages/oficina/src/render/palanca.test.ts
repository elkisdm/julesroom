import { describe, expect, it } from 'vitest';
import { crearMando, PARAMETROS_AVATAR } from '../animacion/avatar';
import { escribirPalanca } from './entradaAvatar';

const velocidad = (m: ReturnType<typeof crearMando>) =>
  Math.hypot(m.adelante, m.lateral) *
  (m.correr ? PARAMETROS_AVATAR.velCorrer : PARAMETROS_AVATAR.velMax);

describe('palanca con respuesta continua', () => {
  it('ignora el temblor del centro y soltar limpia los ejes y carrera', () => {
    const m = crearMando();
    escribirPalanca(0.05, -0.05, m);
    expect(velocidad(m)).toBe(0);
    escribirPalanca(1, 0, m);
    expect(m.correr).toBe(true);
    escribirPalanca(0, 0, m);
    expect([m.lateral, m.adelante, m.correr]).toEqual([0, 0, false]);
  });

  it('camina a media palanca y corre al fondo conservando la dirección', () => {
    const m = crearMando();
    escribirPalanca(0, -0.5, m);
    expect(m.correr).toBe(false);
    expect(velocidad(m)).toBeGreaterThan(0);
    expect(velocidad(m)).toBeLessThan(PARAMETROS_AVATAR.velMax);
    escribirPalanca(1, -1, m);
    expect(velocidad(m)).toBeCloseTo(PARAMETROS_AVATAR.velCorrer, 8);
    expect(m.adelante).toBe(m.lateral);
  });

  it('no tiene salto de velocidad al pasar de caminar a correr', () => {
    const m = crearMando();
    let previa = 0;
    for (let r = 0; r <= 1; r += 0.001) {
      escribirPalanca(r, 0, m);
      const v = velocidad(m);
      expect(v).toBeGreaterThanOrEqual(previa);
      expect(v - previa).toBeLessThan(0.02);
      previa = v;
    }
  });
});
