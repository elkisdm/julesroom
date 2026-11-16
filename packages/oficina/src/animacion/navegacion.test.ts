import { describe, expect, it } from 'vitest';
import { crearMapaColision, crearMapaDeCajas, puntoLibre } from './colision';
import { buscarRuta, crearNavegacion } from './navegacion';
import type { Navegacion } from './navegacion';

const R = 0.3;
const MAX = 128;

function ir(
  nav: Navegacion,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): { n: number; ruta: Float64Array } {
  const ruta = new Float64Array(MAX * 2);
  const n = buscarRuta(nav, x0, z0, x1, z1, ruta, MAX);
  return { n, ruta };
}

/**
 * Todos los tramos (desde el origen) están libres, comprobado por muestreo cada 2 cm con un radio
 * 3 cm menor: entre dos celdas vecinas la ruta puede rozar a lo sumo `r − √(r² − (celda/2)²)` ≈ 2,7 cm
 * dentro del círculo, y el movimiento real (`moverConColision`) lo absorbe deslizando.
 */
function tramosLibres(
  mapa: ReturnType<typeof crearMapaColision>,
  x0: number,
  z0: number,
  ruta: Float64Array,
  n: number,
): boolean {
  let x = x0;
  let z = z0;
  for (let i = 0; i < n; i++) {
    const nx = ruta[i * 2] as number;
    const nz = ruta[i * 2 + 1] as number;
    const pasos = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 0.02));
    for (let k = 1; k <= pasos; k++) {
      const t = k / pasos;
      if (!puntoLibre(mapa, x + (nx - x) * t, z + (nz - z) * t, R - 0.03)) return false;
    }
    x = nx;
    z = nz;
  }
  return true;
}

const mapa = crearMapaColision('piso1');
const nav = crearNavegacion(mapa, 0.25, R);

