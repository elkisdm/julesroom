import type { PosicionPizarra } from './mensajes';
import { TABLERO } from './colocacion';
export function encuadrarPizarra(p: PosicionPizarra, ancho: number, alto: number, fov: number) {
  const tangente = Math.tan((fov * Math.PI) / 360),
    aspecto = ancho / Math.max(1, alto);
  const distancia =
    Math.max(
      (TABLERO.ancho + 0.2) / (2 * tangente * aspecto),
      (TABLERO.alto + TABLERO.pie) / (2 * tangente),
    ) * 1.3;
  const objetivo = { x: p.x, y: p.y + (TABLERO.alto + TABLERO.pie) / 2, z: p.z };
  return {
    objetivo,
    posicion: {
      x: p.x + Math.sin(p.giro) * distancia,
      y: objetivo.y + distancia * 0.55,
      z: p.z + Math.cos(p.giro) * distancia,
    },
  };
}
