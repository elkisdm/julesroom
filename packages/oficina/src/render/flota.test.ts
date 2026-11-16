import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  Matrix4,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three';
import type { BatchedMesh, InstancedMesh, Object3D } from 'three';
import { Flota, normalizarParaLote } from './flota';
import type { Familia } from './flota';
import { uvDeCelda } from './celdas';

const caja = new BoxGeometry(1, 1, 1);
const esfera = new SphereGeometry(0.5, 8, 6);
const plano = { clave: 'plano', material: new MeshBasicMaterial() } satisfies Familia;
const otra = { clave: 'otra', material: new MeshBasicMaterial() } satisfies Familia;
const conAtlas = {
  clave: 'atlas',
  material: new MeshBasicMaterial(),
  atlas: { columnas: 2, filas: 2, celdaAncho: 64, celdaAlto: 64, margen: 2 },
} satisfies Familia;

const mallas = (flota: Flota) => flota.raiz.children as InstancedMesh[];
const lotes = (flota: Flota) =>
  flota.raiz.children.filter((o: Object3D) => (o as BatchedMesh).isBatchedMesh) as BatchedMesh[];
const visibles = (b: BatchedMesh) => {
  let c = 0;
  for (let i = 0; i < b.maxInstanceCount; i++) if (b.getVisibleAt(i)) c++;
  return c;
};
const traslacion = (x: number, y = 0, z = 0) => new Matrix4().makeTranslation(x, y, z);
const x = (b: BatchedMesh, i: number) => b.getMatrixAt(i, new Matrix4())?.elements[12];
const rgb = (b: BatchedMesh, i: number) => {
  const c = new Color();
  b.getColorAt(i, c);
  return c.toArray();
};