describe('buscarRuta', () => {
  it('en línea recta libre devuelve un solo punto: el destino', () => {
    const { n, ruta } = ir(nav, -5, -3, -5, 2);
    expect(n).toBe(1);
    expect(ruta[0]).toBeCloseTo(-5, 9);
    expect(ruta[1]).toBeCloseTo(2, 9);
  });

  it('rodea un mueble (la isla de la cocina)', () => {
    const { n, ruta } = ir(nav, 5, -0.8, 12, -0.8);
    expect(n).toBeGreaterThanOrEqual(2);
    expect(ruta[(n - 1) * 2]).toBeCloseTo(12, 9);
    expect(ruta[(n - 1) * 2 + 1]).toBeCloseTo(-0.8, 9);
    expect(tramosLibres(mapa, 5, -0.8, ruta, n)).toBe(true);
    // Un rodeo: algún punto se aparta de la línea del mueble.
    let desvio = 0;
    for (let i = 0; i < n; i++)
      desvio = Math.max(desvio, Math.abs((ruta[i * 2 + 1] as number) + 0.8));
    expect(desvio).toBeGreaterThan(0.8);
  });

  it('cruza un vano de puerta', () => {
    const { n, ruta } = ir(nav, -8, -3, -13, -3);
    expect(n).toBeGreaterThanOrEqual(2);
    expect(tramosLibres(mapa, -8, -3, ruta, n)).toBe(true);
    // Algún tramo cruza el muro x = -10 y lo hace por el vano (z entre 2.4 y 3.6).
    let x = -8;
    let z = -3;
    let cruzo = false;
    for (let i = 0; i < n; i++) {
      const nx = ruta[i * 2] as number;
      const nz = ruta[i * 2 + 1] as number;
      if (x > -10 && nx < -10) {
        const t = (x + 10) / (x - nx);
        const zc = z + (nz - z) * t;
        expect(zc).toBeGreaterThan(2.4);
        expect(zc).toBeLessThan(3.6);
        cruzo = true;
      }
      x = nx;
      z = nz;
    }
    expect(cruzo).toBe(true);
  });

  it('un destino dentro de un obstáculo se lleva al punto libre más cercano', () => {
    // Centro de la isla de la cocina.
    const { n, ruta } = ir(nav, 5, 1.5, 8.5, -0.8);
    expect(n).toBeGreaterThan(0);
    const x = ruta[(n - 1) * 2] as number;
    const z = ruta[(n - 1) * 2 + 1] as number;
    expect(puntoLibre(mapa, x, z, R)).toBe(true);
    expect(Math.hypot(x - 8.5, z + 0.8)).toBeLessThan(2.5);
    expect(tramosLibres(mapa, 5, 1.5, ruta, n)).toBe(true);
  });

  it('un destino fuera de la casa se lleva al borde libre más cercano', () => {
    const { n, ruta } = ir(nav, 0, 0, 0, 14);
    expect(n).toBeGreaterThan(0);
    expect(puntoLibre(mapa, ruta[(n - 1) * 2] as number, ruta[(n - 1) * 2 + 1] as number, R)).toBe(
      true,
    );
  });

  it('destino inalcanzable devuelve 0', () => {
    // Un cuarto cerrado de 4 muros dentro de una sala abierta.
    const cajas = [
      { x0: 5.8, x1: 8.2, z0: 5.8, z1: 6 },
      { x0: 5.8, x1: 8.2, z0: 8, z1: 8.2 },
      { x0: 5.8, x1: 6, z0: 5.8, z1: 8.2 },
      { x0: 8, x1: 8.2, z0: 5.8, z1: 8.2 },
    ];
    const m = crearMapaDeCajas(cajas, { x0: 0, x1: 14, z0: 0, z1: 14 });
    const n2 = crearNavegacion(m, 0.25, R);
    const ruta = new Float64Array(MAX * 2);
    expect(buscarRuta(n2, 1, 1, 7, 7, ruta, MAX)).toBe(0);
    expect(buscarRuta(n2, 1, 1, 12, 12, ruta, MAX)).toBeGreaterThan(0);
  });

  it('la ruta suavizada nunca atraviesa obstáculos (rutas de la casa entera)', () => {
    const puntos: [number, number][] = [
      [-14, -2],
      [-8, 2],
      [-8, -3],
      [0, 0],
      [0, 6],
      [2, -3],
      [12, 2],
      [14.5, -3],
      [-15, 8],
      [15, 9],
    ];
    for (const [ax, az] of puntos) {
      for (const [bx, bz] of puntos) {
        if (!puntoLibre(mapa, ax, az, R)) continue;
        const { n, ruta } = ir(nav, ax, az, bx, bz);
        expect(n, `${ax},${az} → ${bx},${bz}`).toBeGreaterThan(0);
        expect(tramosLibres(mapa, ax, az, ruta, n), `${ax},${az} → ${bx},${bz}`).toBe(true);
      }
    }
  });

  it('respeta maxPuntos', () => {
    const ruta = new Float64Array(4);
    const n = buscarRuta(nav, -14, 3, 14.5, -3, ruta, 2);
    expect(n).toBeLessThanOrEqual(2);
  });

  it('origen y destino en la misma celda', () => {
    const { n, ruta } = ir(nav, -5, -3, -5.05, -3);
    expect(n).toBe(1);
    expect(ruta[0]).toBeCloseTo(-5.05, 9);
  });

  it('rendimiento: 100 búsquedas dentro de la planta completa en menos de 100 ms', () => {
    const pares: [number, number, number, number][] = [
      [-14, -2, 14.5, -3],
      [-14, 3, 12, 2],
      [0, 9, -15, -3],
      [15, 9, -9, 3],
    ];
    const ruta = new Float64Array(MAX * 2);
    // Calentamiento del JIT.
    for (const [a, b, c, d] of pares) buscarRuta(nav, a, b, c, d, ruta, MAX);
    const t0 = performance.now();
    let total = 0;
    for (let i = 0; i < 100; i++) {
      const [a, b, c, d] = pares[i % pares.length] as [number, number, number, number];
      total += buscarRuta(nav, a, b, c, d, ruta, MAX);
    }
    const ms = performance.now() - t0;
    expect(total).toBeGreaterThan(100);
    expect(ms).toBeLessThan(100);
  });

  it('es determinista y reutilizable', () => {
    const a = ir(nav, -14, 3, 14.5, -3);
    const b = ir(nav, -14, 3, 14.5, -3);
    expect(b.n).toBe(a.n);
    expect(Array.from(b.ruta)).toEqual(Array.from(a.ruta));
  });

  it('no asigna memoria en las búsquedas', () => {
    const gc = (globalThis as { gc?: () => void }).gc;
    const ruta = new Float64Array(MAX * 2);
    const bucle = (k: number) => {
      for (let i = 0; i < k; i++) buscarRuta(nav, -14, 3, 14.5, -3, ruta, MAX);
    };
    bucle(50);
    gc?.();
    const antes = process.memoryUsage().heapUsed;
    bucle(300);
    gc?.();
    const despues = process.memoryUsage().heapUsed;
    if (gc) expect(despues - antes).toBeLessThan(2 * 1024 * 1024);
  });
});
