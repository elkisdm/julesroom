import { BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';

/** Un rectángulo con su celda del atlas (`uv` = [u0, v0, u1, v1]); su cara mira a su +z local. */
export interface Quad {
  x: number;
  y: number;
  z: number;
  ancho: number;
  alto: number;
  /** Giro en y (rad). */
  giro: number;
  /** Giro en x (rad), aplicado antes que el de y (pantalla inclinada). */
  inclinacion: number;
  uv: [number, number, number, number];
}

const ESQUINAS: readonly [number, number][] = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
];

/**
 * Muchos rectángulos con textura de atlas en UNA geometría (un draw call): los monitores de los
 * puestos y los letreros. Cada rectángulo son 4 vértices y 2 triángulos, en el orden de la lista.
 */
export function geometriaQuads(quads: readonly Quad[]): BufferGeometry {
  const posiciones: number[] = [];
  const normales: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const m = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const n = new Vector3();
  const uno = new Vector3(1, 1, 1);
  quads.forEach((c, i) => {
    q.setFromEuler(new Euler(c.inclinacion, c.giro, 0, 'YXZ'));
    m.compose(new Vector3(c.x, c.y, c.z), q, uno);
    n.set(0, 0, 1).applyQuaternion(q);
    const [u0, v0, u1, v1] = c.uv;
    for (const [sx, sy] of ESQUINAS) {
      v.set(sx * c.ancho, sy * c.alto, 0).applyMatrix4(m);
      posiciones.push(v.x, v.y, v.z);
      normales.push(n.x, n.y, n.z);
      uvs.push(sx < 0 ? u0 : u1, sy < 0 ? v0 : v1);
    }
    const b = i * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(posiciones, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normales, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/** UV de la celda `i` de un atlas (izquierda a derecha, arriba abajo). */
export function celdaAtlas(
  i: number,
  columnas: number,
  filas: number,
): [number, number, number, number] {
  const c = i % columnas;
  const f = Math.floor(i / columnas) % filas;
  return [c / columnas, 1 - (f + 1) / filas, (c + 1) / columnas, 1 - f / filas];
}

/** Qué rectángulo de `geometriaQuads` contiene el triángulo `faceIndex`. */
export const quadTocado = (faceIndex: number): number => Math.floor(faceIndex / 2);
