import type { Escenario } from '@oficina/motor';
type Caja = ReturnType<Escenario['colision']>['limites'];
import type { PosicionPizarra } from './mensajes';
export const TABLERO = {
  ancho: 6,
  alto: 3.375,
  fondo: 0.18,
  pie: 0.35,
  distancias: [2, 3, 4, 5, 6, 7],
  margen: 0.15,
};
/** Rechaza una ubicación insegura: nunca atraviesa paredes ni se apoya sobre un hueco. */
export function buscarColocacion(
  yo: { x: number; y: number; z: number },
  rumbo: number,
  colision: { cajas: Caja[]; limites: Caja },
  altura: (x: number, z: number) => number,
): PosicionPizarra | null {
  for (const d of TABLERO.distancias) {
    const x = yo.x + Math.sin(rumbo) * d,
      z = yo.z + Math.cos(rumbo) * d;
    const giro = rumbo + Math.PI;
    const dx =
      Math.abs(Math.cos(giro)) * (TABLERO.ancho / 2 + TABLERO.margen) +
      Math.abs(Math.sin(giro)) * 0.4;
    const dz =
      Math.abs(Math.sin(giro)) * (TABLERO.ancho / 2 + TABLERO.margen) +
      Math.abs(Math.cos(giro)) * 0.4;
    const b = { x0: x - dx, x1: x + dx, z0: z - dz, z1: z + dz };
    const l = colision.limites;
    if (b.x0 < l.x0 || b.x1 > l.x1 || b.z0 < l.z0 || b.z1 > l.z1) continue;
    if (colision.cajas.some((c) => b.x0 < c.x1 && b.x1 > c.x0 && b.z0 < c.z1 && b.z1 > c.z0))
      continue;
    const puntos = Array.from({ length: 13 }, (_, i) => {
      const ancho = -TABLERO.ancho / 2 + (i * TABLERO.ancho) / 12;
      return { x: x + Math.cos(giro) * ancho, z: z - Math.sin(giro) * ancho };
    });
    const y = altura(x, z);
    if (
      !Number.isFinite(y) ||
      Math.abs(y - yo.y) > 0.4 ||
      puntos.some((p) => Math.abs(altura(p.x, p.z) - y) > 0.08)
    )
      continue;
    // Comprueba también la línea desde el anfitrión: no coloca detrás de una pared.
    if (
      Array.from({ length: 20 }, (_, i) => ({
        x: yo.x + ((x - yo.x) * i) / 20,
        z: yo.z + ((z - yo.z) * i) / 20,
      })).some((p) =>
        colision.cajas.some((c) => p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1),
      )
    )
      continue;
    return { x, y, z, giro };
  }
  return null;
}
