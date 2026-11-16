import { Box3, BoxGeometry, type BufferGeometry } from 'three';

/** 0 = geometría completa, 1 = simplificada. */
export type NivelLod = 0 | 1;

/** Distancias en metros; valores iniciales parametrizables. */
export interface ConfigLod {
  distanciaSimple: number;
  histeresis: number;
}

export const LOD_INICIAL: ConfigLod = { distanciaSimple: 18, histeresis: 2 };

/** Elige el nivel con histéresis para evitar parpadeo en el umbral. Sin asignaciones. */
export function elegirLod(distancia: number, actual: NivelLod, cfg: ConfigLod): NivelLod {
  if (distancia > cfg.distanciaSimple + cfg.histeresis) return 1;
  if (distancia < cfg.distanciaSimple - cfg.histeresis) return 0;
  return actual;
}

const MAX_VERTICES_SIMPLE = 24;
const GROSOR_MINIMO = 1e-3;
const cache = new WeakMap<BufferGeometry, BufferGeometry>();
const caja = new Box3();

/** Versión barata: una caja del tamaño de la bounding box. Planos y geometrías ya simples se devuelven tal cual. */
export function geometriaSimple(g: BufferGeometry): BufferGeometry {
  const cacheada = cache.get(g);
  if (cacheada) return cacheada;

  let resultado = g;
  if ((g.attributes.position?.count ?? 0) > MAX_VERTICES_SIMPLE) {
    g.computeBoundingBox();
    caja.copy(g.boundingBox as Box3);
    const w = caja.max.x - caja.min.x;
    const h = caja.max.y - caja.min.y;
    const d = caja.max.z - caja.min.z;
    if (w >= GROSOR_MINIMO && h >= GROSOR_MINIMO && d >= GROSOR_MINIMO) {
      resultado = new BoxGeometry(w, h, d).translate(
        (caja.min.x + caja.max.x) / 2,
        (caja.min.y + caja.max.y) / 2,
        (caja.min.z + caja.max.z) / 2,
      );
    }
  }
  cache.set(g, resultado);
  return resultado;
}
