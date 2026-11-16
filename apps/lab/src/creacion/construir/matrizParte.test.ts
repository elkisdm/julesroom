/**
 * Las partes de un objeto instanciado deben quedar donde las ponía el dibujo anterior: un grupo en
 * (x, y, z) girado `giro` con cada parte desplazada y escalada DENTRO del grupo. Antes el desplazamiento
 * de la parte no giraba con el objeto (la cafetera de la barra, la pantalla de pie y el cuadro salían
 * corridos en giros 1–3).
 */
import { describe, expect, it } from 'vitest';
import { Group, Matrix4, Mesh, Vector3, Quaternion } from 'three';
import { radianes, tipoObjeto } from '@oficina/motor';
import type { Giro } from '@oficina/motor';
import { piezaDe } from './piezas';
import { matrizDeParte } from './matrizParte';

/** Referencia: la jerarquía del dibujo sin instanciar (grupo girado → malla de la parte). */
function referencia(o: { tipo: string; x: number; z: number; giro: Giro }, y: number, i: number) {
  const t = tipoObjeto(o.tipo)!;
  const p = piezaDe(o.tipo)[i]!;
  const base = o.tipo === 'cuadro' ? 1.3 : 0;
  const g = new Group();
  g.position.set(o.x, y + base, o.z);
  g.rotation.set(0, radianes(o.giro), 0);
  const m = new Mesh();
  m.position.set(p.c[0] * t.ancho, p.c[1] * t.alto, p.c[2] * t.fondo);
  m.scale.set(p.s[0] * t.ancho, p.s[1] * t.alto, p.s[2] * t.fondo);
  g.add(m);
  g.updateMatrixWorld(true);
  return m.matrixWorld.clone();
}

const descomponer = (m: Matrix4) => {
  const pos = new Vector3();
  const rot = new Quaternion();
  const esc = new Vector3();
  m.decompose(pos, rot, esc);
  return { pos, rot, esc };
};

describe('matriz de cada parte instanciada', () => {
  for (const tipo of ['barra-cafe', 'pantalla-pie', 'cuadro', 'sofa-tres', 'palmera']) {
    for (const giro of [0, 1, 2, 3] as Giro[]) {
      it(`${tipo}, giro ${giro}: igual que el grupo girado`, () => {
        const o = { tipo, x: 3.2, z: -1.7, giro };
        piezaDe(tipo).forEach((_, i) => {
          const esperado = descomponer(referencia(o, 0, i));
          const obtenido = descomponer(matrizDeParte(o, 0, piezaDe(tipo)[i]!, new Matrix4()));
          expect(obtenido.pos.distanceTo(esperado.pos)).toBeLessThan(1e-9);
          expect(obtenido.esc.distanceTo(esperado.esc)).toBeLessThan(1e-9);
          expect(Math.abs(obtenido.rot.dot(esperado.rot))).toBeCloseTo(1, 9);
        });
      });
    }
  }
});
