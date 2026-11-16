import { describe, expect, it } from 'vitest';
import { AMPLITUD_CADERA, frecuenciaPaso, piernaEnFase as piernaEnFaseEn } from './marcha';

const LARGO_PIERNA = 0.62;
const piernaEnFase = (fase: number, velocidad: number) =>
  piernaEnFaseEn(fase, velocidad, { cadera: 0, rodilla: 0 });

describe('piernaEnFase', () => {
  it('en apoyo la rodilla es ~0 y en balanceo es > 0', () => {
    // fase 0: coseno = 1 -> pleno balanceo; fase pi: pleno apoyo
    expect(piernaEnFase(0, 1).rodilla).toBeGreaterThan(0.3);
    expect(piernaEnFase(Math.PI, 1).rodilla).toBeCloseTo(0, 6);
    for (let i = 0; i < 100; i++) {
      const fase = Math.PI / 2 + 0.01 + (i / 100) * (Math.PI - 0.02);
      expect(piernaEnFase(fase, 1).rodilla).toBe(0);
    }
  });

  it('la cadera oscila dentro de la amplitud y adelanta (negativa) durante el balanceo', () => {
    expect(Math.abs(piernaEnFase(Math.PI / 2, 1).cadera)).toBeCloseTo(AMPLITUD_CADERA, 6);
    const medioBalanceo = piernaEnFase(-0.3, 1).cadera; // balanceo hacia delante
    expect(medioBalanceo).toBeGreaterThan(-AMPLITUD_CADERA - 1e-9);
    expect(piernaEnFase(0.4, 1).cadera).toBeLessThan(0);
  });

  it('velocidad 0 deja la pierna recta', () => {
    const pierna = piernaEnFase(1.3, 0);
    expect(pierna.cadera).toBeCloseTo(0, 9);
    expect(pierna.rodilla).toBeCloseTo(0, 9);
  });
});

describe('piernaEnFase sin asignaciones', () => {
  it('escribe en el objeto de salida y lo devuelve', () => {
    const salida = { cadera: 9, rodilla: 9 };
    expect(piernaEnFaseEn(0.5, 1, salida)).toBe(salida);
    expect(salida).toEqual(piernaEnFase(0.5, 1));
  });
});

describe('frecuenciaPaso', () => {
  it('el pie de apoyo no desliza: su desplazamiento por el tiempo de apoyo iguala la velocidad', () => {
    const v = 1.15;
    const w = frecuenciaPaso(v, LARGO_PIERNA);
    const pie = (fase: number) => -LARGO_PIERNA * Math.sin(piernaEnFase(fase, 1).cadera);
    // apoyo: de pi/2 a 3pi/2 (el pie retrocede respecto de la cadera)
    const desplazamiento = pie(Math.PI / 2) - pie((3 * Math.PI) / 2);
    const tiempoApoyo = Math.PI / w;
    expect(desplazamiento / tiempoApoyo).toBeCloseTo(v, 3);
  });

  it('crece con la velocidad', () => {
    expect(frecuenciaPaso(2, LARGO_PIERNA)).toBeGreaterThan(frecuenciaPaso(1, LARGO_PIERNA));
  });
});
