import { AdditiveBlending, BackSide, MeshBasicMaterial, RingGeometry } from 'three';
import type { Familia } from './flota';
import { caja, geometria, material } from './recursos';

/**
 * Contorno de casco invertido (la técnica de `OutlineEffect` de three, sin su pasada extra), en
 * dos pasos para que rodee la silueta completa y no cada pieza:
 * 1. `familiaRelleno`: las mismas piezas, apenas infladas (el borde queda pegado al cuerpo), y
 *    unos puentes sin inflar (piernas, brazos) escriben solo profundidad: tapan los huecos entre
 *    piezas y las caras internas de los cascos.
 * 2. `familiaContorno`: los cascos, más inflados que el relleno, dibujados después; solo queda
 *    visible el borde que sobresale de la silueta.
 * Los dos van en orden de render alto (transparentes, después de las caras y los globos).
 */
export const ESPESOR_CONTORNO = 0.017;
export const ESPESOR_RELLENO = 0.006;
const ORDEN_RELLENO = 6;
const ORDEN_CONTORNO = 7;

function inflado(m: MeshBasicMaterial, espesor: number, clave: string): MeshBasicMaterial {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\ntransformed += normalize(normal) * ${espesor.toFixed(4)};`,
    );
  };
  m.customProgramCacheKey = () => clave;
  return m;
}

export const familiaContorno = (): Familia => ({
  clave: 'contorno',
  ordenRender: ORDEN_CONTORNO,
  material: material('contorno', () =>
    inflado(
      new MeshBasicMaterial({ side: BackSide, toneMapped: false, transparent: true }),
      ESPESOR_CONTORNO,
      'contorno',
    ),
  ),
});

export const familiaRelleno = (): Familia => ({
  clave: 'contorno-relleno',
  ordenRender: ORDEN_RELLENO,
  material: material('contorno-relleno', () =>
    inflado(
      new MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true }),
      ESPESOR_RELLENO,
      'contorno-relleno',
    ),
  ),
});

/** Aro de luz sobre la cabeza de las personas humanas (los agentes de IA no lo llevan). */
export const geometriaAroHumano = () =>
  geometria('aro-humano', () => new RingGeometry(0.17, 0.215, 36).rotateX(-Math.PI / 2));

export const materialAroHumano = () =>
  material(
    'aro-humano',
    () =>
      new MeshBasicMaterial({
        color: '#7fe0ff',
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
  );

/** Puente de profundidad que cierra el hueco entre las dos piernas (en el espacio de la pelvis). */
export const puentePiernas = () =>
  geometria('puente-piernas', () => caja(0.5, 0.6, 0.22).translate(0, -0.31, 0));

/** Puente de profundidad a lo largo de un brazo (en el espacio del hombro): cierra la junta del codo. */
export const puenteBrazo = () =>
  geometria('puente-brazo', () => caja(0.2, 0.58, 0.22).translate(0, -0.29, 0));
