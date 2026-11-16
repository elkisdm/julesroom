import { describe, expect, it } from 'vitest';
import { alturaEn, crearSuelo, peldanosRectos } from '../escenarios/suelo';
import type { DatosSuelo } from '../escenarios/tipos';
import { crearMapaDeSuelo, lineaLibre, moverConColision, puntoLibre, RADIO_PIE } from './colision';

const R = 0.3;

/**
 * Sala 10 × 10 (piso 0), una losa alta (y 3) en z ≥ 6 con su muro en x = 2 que va de 3 a 6,6, una tarima
 * de 0,25, un sofá pisable de 0,45, un escritorio no pisable de 0,74 y una escalera recta de 0 a 3 a lo
 * largo de z (x 8..9, z 1..5) con baranda al oeste.
 */
function datos(): DatosSuelo {
  return {
    limites: { x0: 0, x1: 10, z0: 0, z1: 10 },
    superficies: [
      { id: 'piso', tipo: 'losa', forma: 'caja', x0: 0, x1: 10, z0: 0, z1: 10, y: 0, grosor: 0.3 },
      { id: 'alta', tipo: 'losa', forma: 'caja', x0: 0, x1: 7, z0: 6, z1: 10, y: 3, grosor: 0.3 },
      {
        id: 'tarima',
        tipo: 'tarima',
        forma: 'caja',
        x0: 1,
        x1: 3,
        z0: 1,
        z1: 3,
        y: 0.25,
        grosor: 0.25,
      },
      {
        id: 'sofa',
        tipo: 'mueble',
        forma: 'caja',
        x0: 4,
        x1: 6,
        z0: 1,
        z1: 2,
        y: 0.45,
        grosor: 0.45,
      },
      ...peldanosRectos('esc', {
        desde: { x: 8.5, y: 0, z: 1 },
        hasta: { x: 8.5, y: 3, z: 5 },
        ancho: 1,
      }),
    ],
    solidos: [
      { id: 'muro-alto', tipo: 'muro', x0: 1.9, x1: 2.1, z0: 6, z1: 10, y0: 3, y1: 6.6 },
      { id: 'escritorio', tipo: 'mueble', x0: 4, x1: 6, z0: 3.5, z1: 4.5, y0: 0, y1: 0.74 },
      { id: 'baranda', tipo: 'baranda', x0: 7.95, x1: 8, z0: 1, z1: 5, y0: 0, y1: 4 },
    ],
  };
}

const suelo = crearSuelo(datos());
const mapa = crearMapaDeSuelo(suelo);

describe('colisión según la altura', () => {
  it('un muro de la planta alta no bloquea a quien camina abajo, y sí a quien está arriba', () => {
    expect(puntoLibre(mapa, 2, 8, R, 0)).toBe(true);
    expect(puntoLibre(mapa, 2, 8, R, 3)).toBe(false);
  });

  it('el escritorio bloquea en el piso, pero no a quien pasa por encima de su tapa (saltando)', () => {
    expect(puntoLibre(mapa, 5, 4, R, 0)).toBe(false);
    expect(puntoLibre(mapa, 5, 4, R, 0.8)).toBe(true);
  });

  it('un mueble pisable a más de un paso bloquea con el radio del pie; a menos de un paso, se pisa', () => {
    expect(puntoLibre(mapa, 5, 1.5, R, 0)).toBe(false);
    // El cuerpo puede rozar el sofá: solo el pie (radio menor) choca con su cara.
    expect(puntoLibre(mapa, 5, 2 + RADIO_PIE + 0.02, R, 0)).toBe(true);
    expect(puntoLibre(mapa, 5, 1.5, R, 0.2)).toBe(true);
    // La tarima (0,25) está a menos de un paso: no bloquea.
    expect(puntoLibre(mapa, 2, 2, R, 0)).toBe(true);
  });

  it('la escalera no es un sólido para quien está en ella, pero su baranda sí', () => {
    for (let z = 1.1; z < 5; z += 0.1) {
      // Los pies sobre el peldaño que queda bajo el centro.
      const y = alturaEn(suelo, 8.5, z, ((z - 1) / 4) * 3);
      expect(puntoLibre(mapa, 8.5, z, R, y), `z ${z}`).toBe(true);
      expect(puntoLibre(mapa, 8.1, z, R, y), `baranda z ${z}`).toBe(false);
    }
  });

  it('desde el piso, la parte alta de la escalera es un techo (se pasa por debajo) y la media corta el paso', () => {
    expect(puntoLibre(mapa, 8.5, 4.8, R, 0)).toBe(true);
    expect(puntoLibre(mapa, 8.5, 3, R, 0)).toBe(false);
  });

  it('sin altura (NaN) todo bloquea: es el mapa conservador', () => {
    expect(puntoLibre(mapa, 2, 8, R)).toBe(false);
  });

  it('moverConColision a una altura dada desliza por lo que bloquea a esa altura', () => {
    const s = { x: 0, z: 0 };
    moverConColision(mapa, 3, 8, -2, 0, R, s, 0);
    expect(s.x).toBeCloseTo(1, 9);
    moverConColision(mapa, 3, 8, -2, 0, R, s, 3);
    expect(s.x).toBeGreaterThanOrEqual(2.1 + R - 1e-6);
  });

  it('lineaLibre con altura', () => {
    expect(lineaLibre(mapa, 3, 8, 1, 8, R, 0)).toBe(true);
    expect(lineaLibre(mapa, 3, 8, 1, 8, R, 3)).toBe(false);
  });

  it('fuera de los límites bloquea a cualquier altura', () => {
    expect(puntoLibre(mapa, -1, 5, R, 0)).toBe(false);
    expect(puntoLibre(mapa, -1, 5, R, 100)).toBe(false);
    expect(puntoLibre(mapa, 5, 11, R, -100)).toBe(false);
  });
});
