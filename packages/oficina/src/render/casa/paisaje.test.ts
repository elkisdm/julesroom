import { describe, expect, it } from 'vitest';
import { TERRENO } from './arquitectura';
import { alturaLadera, cresta } from './Paisaje';

describe('cresta (silueta de la cordillera en 360°)', () => {
  it('es periódica: al dar la vuelta completa no hay costura', () => {
    for (const semilla of [1.3, 2.7, 4.1]) {
      expect(cresta(2 * Math.PI, semilla)).toBeCloseTo(cresta(0, semilla), 9);
      expect(cresta(2 * Math.PI + 0.37, semilla)).toBeCloseTo(cresta(0.37, semilla), 9);
    }
  });

  it('es irregular: muchos picos de alturas distintas, no un serrucho', () => {
    const muestras = Array.from({ length: 3600 }, (_, i) => cresta((2 * Math.PI * i) / 3600, 1.3));
    const picos = muestras.filter(
      (v, i) =>
        v > (muestras[(i + 3599) % 3600] as number) && v > (muestras[(i + 1) % 3600] as number),
    );
    expect(picos.length).toBeGreaterThan(40);
    const alto = Math.max(...picos);
    const bajo = Math.min(...picos);
    expect(alto - bajo).toBeGreaterThan(0.3);
  });

  it('los Andes (norte y este) son más altos que los cerros del sur', () => {
    const media = (desde: number, hasta: number) => {
      let suma = 0;
      for (let i = 0; i < 200; i++) suma += cresta(desde + ((hasta - desde) * i) / 200, 1.3);
      return suma / 200;
    };
    expect(media(0, Math.PI / 2)).toBeGreaterThan(media(Math.PI, 1.5 * Math.PI) * 1.3);
  });
});

describe('alturaLadera (el cerro bajo la maqueta)', () => {
  it('nace justo sobre el pie de la maqueta, bajo el corte', () => {
    expect(alturaLadera(0, 0, 1)).toBeGreaterThan(TERRENO.fondo);
    expect(alturaLadera(0, 0, 1)).toBeLessThan(TERRENO.fondo + 0.5);
  });

  it('baja hacia el valle en todas las direcciones', () => {
    for (let k = 0; k < 16; k++) {
      const t = (2 * Math.PI * k) / 16;
      expect(alturaLadera(120, Math.sin(t), Math.cos(t))).toBeLessThan(TERRENO.fondo - 20);
    }
  });

  it('cae más rápido hacia el frente (el valle, +z) que hacia el fondo', () => {
    // Promedio de un sector de 60° y varias distancias: las lomas no deciden el resultado.
    const sector = (centro: number) => {
      let suma = 0;
      let n = 0;
      for (let k = -10; k <= 10; k++) {
        const t = centro + (k / 10) * (Math.PI / 6);
        for (const d of [40, 60, 80, 100, 120]) {
          suma += alturaLadera(d, Math.sin(t), Math.cos(t));
          n++;
        }
      }
      return suma / n;
    };
    expect(sector(0)).toBeLessThan(sector(Math.PI) - 15);
  });
});
