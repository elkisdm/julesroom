import { describe, expect, it } from 'vitest';
import { Group, PerspectiveCamera } from 'three';
import { crearProyector } from './proyector';

describe('Proyector.mundo', () => {
  it('lee posición y rumbo actuales sin exponer el objeto mutable del rig', () => {
    const raiz = new Group();
    raiz.position.set(2, 3, -4);
    raiz.rotation.y = 0.7;
    const rigs = { current: new Map([['a', { raiz }]]) };
    const proyector = crearProyector(rigs, () => ({
      camera: new PerspectiveCamera(),
      size: { width: 800, height: 600 },
    }));
    const primera = proyector.mundo('a');
    expect(primera).toEqual({ x: 2, y: 3, z: -4, rumbo: 0.7 });
    raiz.position.x = 8;
    raiz.rotation.y = 1;
    expect(proyector.mundo('a')).toEqual({ x: 8, y: 3, z: -4, rumbo: 1 });
    expect(primera?.x).toBe(2);
    rigs.current.delete('a');
    expect(proyector.mundo('a')).toBeNull();
  });

  it('devuelve null para un id desconocido o retirado', () => {
    const rigs = { current: new Map() };
    const proyector = crearProyector(rigs, () => ({
      camera: new PerspectiveCamera(),
      size: { width: 800, height: 600 },
    }));
    expect(proyector.mundo('nadie')).toBeNull();
    expect(proyector('nadie')).toBeNull();
  });
});
