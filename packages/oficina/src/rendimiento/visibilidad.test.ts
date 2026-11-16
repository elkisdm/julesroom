import { Frustum, Matrix4, PerspectiveCamera, Sphere } from 'three';
import { describe, expect, it } from 'vitest';
import { actualizarFrustum, frameloopPara, personaVisible } from './visibilidad';

describe('frameloopPara', () => {
  it('visible=false detiene el render', () => {
    expect(frameloopPara(false)).toBe('never');
  });

  it('visible=true lo mantiene corriendo (hay animación continua)', () => {
    expect(frameloopPara(true)).toBe('always');
  });
});

function preparar() {
  // Cámara en el origen mirando hacia -Z, fov 90, aspect 1, far 100.
  const camara = new PerspectiveCamera(90, 1, 0.1, 100);
  camara.updateMatrixWorld();
  const frustum = new Frustum();
  actualizarFrustum(camara, frustum, new Matrix4());
  return { frustum, esfera: new Sphere() };
}

describe('personaVisible', () => {
  it('una persona delante de la cámara es visible', () => {
    const { frustum, esfera } = preparar();
    expect(personaVisible(frustum, 0, 0, -5, 0.5, esfera)).toBe(true);
  });

  it('una persona detrás de la cámara no es visible', () => {
    const { frustum, esfera } = preparar();
    expect(personaVisible(frustum, 0, 0, 5, 0.5, esfera)).toBe(false);
  });

  it('fuera del lateral y sin tocar el borde no es visible', () => {
    const { frustum, esfera } = preparar();
    // A z=-5 el borde lateral está en x=5; x=8 con radio 0.5 queda fuera.
    expect(personaVisible(frustum, 8, 0, -5, 0.5, esfera)).toBe(false);
  });

  it('justo en el borde con un radio que lo toca es visible', () => {
    const { frustum, esfera } = preparar();
    // Centro en x=6 (fuera); plano lateral a ~4.95 de distancia perpendicular ≈ (6-5)/√2 ≈ 0.707.
    expect(personaVisible(frustum, 6, 0, -5, 0.5, esfera)).toBe(false);
    expect(personaVisible(frustum, 6, 0, -5, 0.8, esfera)).toBe(true);
  });

  it('reutiliza la esfera recibida (no crea una nueva)', () => {
    const { frustum, esfera } = preparar();
    const centro = esfera.center;
    personaVisible(frustum, 1, 2, -3, 0.7, esfera);
    expect(esfera.center).toBe(centro);
    expect(esfera.center.x).toBe(1);
    expect(esfera.center.y).toBe(2);
    expect(esfera.center.z).toBe(-3);
    expect(esfera.radius).toBe(0.7);
  });
});
