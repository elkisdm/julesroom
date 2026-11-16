import { expect, it, vi } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Vector4 } from 'three';
import type { WebGLRenderer } from 'three';
import { prepararBancoPorPartes } from './prepararBanco';

function equipo() {
  const escena = new Scene();
  for (let i = 0; i < 5; i++) escena.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
  let destino: unknown = 'original';
  const gl = {
    compileAsync: vi.fn(async () => {}),
    render: vi.fn(),
    getScissor: (v: Vector4) => v.set(0, 0, 1440, 900),
    setScissor: vi.fn(),
    getScissorTest: () => false,
    setScissorTest: vi.fn(),
    getRenderTarget: () => destino,
    setRenderTarget: vi.fn((d) => {
      destino = d;
    }),
  };
  return { escena, gl, destino: () => destino };
}
it('cede entre lotes y sube geometría sin mover ni dibujar el banco en pantalla', async () => {
  const e = equipo();
  const originales = [...e.escena.children];
  const ceder = vi.fn(async () => {});
  await prepararBancoPorPartes(
    e.gl as unknown as WebGLRenderer,
    e.escena,
    new PerspectiveCamera(),
    new AbortController().signal,
    ceder,
    2,
  );
  expect(ceder).toHaveBeenCalledTimes(3);
  expect(e.gl.compileAsync).toHaveBeenCalledTimes(3);
  expect(e.gl.render).toHaveBeenCalledTimes(6);
  expect(e.escena.children).toEqual(originales);
  expect(e.destino()).toBe('original');
});
it('una cancelación entre lotes evita todos los siguientes', async () => {
  const e = equipo();
  const control = new AbortController();
  await expect(
    prepararBancoPorPartes(
      e.gl as unknown as WebGLRenderer,
      e.escena,
      new PerspectiveCamera(),
      control.signal,
      async () => control.abort(),
      2,
    ),
  ).rejects.toThrow();
  expect(e.gl.render).not.toHaveBeenCalled();
  expect(e.destino()).toBe('original');
});
it('restaura el destino si falla la subida a GPU', async () => {
  const e = equipo();
  e.gl.render.mockImplementation(() => {
    throw new Error('GPU');
  });
  await expect(
    prepararBancoPorPartes(
      e.gl as unknown as WebGLRenderer,
      e.escena,
      new PerspectiveCamera(),
      new AbortController().signal,
      async () => {},
      2,
    ),
  ).rejects.toThrow('GPU');
  expect(e.destino()).toBe('original');
});

it('calienta la salida real con tijera vacía y restaura el área aunque falle', async () => {
  const { calentarSalidaVisible } = await import('./prepararBanco');
  const { Vector4 } = await import('three');
  let destino: unknown = 'destino';
  let tijera = new Vector4(1, 2, 30, 40);
  let recortar = false;
  const gl = {
    getRenderTarget: () => destino,
    setRenderTarget: (d: unknown) => {
      destino = d;
    },
    getScissor: (v: InstanceType<typeof Vector4>) => v.copy(tijera),
    setScissor: (v: InstanceType<typeof Vector4> | number, y?: number, z?: number, w?: number) => {
      tijera = typeof v === 'number' ? new Vector4(v, y, z, w) : v.clone();
    },
    getScissorTest: () => recortar,
    setScissorTest: (v: boolean) => {
      recortar = v;
    },
    render: vi.fn(() => {
      expect(destino).toBeNull();
      expect(recortar).toBe(true);
      expect(tijera.toArray()).toEqual([0, 0, 0, 0]);
      throw new Error('compilación');
    }),
  };
  expect(() =>
    calentarSalidaVisible(gl as unknown as WebGLRenderer, new Scene(), new PerspectiveCamera()),
  ).toThrow('compilación');
  expect(destino).toBe('destino');
  expect(tijera.toArray()).toEqual([1, 2, 30, 40]);
  expect(recortar).toBe(false);
});
