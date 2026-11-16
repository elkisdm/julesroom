import { alturaEn, sueloDe } from '@oficina/motor';
import type { Escenario, PosicionAgente } from '@oficina/motor';
import { PARAMETROS_PRESENTACION as P, type PosicionPantalla } from './protocolo';
/** Caja conservadora del marco y los pies girados; también exige suelo a ambos lados. */
export function cabePantalla(e: Escenario, p: PosicionPantalla): boolean {
  const semiancho = p.ancho / 2 + P.marco;
  const dx = Math.abs(Math.cos(p.giro)) * semiancho + Math.abs(Math.sin(p.giro)) * P.profundidad;
  const dz = Math.abs(Math.sin(p.giro)) * semiancho + Math.abs(Math.cos(p.giro)) * P.profundidad;
  const caja = { x0: p.x - dx, x1: p.x + dx, z0: p.z - dz, z1: p.z + dz };
  const c = e.colision(p.y);
  if (
    caja.x0 < c.limites.x0 ||
    caja.x1 > c.limites.x1 ||
    caja.z0 < c.limites.z0 ||
    caja.z1 > c.limites.z1
  )
    return false;
  const solidos =
    e.suelo?.solidos.filter((s) => s.y0 < p.y + (p.ancho * 9) / 16 + P.pie && s.y1 > p.y + 0.02) ??
    c.cajas;
  if (solidos.some((s) => caja.x0 < s.x1 && caja.x1 > s.x0 && caja.z0 < s.z1 && caja.z1 > s.z0))
    return false;
  const suelo = sueloDe(e);
  for (let x = -semiancho; x <= semiancho + 0.001; x += 0.2) {
    for (const z of [-P.profundidad, P.profundidad]) {
      const wx = p.x + Math.cos(p.giro) * x + Math.sin(p.giro) * z;
      const wz = p.z - Math.sin(p.giro) * x + Math.cos(p.giro) * z;
      if (Math.abs(alturaEn(suelo, wx, wz, p.y) - p.y) > 0.03) return false;
    }
  }
  return true;
}
/** Reduce únicamente cuando el marco completo no cabe; nunca publica una posición inválida. */
export function ajustarPantalla(e: Escenario, p: PosicionPantalla): PosicionPantalla | null {
  for (let ancho = p.ancho; ancho >= P.anchoMin - 0.001; ancho -= P.pasoReduccion) {
    const candidata = { ...p, ancho: Math.round(ancho * 100) / 100 };
    if (cabePantalla(e, candidata)) return candidata;
  }
  return null;
}
export function colocarPantalla(e: Escenario, yo: PosicionAgente): PosicionPantalla | null {
  for (const distancia of [P.distancia, P.distancia - 1, P.distancia - 2]) {
    const x = yo.x + Math.sin(yo.rumbo) * distancia;
    const z = yo.z + Math.cos(yo.rumbo) * distancia;
    const y = alturaEn(sueloDe(e), x, z, yo.y);
    if (!Number.isFinite(y) || Math.abs(y - yo.y) > 0.3) continue;
    const p = ajustarPantalla(e, { x, y, z, giro: yo.rumbo + Math.PI, ancho: P.ancho });
    if (p) return p;
  }
  return null;
}
export function encuadrarPantalla(p: PosicionPantalla, fov: number, aspecto: number) {
  const alto = (p.ancho * 9) / 16;
  const distancia =
    Math.max(alto / 2, p.ancho / (2 * aspecto)) /
    Math.tan((fov * Math.PI) / 360) /
    P.margenEncuadre;
  const objetivo = { x: p.x, y: p.y + P.pie + alto / 2, z: p.z };
  return {
    objetivo,
    posicion: {
      x: p.x + Math.sin(p.giro) * distancia,
      y: objetivo.y,
      z: p.z + Math.cos(p.giro) * distancia,
    },
  };
}
