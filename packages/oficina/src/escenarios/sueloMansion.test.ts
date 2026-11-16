import { describe, expect, it } from 'vitest';
import { crearMapaDeSuelo, puntoLibre } from '../animacion/colision';
import { NIVEL_Y, plano } from '../mansion/plano';
import { peldanos } from '../render/casa/arquitectura';
import { escenarioMansion } from './mansion';
import { alturaEn, CONTRAHUELLA_MAX, SIN_SUELO, sueloDe } from './suelo';
import { CONTRAHUELLA_MAX as CONTRAHUELLA_DIBUJO } from '../render/casa/arquitectura';

const suelo = sueloDe(escenarioMansion);
const mapa = crearMapaDeSuelo(suelo);
const R = 0.3;

describe('suelo de la mansión: losas', () => {
  it.each([
    ['atrio', 0, -3, NIVEL_Y.piso1],
    ['gimnasio', -13, 2, NIVEL_Y.piso1],
    ['terraza', -14, 6, NIVEL_Y.piso1],
    ['finanzas', -10, 2, NIVEL_Y.piso2],
    ['pasarela', 0, -3.25, NIVEL_Y.piso2],
    ['ventas', 10, 2.5, NIVEL_Y.piso2],
    ['rellano', 0, 0, NIVEL_Y.piso3],
    ['desarrollo', -12, 3, NIVEL_Y.piso3],
    ['observatorio', -1, -2, NIVEL_Y.torre],
    ['azotea al este', 10, 0, NIVEL_Y.torre],
    ['azotea frente a la torre', 0, 3, NIVEL_Y.torre],
  ])('%s: la losa de su nivel', (_, x, z, y) => {
    expect(alturaEn(suelo, x, z, y)).toBe(y);
  });

  it('el atrio es un vacío en el piso 2: desde ahí se caería al piso 1', () => {
    expect(alturaEn(suelo, 0, 0, NIVEL_Y.piso2)).toBe(NIVEL_Y.piso1);
  });

  it('el hueco de la escalera 2–3 en el piso 3 deja ver el peldaño de abajo (caída)', () => {
    const h = alturaEn(suelo, -3.2, 1, NIVEL_Y.piso3);
    expect(h).toBeLessThan(NIVEL_Y.piso3 - 0.5);
    expect(h).toBeGreaterThan(NIVEL_Y.piso2);
  });

  it('la piscina no es pisable (no hay piso) y su borde bloquea; el deck sí se camina', () => {
    expect(alturaEn(suelo, 0, 6.5, 0)).toBe(SIN_SUELO);
    expect(puntoLibre(mapa, 0, 6.5, R, 0)).toBe(false);
    expect(puntoLibre(mapa, 0, 6.5, R, 1.2)).toBe(false);
    expect(puntoLibre(mapa, 0, 4.4, R, 0)).toBe(true);
  });
});

describe('suelo de la mansión: escaleras', () => {
  it('usa la misma contrahuella máxima que el dibujo', () => {
    expect(CONTRAHUELLA_MAX).toBe(CONTRAHUELLA_DIBUJO);
  });

  it.each(plano.escaleras.map((e) => [e.id, e] as const))(
    '%s: en cada peldaño del dibujo, alturaEn es la altura de ese peldaño',
    (_, e) => {
      const lista = peldanos(e);
      expect(lista.length).toBeGreaterThan(10);
      for (const p of lista) {
        // Los pies vienen del peldaño anterior (un poco más abajo).
        expect(alturaEn(suelo, p.x, p.z, p.y - 0.15), `${e.id} y ${p.y}`).toBeCloseTo(p.y, 9);
      }
    },
  );

  it('desde un peldaño, el siguiente se sube caminando y el de dos más arriba no', () => {
    const lista = peldanos(plano.escaleras[0]!);
    const [a, b, c] = [lista[5]!, lista[6]!, lista[7]!];
    expect(alturaEn(suelo, b.x, b.z, a.y)).toBeCloseTo(b.y, 9);
    expect(c.y - a.y).toBeGreaterThan(suelo.paso);
    expect(alturaEn(suelo, c.x, c.z, a.y)).toBeLessThan(c.y);
  });

  it('la baranda de la escultórica 1–2 bloquea a cualquier altura del tramo (lado del atrio)', () => {
    const lista = peldanos(plano.escaleras[0]!);
    const t = plano.escaleras[0]!.tramos[0]!;
    const borde = t.desde.x - t.ancho / 2;
    for (const p of lista) {
      expect(puntoLibre(mapa, p.x, p.z, R, p.y), `sobre el peldaño ${p.y}`).toBe(true);
      expect(puntoLibre(mapa, borde - 0.05, p.z, R, p.y), `baranda ${p.y}`).toBe(false);
    }
  });

  it('caracol: la columna y los balaustres contienen el cuerpo; la salida a la torre queda abierta', () => {
    const lista = peldanos(plano.escaleras[2]!);
    const s0 = lista[0]!.sector!;
    for (const p of lista.slice(0, -3)) {
      const medio = (p.sector!.desde + p.sector!.hasta) / 2;
      const punto = (r: number) =>
        [s0.cx + r * Math.cos(medio), s0.cz + r * Math.sin(medio)] as const;
      expect(puntoLibre(mapa, ...punto(0.55), R, p.y), `línea de paso ${p.y}`).toBe(true);
      expect(puntoLibre(mapa, ...punto(0.85), R, p.y), `balaustre ${p.y}`).toBe(false);
      expect(puntoLibre(mapa, ...punto(0.2), R, p.y), `columna ${p.y}`).toBe(false);
    }
    // Del último peldaño se sale al oeste, a la losa de la torre.
    expect(puntoLibre(mapa, 1.6, 0.4, R, NIVEL_Y.torre)).toBe(true);
    expect(alturaEn(suelo, 1.6, 0.4, NIVEL_Y.torre)).toBe(NIVEL_Y.torre);
  });
});

describe('suelo de la mansión: bordes de seguridad', () => {
  it('no se sale por el frente abierto de una planta alta ni al vacío del atrio', () => {
    expect(puntoLibre(mapa, -10, 4.4, R, NIVEL_Y.piso2)).toBe(false);
    expect(puntoLibre(mapa, -10, 3.5, R, NIVEL_Y.piso2)).toBe(true);
    expect(puntoLibre(mapa, 0, 0, R, NIVEL_Y.piso2)).toBe(false);
    expect(puntoLibre(mapa, 0, -3.25, R, NIVEL_Y.piso2)).toBe(true);
    expect(puntoLibre(mapa, 10, 4.4, R, NIVEL_Y.torre)).toBe(false);
  });

  it('en el piso 1 los bordes de arriba no estorban: el atrio se camina', () => {
    expect(puntoLibre(mapa, 0, 0, R, 0)).toBe(true);
    expect(puntoLibre(mapa, -1, 3, R, 0)).toBe(true);
  });

  it('el hueco de la 2–3 tiene borde por sus costados y queda abierto por donde llega la escalera', () => {
    expect(puntoLibre(mapa, -2.25, 1, R, NIVEL_Y.piso3)).toBe(false);
    expect(puntoLibre(mapa, -3.2, -0.4, R, NIVEL_Y.piso3)).toBe(false);
    expect(puntoLibre(mapa, -3.2, 2.9, R, NIVEL_Y.piso3)).toBe(true);
  });

  it('el sofá del living se pisa a la altura de su asiento', () => {
    expect(alturaEn(suelo, -6.9, -0.5, 0)).toBe(0);
    expect(alturaEn(suelo, -6.9, -0.5, 0.3)).toBeCloseTo(0.45, 9);
  });
});
