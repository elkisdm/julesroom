import { Vector3 } from 'three';
import type { Camera, Group } from 'three';
import type { Punto3 } from './camara';

/** Posición en píxeles dentro del lienzo y si está delante de la cámara. */
export interface PuntoPantalla {
  x: number;
  y: number;
  visible: boolean;
}

/** Posición de la raíz del agente y orientación en radianes (0 mira a +z). */
export interface PosicionAgente extends Punto3 {
  rumbo: number;
}

export interface Proyector {
  (objetivo: Punto3 | string): PuntoPantalla | null;
  /** Copia de la posición vigente; null si el id no existe. También admite personas y avatar. */
  mundo(id: string): PosicionAgente | null;
}

const PARAMETROS_PROYECTOR = { alturaCabeza: 1.1 };

/** Proyecta con la cámara vigente y consulta los rigs sin invertir la proyección. */
export function crearProyector(
  rigs: { current: ReadonlyMap<string, { raiz: Group }> },
  obtenerVista: () => { camera: Camera; size: { width: number; height: number } },
): Proyector {
  const proyectar = (objetivo: Punto3 | string): PuntoPantalla | null => {
    const { camera, size } = obtenerVista();
    const punto =
      typeof objetivo === 'string' ? rigs.current.get(objetivo)?.raiz.position : objetivo;
    if (!punto) return null;
    const v = new Vector3(
      punto.x,
      punto.y + (typeof objetivo === 'string' ? PARAMETROS_PROYECTOR.alturaCabeza : 0),
      punto.z,
    ).project(camera);
    return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height, visible: v.z < 1 };
  };
  return Object.assign(proyectar, {
    mundo: (id: string): PosicionAgente | null => {
      const rig = rigs.current.get(id);
      if (!rig) return null;
      const { x, y, z } = rig.raiz.position;
      return { x, y, z, rumbo: rig.raiz.rotation.y };
    },
  });
}