describe('Flota', () => {
  it('varias geometrías de una familia sin atlas producen un solo lote visible', () => {
    const flota = new Flota();
    flota.inicio();
    flota.agregar(caja, plano, traslacion(1), null, 0);
    flota.agregar(esfera, plano, traslacion(2), null, 0);
    flota.agregar(caja, plano, traslacion(3), null, 0);
    flota.fin();
    const vis = lotes(flota).filter((b) => b.visible);
    expect(vis).toHaveLength(1);
    expect(visibles(vis[0] as BatchedMesh)).toBe(3);
    expect(vis[0]?.frustumCulled).toBe(false);
    expect(vis[0]?.sortObjects).toBe(false);
    expect(vis[0]?.perObjectFrustumCulled).toBe(false);
  });

  it('dos familias producen dos lotes', () => {
    const flota = new Flota();
    flota.inicio();
    flota.agregar(caja, plano, traslacion(1), null, 0);
    flota.agregar(caja, otra, traslacion(2), null, 0);
    flota.fin();
    expect(lotes(flota)).toHaveLength(2);
  });

  it('escribe la matriz de cada instancia en orden y la geometría correcta', () => {
    const flota = new Flota();
    flota.inicio();
    flota.agregar(caja, plano, traslacion(5, 6, 7), null, 0);
    flota.agregar(esfera, plano, traslacion(8), null, 0);
    flota.fin();
    const b = lotes(flota)[0] as BatchedMesh;
    expect(x(b, 0)).toBe(5);
    expect(x(b, 1)).toBe(8);
    expect(b.getGeometryIdAt(0)).not.toBe(b.getGeometryIdAt(1));
  });

  it('color null deja blanco y un color se escribe por instancia', () => {
    const flota = new Flota();
    flota.inicio();
    flota.agregar(caja, plano, traslacion(0), new Color(1, 0, 0), 0);
    flota.agregar(caja, plano, traslacion(1), null, 0);
    flota.fin();
    flota.inicio();
    flota.agregar(caja, plano, traslacion(0), null, 0);
    flota.fin();
    const b = lotes(flota)[0] as BatchedMesh;
    expect(rgb(b, 0)).toEqual([1, 1, 1]);
  });

  it('las instancias se compactan: 3 y luego 1 deja una sola visible', () => {
    const flota = new Flota();
    flota.inicio();
    for (let i = 0; i < 3; i++) flota.agregar(caja, plano, traslacion(i), null, 0);
    flota.fin();
    flota.inicio();
    flota.agregar(caja, plano, traslacion(9), null, 0);
    flota.fin();
    const b = lotes(flota)[0] as BatchedMesh;
    expect(visibles(b)).toBe(1);
    expect(x(b, 0)).toBe(9);
  });

  it('un cuadro sin piezas oculta el lote', () => {
    const flota = new Flota();
    flota.inicio();
    flota.agregar(caja, plano, traslacion(1), null, 0);
    flota.fin();
    flota.inicio();
    flota.fin();
    const b = lotes(flota)[0] as BatchedMesh;
    expect(b.visible).toBe(false);
    expect(visibles(b)).toBe(0);
  });

  it('crece más allá de la capacidad inicial conservando matrices y colores del cuadro', () => {
    const flota = new Flota();
    flota.inicio();
    for (let i = 0; i < 100; i++) {
      flota.agregar(caja, plano, traslacion(i), new Color(i / 100, 0.5, 0), 0);
    }
    flota.fin();
    expect(lotes(flota)).toHaveLength(1);
    const b = lotes(flota)[0] as BatchedMesh;
    expect(visibles(b)).toBe(100);
    for (const i of [0, 15, 16, 31, 32, 99]) {
      expect(x(b, i)).toBe(i);
      expect(rgb(b, i)[0]).toBeCloseTo(i / 100, 5);
    }
  });

  it('una geometría nueva con el lote lleno de vértices no pierde lo anterior', () => {
    const flota = new Flota();
    flota.inicio();
    const distintas = Array.from({ length: 60 }, () => new BoxGeometry(1, 1, 1));
    distintas.forEach((g, i) => flota.agregar(g, plano, traslacion(i), new Color(0, i / 60, 0), 0));
    flota.fin();
    expect(lotes(flota)).toHaveLength(1);
    const b = lotes(flota)[0] as BatchedMesh;
    expect(visibles(b)).toBe(60);
    for (const i of [0, 10, 59]) {
      expect(x(b, i)).toBe(i);
      expect(rgb(b, i)[1]).toBeCloseTo(i / 60, 5);
    }
  });

  it('una geometría nueva con el lote lleno de instancias tampoco pierde lo anterior', () => {
    const flota = new Flota();
    flota.inicio();
    for (let i = 0; i < 16; i++) flota.agregar(caja, plano, traslacion(i), null, 0);
    flota.agregar(esfera, plano, traslacion(77), null, 0);
    flota.fin();
    const b = lotes(flota)[0] as BatchedMesh;
    expect(visibles(b)).toBe(17);
    expect(x(b, 3)).toBe(3);
    expect(x(b, 16)).toBe(77);
  });

  it('las familias con atlas siguen siendo InstancedMesh con su desplazamiento UV', () => {
    const flota = new Flota();
    flota.inicio();
    flota.agregar(caja, conAtlas, traslacion(0), null, 3);
    flota.fin();
    expect(lotes(flota)).toHaveLength(0);
    const malla = mallas(flota)[0] as InstancedMesh;
    expect(malla.isInstancedMesh).toBe(true);
    const atributo = malla.geometry.getAttribute('aAtlas');
    const esperado = { x: 0, y: 0 };
    uvDeCelda(conAtlas.atlas, 3, esperado);
    expect(atributo.getX(0)).toBeCloseTo(esperado.x, 6);
    expect(atributo.getY(0)).toBeCloseTo(esperado.y, 6);
  });

  it('con atlas no toca la geometría compartida', () => {
    const flota = new Flota();
    flota.inicio();
    flota.agregar(caja, conAtlas, traslacion(0), null, 0);
    flota.fin();
    expect(caja.getAttribute('aAtlas')).toBeUndefined();
  });

  it('fijarSombras llega a lotes y mallas, existentes y nuevos', () => {
    const flota = new Flota();
    flota.inicio();
    flota.agregar(caja, plano, traslacion(0), null, 0);
    flota.agregar(caja, conAtlas, traslacion(0), null, 0);
    flota.fin();
    flota.fijarSombras(true);
    flota.inicio();
    flota.agregar(caja, otra, traslacion(0), null, 0);
    flota.fin();
    expect(flota.raiz.children).toHaveLength(3);
    expect(flota.raiz.children.map((m) => m.castShadow)).toEqual([true, true, true]);
  });

  it('liberar deja la flota vacía y reutilizable', () => {
    const flota = new Flota();
    flota.inicio();
    flota.agregar(caja, plano, traslacion(0), null, 0);
    flota.agregar(caja, conAtlas, traslacion(0), null, 0);
    flota.fin();
    flota.liberar();
    expect(flota.raiz.children).toHaveLength(0);
    flota.inicio();
    flota.agregar(caja, plano, traslacion(0), null, 0);
    flota.fin();
    expect(lotes(flota)).toHaveLength(1);
  });

  describe('normalizarParaLote', () => {
    const sinIndice = () => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
      g.setAttribute('color', new Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3));
      return g;
    };
    const sinUv = () => {
      const g = new BoxGeometry(1, 1, 1);
      g.deleteAttribute('uv');
      return g;
    };

    it('una geometría no indexada y otra sin uv conviven en un lote sin lanzar', () => {
      const flota = new Flota();
      flota.inicio();
      expect(() => {
        flota.agregar(caja, plano, traslacion(1), null, 0);
        flota.agregar(sinIndice(), plano, traslacion(2), null, 0);
        flota.agregar(sinUv(), plano, traslacion(3), null, 0);
        flota.fin();
      }).not.toThrow();
      expect(visibles(lotes(flota)[0] as BatchedMesh)).toBe(3);
    });

    it('no muta la geometría original', () => {
      const g = sinIndice();
      const n = normalizarParaLote(g);
      expect(n).not.toBe(g);
      expect(g.getIndex()).toBeNull();
      expect(Object.keys(g.attributes).sort()).toEqual(['color', 'position']);
      expect(n.getIndex()?.count).toBe(3);
      expect(Object.keys(n.attributes).sort()).toEqual(['normal', 'position', 'uv']);
      expect(n.getAttribute('uv').itemSize).toBe(2);
      expect(n.groups).toHaveLength(0);
    });

    it('devuelve el mismo clon en la segunda llamada', () => {
      const g = sinIndice();
      expect(normalizarParaLote(g)).toBe(normalizarParaLote(g));
    });

    it('una geometría que ya cumple conserva su índice', () => {
      const n = normalizarParaLote(caja);
      expect(n.getIndex()?.count).toBe(caja.getIndex()?.count);
      expect(Object.keys(n.attributes).sort()).toEqual(['normal', 'position', 'uv']);
    });
  });
});
