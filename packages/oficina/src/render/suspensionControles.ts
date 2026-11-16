/**
 * Suspensión de la órbita mientras la aplicación tiene un gesto propio
 * (arrastrar un mueble, por ejemplo). Es síncrona: el control queda apagado
 * antes de que el evento llegue a OrbitControls, y al soltar no hereda inercia.
 */

export interface ControlesConInercia {
  enabled: boolean;
  enableDamping: boolean;
  update: () => void;
  target: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  object: {
    position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
    quaternion: {
      x: number;
      y: number;
      z: number;
      w: number;
      set: (x: number, y: number, z: number, w: number) => void;
    };
    zoom: number;
    updateProjectionMatrix?: () => void;
    updateMatrixWorld?: (force?: boolean) => void;
  };
}

/**
 * Vacía el delta de órbita, desplazamiento y zoom sin mover la cámara.
 * OrbitControls solo suelta ese delta al aplicarlo; se aplica y se restaura la pose.
 */
export function frenarInerciaControles(control: ControlesConInercia): void {
  const pos = control.object.position;
  const qua = control.object.quaternion;
  const tgt = control.target;
  const pose = {
    px: pos.x,
    py: pos.y,
    pz: pos.z,
    qx: qua.x,
    qy: qua.y,
    qz: qua.z,
    qw: qua.w,
    tx: tgt.x,
    ty: tgt.y,
    tz: tgt.z,
    zoom: control.object.zoom,
  };
  const amortigua = control.enableDamping;
  control.enableDamping = false;
  try {
    control.update();
  } finally {
    control.enableDamping = amortigua;
    pos.set(pose.px, pose.py, pose.pz);
    qua.set(pose.qx, pose.qy, pose.qz, pose.qw);
    tgt.set(pose.tx, pose.ty, pose.tz);
    control.object.zoom = pose.zoom;
    control.object.updateProjectionMatrix?.();
    control.object.updateMatrixWorld?.(true);
  }
}

/** Apaga el control y tira la inercia, o lo enciende igual de quieto. */
export function aplicarSuspension(control: ControlesConInercia, suspendido: boolean): void {
  frenarInerciaControles(control);
  control.enabled = !suspendido;
}

/** Contador aislado. El motor usa uno solo; los tests crean el suyo. */
export function crearSuspensionControles() {
  let cuenta = 0;
  let aplicar: ((suspendido: boolean) => void) | null = null;

  return {
    suspendido: () => cuenta > 0,
    /** El control real se entera en el acto, también si el gesto empezó antes de montarse. */
    conectar(fn: (suspendido: boolean) => void) {
      aplicar = fn;
      fn(cuenta > 0);
      return () => {
        if (aplicar === fn) aplicar = null;
      };
    },
    /**
     * Suspende hasta que se llama la función devuelta. Se puede soltar dos veces:
     * la segunda no descuenta de más.
     */
    suspender() {
      cuenta += 1;
      if (cuenta === 1) aplicar?.(true);
      let viva = true;
      return () => {
        if (!viva) return;
        viva = false;
        cuenta -= 1;
        if (cuenta === 0) aplicar?.(false);
      };
    },
  };
}

const controles = crearSuspensionControles();

/** ¿Hay un gesto de la aplicación que se quedó con el puntero? */
export const controlesSuspendidos = controles.suspendido;

/**
 * La oficina conecta aquí su órbita. Cada aviso es síncrono.
 * Devuelve la desconexión.
 */
export const conectarSuspensionControles = controles.conectar;

/**
 * La órbita no gira, no se desplaza ni hace zoom hasta soltar.
 * Llamar en la fase de captura del `pointerdown`, antes de que la órbita vea el evento.
 */
export const suspenderControlesCamara = controles.suspender;
