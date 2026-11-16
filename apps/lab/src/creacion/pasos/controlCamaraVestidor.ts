import type { Camera } from 'three';

/** Presta la cámara al vestidor; devuelve su pose exacta y la disponibilidad de órbita al salir. */
export function tomarCamara(camara: Camera, controles: { enabled: boolean } | null): () => void {
  const posicion = camara.position.clone();
  const orientacion = camara.quaternion.clone();
  const habilitados = controles?.enabled;
  if (controles) controles.enabled = false;
  return () => {
    camara.position.copy(posicion);
    camara.quaternion.copy(orientacion);
    camara.updateMatrixWorld();
    if (controles && habilitados !== undefined) controles.enabled = habilitados;
  };
}
