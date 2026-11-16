import { useLayoutEffect, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Color, Object3D } from 'three';
import type { BufferGeometry, InstancedMesh, Material } from 'three';
import { useUbicador } from '../ubicar-contexto';

export interface Item {
  /** Posición del centro. */
  p: [number, number, number];
  /** Tamaño en cada eje (la geometría base es de lado 1). */
  e?: [number, number, number];
  /** Giro en y (rad). */
  r?: number;
  /** Giro en x (rad). */
  rx?: number;
  /** Giro en z (rad); el orden es el de three (XYZ). Lo usa una pieza girada con su mueble. */
  rz?: number;
  c?: string;
}

const auxiliar = new Object3D();
const color = new Color();

/**
 * Muchas copias de una misma malla en un solo draw call. Con `alTocar`, un clic corto sobre una
 * copia avisa su índice (y no llega al piso).
 */
export function Instancias({
  items,
  geometria,
  material,
  alTocar,
  margen = 0,
}: {
  items: readonly Item[];
  geometria: BufferGeometry;
  material: Material;
  alTocar?: (indice: number) => void;
  /** Metros fuera de la huella en los que una pieza sigue a su mueble (hojas). */
  margen?: number;
}) {
  const ubicar = useUbicador();
  const lista = ubicar(items, { margen });
  const malla = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = malla.current;
    if (!m) return;
    lista.forEach((it, i) => {
      auxiliar.position.set(...it.p);
      auxiliar.rotation.set(it.rx ?? 0, it.r ?? 0, it.rz ?? 0);
      auxiliar.scale.set(...(it.e ?? [1, 1, 1]));
      auxiliar.updateMatrix();
      m.setMatrixAt(i, auxiliar.matrix);
      if (it.c) m.setColorAt(i, color.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [lista]);
  if (lista.length === 0) return null;
  const eventos = alTocar
    ? {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6 || e.instanceId === undefined) return;
          e.stopPropagation();
          alTocar(e.instanceId);
        },
        onPointerOver: () => (document.body.style.cursor = 'pointer'),
        onPointerOut: () => (document.body.style.cursor = ''),
      }
    : {};
  return (
    <instancedMesh
      key={lista.length}
      ref={malla}
      args={[geometria, material, lista.length]}
      frustumCulled={false}
      {...eventos}
    />
  );
}

/** Eventos de una malla que representa un punto de interés: clic corto → `alTocar`, cursor de mano. */
export function tocable(alTocar: () => void) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6) return;
      e.stopPropagation();
      alTocar();
    },
    onPointerOver: () => {
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  };
}
