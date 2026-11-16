import { describe, expect, it } from 'vitest';
import {
  conectarSuspensionControles,
  controlesSuspendidos,
  suspenderControlesCamara,
} from '../index';
import {
  aplicarSuspension,
  crearSuspensionControles,
  frenarInerciaControles,
} from './suspensionControles';

function vector(x: number, y: number, z: number) {
  return {
    x,
    y,
    z,
    set(nx: number, ny: number, nz: number) {
      this.x = nx;
      this.y = ny;
      this.z = nz;
    },
  };
}

function cuaternion(x: number, y: number, z: number, w: number) {
  return {
    x,
    y,
    z,
    w,
    set(nx: number, ny: number, nz: number, nw: number) {
      this.x = nx;
      this.y = ny;
      this.z = nz;
      this.w = nw;
    },
  };
}

/** Imita la inercia de OrbitControls: con amortiguación se come el delta; sin ella lo aplica entero. */
function controlConInercia(delta: number) {
  let inercia = delta;
  const position = vector(1, 2, 3);
  const quaternion = cuaternion(0, 0, 0, 1);
  const target = vector(4, 5, 6);
  const control = {
    enabled: true,
    enableDamping: true,
    object: {
      position,
      quaternion,
      zoom: 1,
      updateProjectionMatrix() {},
      updateMatrixWorld() {},
    },
    target,
    update() {
      if (this.enableDamping) {
        position.x += inercia * 0.25;
        inercia *= 0.5;
      } else {
        position.x += inercia;
        quaternion.y = 0.5;
        target.x += inercia;
        inercia = 0;
      }
    },
    inercia: () => inercia,
  };
  return control;
}

function pose(control: ReturnType<typeof controlConInercia>) {
  const { position, quaternion } = control.object;
  return {
    posicion: [position.x, position.y, position.z],
    mirada: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    objetivo: [control.target.x, control.target.y, control.target.z],
    zoom: control.object.zoom,
  };
}

describe('frenarInerciaControles', () => {
  it('tira el delta pendiente y deja la cámara donde estaba', () => {
    const control = controlConInercia(0.8);
    const antes = pose(control);
    frenarInerciaControles(control);
    expect(control.inercia()).toBe(0);
    expect(pose(control)).toEqual(antes);
    expect(control.enableDamping).toBe(true);
  });
});

describe('suspensión de los controles de cámara', () => {
  it('apaga el control al suspender y lo devuelve sin inercia ni salto', () => {
    const suspension = crearSuspensionControles();
    const control = controlConInercia(1.2);
    const antes = pose(control);
    suspension.conectar((suspendido) => aplicarSuspension(control, suspendido));

    const soltar = suspension.suspender();
    expect(suspension.suspendido()).toBe(true);
    expect(control.enabled).toBe(false);
    expect(control.inercia()).toBe(0);
    expect(pose(control)).toEqual(antes);

    soltar();
    expect(suspension.suspendido()).toBe(false);
    expect(control.enabled).toBe(true);
    expect(control.inercia()).toBe(0);
    expect(pose(control)).toEqual(antes);
  });

  it('cuenta las suspensiones: sigue apagado hasta la última suelta', () => {
    const suspension = crearSuspensionControles();
    const control = controlConInercia(0);
    suspension.conectar((suspendido) => aplicarSuspension(control, suspendido));
    const a = suspension.suspender();
    const b = suspension.suspender();
    a();
    expect(control.enabled).toBe(false);
    b();
    expect(control.enabled).toBe(true);
    a();
    expect(control.enabled).toBe(true);
  });

  it('un control que se conecta con un gesto ya en curso nace suspendido', () => {
    const suspension = crearSuspensionControles();
    const soltar = suspension.suspender();
    const control = controlConInercia(0.4);
    suspension.conectar((suspendido) => aplicarSuspension(control, suspendido));
    expect(control.enabled).toBe(false);
    expect(control.inercia()).toBe(0);
    soltar();
    expect(control.enabled).toBe(true);
  });
});

describe('API exportada', () => {
  it('el paquete expone suspender, consultar y conectar', () => {
    expect(typeof suspenderControlesCamara).toBe('function');
    expect(typeof controlesSuspendidos).toBe('function');
    expect(typeof conectarSuspensionControles).toBe('function');
    expect(controlesSuspendidos()).toBe(false);
  });
});
