/**
 * Franjas de sol de la mañana (proyecciones baratas, sin sombras reales): el sol de `SOL_FRANJAS`
 * entra por las vidrieras del diente de sierra y por los ventanales del fondo y del este, y cada paño de
 * vidrio deja en el piso un paralelogramo de luz cortado por los parteluces. Se dibujan una vez en un
 * lienzo que cubre el piso (`CAJA_FRANJAS`); las cubiertas de las mesas leen el mismo lienzo desplazado
 * por su altura (`uvFranja`), así la franja cruza el piso y las mesas sin cortarse.
 */
import {
  DIENTES,
  SALA,
  VENTANA_Y,
  VENTANAS_ESTE,
  VENTANAS_FONDO,
} from '../../../escenarios/oficina/plano';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface PuntoPiso {
  x: number;
  z: number;
}

/** Lo que cubre el lienzo de franjas (la nave entera). */
export const CAJA_FRANJAS = { x0: SALA.x0, x1: SALA.x1, z0: SALA.z0, z1: SALA.z1 } as const;

/** Separación de los parteluces de las vidrieras (m) y su ancho. */
export const PARTELUZ = { paso: 1.2, ancho: 0.3 } as const;

/** Dónde cae en el piso el rayo de sol (dirección HACIA el sol: `sol`) que pasa por `p`. */
export function proyectar(p: Vec3, sol: Vec3): PuntoPiso {
  return { x: p.x - (p.y * sol.x) / sol.y, z: p.z - (p.y * sol.z) / sol.y };
}

/** Paños verticales de vidrio de un vano, cortados por parteluces cada `PARTELUZ.paso`. */
function panos(desde: number, hasta: number): [number, number][] {
  const n = Math.max(1, Math.round((hasta - desde) / PARTELUZ.paso));
  const paso = (hasta - desde) / n;
  const m = PARTELUZ.ancho / 2;
  return Array.from({ length: n }, (_, i) => [desde + i * paso + m, desde + (i + 1) * paso - m]);
}

/**
 * Polígonos de luz en el piso (4 vértices cada uno): vidrieras del diente de sierra (planos z = diente,
 * del alero a la cumbrera), ventanales del fondo y ventanales del este. Sin recortar a la nave: el lienzo
 * recorta lo que cae fuera.
 */
export function poligonosDeSol(sol: Vec3): PuntoPiso[][] {
  const polis: PuntoPiso[][] = [];
  const enZ = (z: number, x0: number, x1: number, y0: number, y1: number) => {
    for (const [a, b] of panos(x0, x1))
      polis.push([
        proyectar({ x: a, y: y0, z }, sol),
        proyectar({ x: b, y: y0, z }, sol),
        proyectar({ x: b, y: y1, z }, sol),
        proyectar({ x: a, y: y1, z }, sol),
      ]);
  };
  for (const z of DIENTES) enZ(z, SALA.x0, SALA.x1, SALA.alto, SALA.cumbrera);
  for (const v of VENTANAS_FONDO) enZ(SALA.z0, v.x0, v.x1, VENTANA_Y.y0, VENTANA_Y.y1);
  for (const v of VENTANAS_ESTE)
    for (const [a, b] of panos(v.z0, v.z1))
      polis.push([
        proyectar({ x: SALA.x1, y: VENTANA_Y.y0, z: a }, sol),
        proyectar({ x: SALA.x1, y: VENTANA_Y.y0, z: b }, sol),
        proyectar({ x: SALA.x1, y: VENTANA_Y.y1, z: b }, sol),
        proyectar({ x: SALA.x1, y: VENTANA_Y.y1, z: a }, sol),
      ]);
  return polis;
}

/**
 * UV del lienzo de franjas para el punto (x, `h`, z) de una superficie horizontal: la del punto del piso
 * donde cae el rayo que pasa por él. u crece hacia el este; v, hacia el fondo (la v del lienzo es 0 abajo,
 * en el borde del frente).
 */
export function uvFranja(x: number, z: number, h: number, sol: Vec3): [number, number] {
  const p = proyectar({ x, y: h, z }, sol);
  const c = CAJA_FRANJAS;
  return [(p.x - c.x0) / (c.x1 - c.x0), (c.z1 - p.z) / (c.z1 - c.z0)];
}
