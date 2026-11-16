import type { Punto3 } from './camara';
const FOTO = { margen: 1.3, altura: 2, radioMin: 4 };
/** Esfera envolvente con margen para cuerpos completos, tanto en vertical como horizontal. */
export function encuadreFoto(puntos: readonly Punto3[], aspecto: number, fov: number) {
  const centro = { x: 0, y: 1, z: 0 };
  if (puntos.length) {
    for (const eje of ['x', 'y', 'z'] as const)
      centro[eje] =
        (Math.min(...puntos.map((p) => p[eje])) + Math.max(...puntos.map((p) => p[eje]))) / 2;
    centro.y += FOTO.altura / 2;
  }
  const radio = Math.max(
    FOTO.radioMin,
    ...puntos.map((p) => Math.hypot(p.x - centro.x, p.y - centro.y, p.z - centro.z) + FOTO.altura),
  );
  const vertical = (fov * Math.PI) / 360;
  const angulo = Math.min(vertical, Math.atan(Math.tan(vertical) * aspecto));
  return { centro, angulo, distancia: (radio * FOTO.margen) / Math.sin(angulo) };
}
