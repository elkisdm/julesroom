import { describe, expect, it, vi } from 'vitest';
import { Box3, Mesh, BoxGeometry, PerspectiveCamera, Scene, Vector3 } from 'three';
import { escenarioPorId } from '@oficina/motor';
import { nombreSobreCabeza } from './encuadreVestidor';
import { dibujarVestidor } from './composicionVestidor';
import { areaVestidor, encuadreVestidor, PARAMETROS_VESTIDOR as P } from './encuadreVestidor';

describe('composición del vestidor', () => {
  it('el nombre sigue el centro real de la cabeza animada, incluso con gorro', () => {
    const cabeza = { x: 4.2, y: 3.6, z: -2.8 };
    const nombre = nombreSobreCabeza(cabeza, false);
    expect(nombre.x).toBe(cabeza.x);
    expect(nombre.z).toBe(cabeza.z);
    expect(nombre.y).toBeGreaterThan(cabeza.y);
    expect(nombreSobreCabeza(cabeza, true).y).toBeGreaterThan(nombre.y);
    expect(cabeza.y).toBe(3.6);
  });
  it('borra la profundidad del mundo antes de dibujar el avatar y restaura autoClear', () => {
    const orden: string[] = [];
    const gl = {
      autoClear: true,
      clearDepth: () => orden.push('profundidad'),
      render: vi.fn(() => orden.push('avatar')),
    };
    const escena = new Scene();
    const camara = new PerspectiveCamera();
    dibujarVestidor(gl, escena, camara);
    expect(orden).toEqual(['profundidad', 'avatar']);
    expect(gl.render).toHaveBeenCalledWith(escena, camara);
    expect(gl.autoClear).toBe(true);
    gl.autoClear = false;
    gl.render.mockImplementation(() => {
      throw new Error('render fallido');
    });
    expect(() => dibujarVestidor(gl, escena, camara)).toThrow('render fallido');
    expect(gl.autoClear).toBe(false);
  });

  it('atenúa el fondo antes de dibujar el avatar sin teñirlo', () => {
    const mundo = new Scene();
    const velo = new Scene();
    const avatar = new Scene();
    const camara = new PerspectiveCamera();
    const orden: unknown[] = [mundo];
    const gl = {
      autoClear: true,
      clearDepth: () => orden.push('profundidad'),
      render: (escena: Scene) => {
        orden.push(escena);
      },
    };
    dibujarVestidor(gl, avatar, camara, velo);
    expect(orden).toEqual([mundo, 'profundidad', velo, 'profundidad', avatar]);
    expect(gl.autoClear).toBe(true);
  });

  for (const plantilla of ['trading', 'oficina', 'mansion'])
    for (const [ancho, alto] of [
      [1440, 900],
      [390, 844],
      [320, 640],
    ])
      it(`${plantilla} ${ancho}×${alto}: volumen libre y nombre sobre el eje al girar y acercarse`, () => {
        const pies = escenarioPorId(plantilla).entradas[0]!;
        const area = areaVestidor(ancho!, alto!);
        for (const busto of [false, true]) {
          const e = encuadreVestidor(ancho!, alto!, pies, busto);
          const camara = new PerspectiveCamera(P.fov, ancho! / alto!, 0.1, 600);
          camara.position.set(e.posicion.x, e.posicion.y, e.posicion.z);
          camara.lookAt(e.objetivo.x, e.objetivo.y, e.objetivo.z);
          camara.updateMatrixWorld();
          for (const giro of [0, Math.PI / 2, Math.PI]) {
            const avatar = new Mesh(new BoxGeometry(0.7, 1.8, 0.5));
            avatar.position.set(pies.x, pies.y + 0.9, pies.z);
            avatar.rotation.y = giro;
            avatar.updateMatrixWorld();
            const caja = new Box3().setFromObject(avatar);
            const cabeza = new Vector3(pies.x, pies.y + P.alturaNombre, pies.z).project(camara);
            const centro = new Vector3(pies.x, pies.y + 1.4, pies.z).project(camara);
            expect(cabeza.x).toBeCloseTo(centro.x);
            expect(cabeza.y).toBeGreaterThan(centro.y);
            for (const x of [caja.min.x, caja.max.x])
              for (const y of [busto ? pies.y + 0.9 : caja.min.y, caja.max.y])
                for (const z of [caja.min.z, caja.max.z]) {
                  const punto = new Vector3(x, y, z).project(camara);
                  const sx = ((punto.x + 1) * ancho!) / 2;
                  const sy = ((1 - punto.y) * alto!) / 2;
                  expect(sx).toBeGreaterThan(area.x);
                  expect(sx).toBeLessThan(area.x + area.ancho);
                  expect(sy).toBeGreaterThan(area.y);
                  expect(sy).toBeLessThan(area.y + area.alto);
                }
            avatar.geometry.dispose();
          }
        }
      });
});
