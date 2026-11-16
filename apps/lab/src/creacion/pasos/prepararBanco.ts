import { Scene, Vector4, WebGLRenderTarget } from 'three';
import type { Camera, InstancedMesh, Mesh, Object3D, WebGLRenderer } from 'three';
import { PARAMETROS_MUNDOS } from './mundos';

/** Cede un cuadro y espera ocio; cancelar también libera la espera pendiente. */
export function cederAlNavegador(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let cuadro = 0;
    let ocio = 0;
    let tiempo = 0;
    const limpiar = () => {
      cancelAnimationFrame(cuadro);
      if (ocio) window.cancelIdleCallback(ocio);
      window.clearTimeout(tiempo);
      signal.removeEventListener('abort', cancelar);
    };
    const cancelar = () => {
      limpiar();
      reject(signal.reason);
    };
    const seguir = () => {
      limpiar();
      resolve();
    };
    if (signal.aborted) {
      cancelar();
      return;
    }
    signal.addEventListener('abort', cancelar, { once: true });
    cuadro = requestAnimationFrame(() => {
      if (window.requestIdleCallback)
        ocio = window.requestIdleCallback(seguir, { timeout: PARAMETROS_MUNDOS.turnoMaximoMs });
      else tiempo = window.setTimeout(seguir, 0);
    });
  });
}

/** Compila y sube grupos pequeños en un destino auxiliar, compartiendo materiales y geometría. */
export async function prepararBancoPorPartes(
  gl: WebGLRenderer,
  banco: Scene,
  camara: Camera,
  signal: AbortSignal,
  ceder: (signal: AbortSignal) => Promise<void> = cederAlNavegador,
  cantidad = PARAMETROS_MUNDOS.objetosPorTurno,
): Promise<void> {
  const objetos: Object3D[] = [];
  const auxiliar = new Scene();
  auxiliar.environment = banco.environment;
  auxiliar.environmentIntensity = banco.environmentIntensity;
  auxiliar.fog = banco.fog;
  banco.updateMatrixWorld(true);
  banco.traverseVisible((objeto) => {
    if ('material' in objeto) objetos.push(objeto);
    if ('isLight' in objeto) {
      const luz = objeto.clone(false);
      luz.matrix.copy(objeto.matrixWorld);
      luz.matrixAutoUpdate = false;
      auxiliar.add(luz);
    }
  });
  const destino = new WebGLRenderTarget(
    PARAMETROS_MUNDOS.calentamientoPx,
    PARAMETROS_MUNDOS.calentamientoPx,
  );
  try {
    for (let i = 0; i < objetos.length; i += cantidad) {
      await ceder(signal);
      signal.throwIfAborted();
      const lote = objetos.slice(i, i + cantidad).map((objeto) => {
        const copia = objeto.clone(false) as Mesh;
        copia.matrix.copy(objeto.matrixWorld);
        copia.matrixAutoUpdate = false;
        copia.frustumCulled = false;
        auxiliar.add(copia);
        return copia;
      });
      try {
        await gl.compileAsync(auxiliar, camara);
        signal.throwIfAborted();
        const anterior = gl.getRenderTarget();
        try {
          gl.setRenderTarget(destino);
          gl.render(auxiliar, camara);
          // El framebuffer final usa otra combinación de color, tono y recorte local.
          calentarSalidaVisible(gl, auxiliar, camara);
        } finally {
          gl.setRenderTarget(anterior);
        }
      } finally {
        for (const copia of lote) {
          auxiliar.remove(copia);
          if ('isInstancedMesh' in copia) (copia as InstancedMesh).dispose();
        }
      }
    }
  } finally {
    destino.dispose();
  }
}

/** Inicializa los programas de pantalla sin escribir un solo píxel del cuadro visible. */
export function calentarSalidaVisible(gl: WebGLRenderer, escena: Scene, camara: Camera): void {
  const destino = gl.getRenderTarget();
  const tijera = gl.getScissor(new Vector4());
  const recortar = gl.getScissorTest();
  try {
    gl.setRenderTarget(null);
    gl.setScissor(0, 0, 0, 0);
    gl.setScissorTest(true);
    gl.render(escena, camara);
  } finally {
    gl.setRenderTarget(destino);
    gl.setScissor(tijera);
    gl.setScissorTest(recortar);
  }
}
