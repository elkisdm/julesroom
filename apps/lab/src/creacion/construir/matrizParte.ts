import { Object3D } from 'three';
import type { Matrix4 } from 'three';
import { radianes, tipoObjeto } from '@oficina/motor';
import type { Giro } from '@oficina/motor';
import type { Parte } from './piezas';

const aux = new Object3D();

/** Matriz de mundo de una parte de un objeto colocado (para su `InstancedMesh`). */
export function matrizDeParte(
  o: { tipo: string; x: number; z: number; giro: Giro },
  y: number,
  parte: Parte,
  destino: Matrix4,
): Matrix4 {
  const t = tipoObjeto(o.tipo);
  if (!t) return destino.identity();
  const base = t.elevacion ?? (o.tipo === 'cuadro' ? 1.3 : 0);
  const ancho = t.ancho;
  const fondo = t.fondo;
  const alto = t.alto;
  const [cx, cy, cz] = parte.c;
  const [sx, sy, sz] = parte.s;
  // El desplazamiento de la parte gira con el objeto, como en un grupo girado (rotación en y de three).
  const angulo = radianes(o.giro);
  const lx = cx * ancho;
  const lz = cz * fondo;
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  aux.position.set(o.x + lx * cos + lz * sen, y + base + cy * alto, o.z - lx * sen + lz * cos);
  aux.rotation.set(0, angulo, 0);
  aux.scale.set(sx * ancho, sy * alto, sz * fondo);
  aux.updateMatrix();
  return destino.copy(aux.matrix);
}
