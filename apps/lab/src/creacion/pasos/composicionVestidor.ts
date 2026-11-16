import type { Camera, Scene, WebGLRenderer } from 'three';

/** Compone el avatar después del mundo: ninguna pared, planta u ocupante puede taparlo. */
export function dibujarVestidor(
  gl: Pick<WebGLRenderer, 'autoClear' | 'clearDepth' | 'render'>,
  escena: Scene,
  camara: Camera,
  velo?: Scene,
): void {
  const anterior = gl.autoClear;
  try {
    gl.autoClear = false;
    if (velo) {
      gl.clearDepth();
      gl.render(velo, camara);
    }
    gl.clearDepth();
    gl.render(escena, camara);
  } finally {
    gl.autoClear = anterior;
  }
}
