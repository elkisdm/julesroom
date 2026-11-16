import { describe, expect, it } from 'vitest';
import { escenarioMansion } from '../escenarios/mansion';
import { escenarioTrading } from '../escenarios/trading';
import { alturaEn, sueloDe } from '../escenarios/suelo';
import { NIVEL_Y, plano } from '../mansion/plano';
import { crearMapaDeSuelo, puntoLibre } from './colision';
import { buscarRuta, crearNavegacion } from './navegacion';

const R = 0.3;
const MAX = 64;
const suelo = sueloDe(escenarioMansion);
const mapa = crearMapaDeSuelo(suelo);
const nav = crearNavegacion(mapa, 0.25, R);

/**
 * Recorre la ruta como lo haría el cuerpo (muestras de 5 cm siguiendo la altura con `alturaEn`) y
 * devuelve las alturas por las que pasa, o `null` si en algún punto choca o cae más de un paso.
 */
function recorrer(x0: number, z0: number, y0: number, ruta: Float64Array, n: number) {
  let x = x0;
  let z = z0;
  let y = y0;
  const alturas = [y];
  for (let i = 0; i < n; i++) {
    const nx = ruta[i * 2]!;
    const nz = ruta[i * 2 + 1]!;
    const pasos = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 0.05));
    for (let k = 1; k <= pasos; k++) {
      const px = x + ((nx - x) * k) / pasos;
      const pz = z + ((nz - z) * k) / pasos;
      const h = alturaEn(suelo, px, pz, y);
      if (h < y - suelo.paso) return null;
      if (!puntoLibre(mapa, px, pz, R - 0.03, h)) return null;
      y = h;
      alturas.push(y);
    }
    x = nx;
    z = nz;
  }
  return alturas;
}

function ruta(x0: number, z0: number, y0: number, x1: number, z1: number, y1: number) {
  const r = new Float64Array(MAX * 2);
  const n = buscarRuta(nav, x0, z0, x1, z1, r, MAX, y0, y1);
  return { n, r };
}

describe('navegación en varios niveles (mansión)', () => {
  it('de la cocina (piso 1) a finanzas (piso 2): sube por la escultórica 1–2', () => {
    const { n, r } = ruta(12, 0, 0, -10, 2, NIVEL_Y.piso2);
    expect(n).toBeGreaterThan(1);
    expect(r[(n - 1) * 2]).toBeCloseTo(-10, 6);
    const alturas = recorrer(12, 0, 0, r, n);
    expect(alturas).not.toBeNull();
    expect(alturas![alturas!.length - 1]).toBeCloseTo(NIVEL_Y.piso2, 6);
    // Pasa por la escalera: algún punto de la ruta queda sobre su huella.
    const t = plano.escaleras[0]!.tramos[0]!;
    let porEscalera = false;
    for (let i = 0; i < n; i++) {
      if (Math.abs(r[i * 2]! - t.desde.x) < t.ancho / 2 && r[i * 2 + 1]! < t.desde.z)
        porEscalera = true;
    }
    expect(porEscalera).toBe(true);
  });

  it('del atrio al rellano del piso 3: dos escaleras, sin caídas', () => {
    const { n, r } = ruta(0, 2, 0, 0, 0, NIVEL_Y.piso3);
    const alturas = recorrer(0, 2, 0, r, n);
    expect(alturas).not.toBeNull();
    expect(alturas![alturas!.length - 1]).toBeCloseTo(NIVEL_Y.piso3, 6);
    expect(Math.max(...alturas!)).toBeLessThanOrEqual(NIVEL_Y.piso3 + 1e-6);
  });

  it('del rellano a la azotea por el caracol', () => {
    const { n, r } = ruta(0, 0, NIVEL_Y.piso3, 10, 0, NIVEL_Y.torre);
    const alturas = recorrer(0, 0, NIVEL_Y.piso3, r, n);
    expect(alturas).not.toBeNull();
    expect(alturas![alturas!.length - 1]).toBeCloseTo(NIVEL_Y.torre, 6);
  });

  it('y de vuelta: de la torre al piso 1', () => {
    const { n, r } = ruta(-1, -2, NIVEL_Y.torre, 12, 0, 0);
    const alturas = recorrer(-1, -2, NIVEL_Y.torre, r, n);
    expect(alturas).not.toBeNull();
    expect(alturas![alturas!.length - 1]).toBeCloseTo(0, 6);
  });

  it('en el mismo piso conserva el suavizado por línea de vista (un solo punto en recta libre)', () => {
    const { n, r } = ruta(-5, -3, 0, -5, 2, 0);
    expect(n).toBe(1);
    expect(r[0]).toBeCloseTo(-5, 9);
    expect(r[1]).toBeCloseTo(2, 9);
  });

  it('sin altura del destino, elige el piso más cercano al de quien camina', () => {
    // (0, -3.25) es la pasarela en el piso 2 y el atrio en el piso 1: desde el piso 2 se queda arriba.
    const r = new Float64Array(MAX * 2);
    const n = buscarRuta(nav, -10, 2, 0, -3.25, r, MAX, NIVEL_Y.piso2);
    const alturas = recorrer(-10, 2, NIVEL_Y.piso2, r, n);
    expect(alturas).not.toBeNull();
    expect(Math.min(...alturas!)).toBeCloseTo(NIVEL_Y.piso2, 6);
  });
});

describe('navegación en trading', () => {
  it('sube a la tarima del aula caminando', () => {
    const s = sueloDe(escenarioTrading);
    const m = crearMapaDeSuelo(s);
    const n2 = crearNavegacion(m, 0.25, R);
    const r = new Float64Array(MAX * 2);
    const n = buscarRuta(n2, 4.5, 6.8, -13, -12.2, r, MAX, 0, 0.25);
    expect(n).toBeGreaterThan(0);
    expect(alturaEn(s, r[(n - 1) * 2]!, r[(n - 1) * 2 + 1]!, 0)).toBeCloseTo(0.25, 9);
  });
});
