import type { Camera, Frustum, Matrix4, Sphere } from 'three';

/** `frameloop` de R3F: sin cuadros cuando la oficina no se ve ('demand' no sirve, hay animación continua). */
export function frameloopPara(visible: boolean): 'always' | 'never' {
  return visible ? 'always' : 'never';
}

/** Recalcula el frustum desde la cámara (usa projectionMatrix y matrixWorldInverse ya actualizadas). Reutiliza los objetos recibidos. */
export function actualizarFrustum(camara: Camera, frustum: Frustum, matriz: Matrix4): void {
  matriz.multiplyMatrices(camara.projectionMatrix, camara.matrixWorldInverse);
  frustum.setFromProjectionMatrix(matriz);
}

/** ¿La persona (esfera de `radio` en x,y,z) toca el frustum? Reutiliza `esfera`; no crea objetos. */
export function personaVisible(
  frustum: Frustum,
  x: number,
  y: number,
  z: number,
  radio: number,
  esfera: Sphere,
): boolean {
  esfera.center.set(x, y, z);
  esfera.radius = radio;
  return frustum.intersectsSphere(esfera);
}
