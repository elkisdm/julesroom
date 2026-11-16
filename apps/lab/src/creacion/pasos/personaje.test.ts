import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { atuendoInicial } from '../plantillas';
import {
  categorias,
  cambiar,
  deshacer,
  navegar,
  sorprender,
  seleccionar,
  vistaPorPaso,
} from './estadoPersonaje';
import { areaVestidor, encuadreVestidor } from './encuadreVestidor';

const inicial = atuendoInicial(3);
describe('estado del vestidor', () => {
  it('sorprende con semilla reproducible, sin repetir ni mutar el actual', () => {
    const copia = structuredClone(inicial);
    for (let semilla = 0; semilla < 150; semilla++) {
      const nuevo = sorprender(inicial, semilla);
      expect(nuevo).toEqual(sorprender(inicial, semilla));
      expect(nuevo).not.toEqual(inicial);
      expect(sorprender(nuevo, semilla)).not.toEqual(nuevo);
    }
    expect(inicial).toEqual(copia);
  });
  it('deshace exactamente un cambio y no inventa historial', () => {
    const vacio = { actual: inicial, anterior: null };
    expect(deshacer(vacio)).toBe(vacio);
    const nuevo = cambiar(vacio, sorprender(inicial, 42));
    expect(nuevo.anterior).toEqual(inicial);
    expect(deshacer(nuevo)).toEqual(vacio);
    expect(cambiar(vacio, structuredClone(inicial))).toBe(vacio);
  });
  it('recorre todas las categorías y opciones con vuelta en ambos bordes', () => {
    categorias.forEach((c, categoria) => {
      const n = c.opciones.length;
      expect(navegar({ categoria, opcion: n - 1 }, 'ArrowRight').opcion).toBe(0);
      expect(navegar({ categoria, opcion: 0 }, 'ArrowLeft').opcion).toBe(n - 1);
      expect(navegar({ categoria, opcion: 0 }, 'ArrowDown').categoria).toBe(
        (categoria + 1) % categorias.length,
      );
      expect(navegar({ categoria, opcion: 0 }, 'ArrowUp').categoria).toBe(
        (categoria + categorias.length - 1) % categorias.length,
      );
    });
  });
  it('selecciona todo el catálogo sin mutar, y respeta las zonas de extras', () => {
    for (const cat of categorias)
      for (const opcion of cat.opciones) {
        const copia = structuredClone(inicial);
        const nuevo = seleccionar(inicial, cat, opcion.id);
        expect(inicial).toEqual(copia);
        if (cat.id !== 'acc') expect(nuevo[cat.id]).toBe(opcion.id);
        else if (opcion.id) expect(nuevo.acc).toContain(opcion.id);
        else expect(nuevo.acc).toEqual([]);
      }
    const extras = categorias.find((c) => c.id === 'acc')!;
    const gorro = seleccionar(inicial, extras, 'gorro');
    const gorra = seleccionar(gorro, extras, 'gorra');
    expect(gorra.acc).toContain('gorra');
    expect(gorra.acc).not.toContain('gorro');
    expect(seleccionar(gorra, extras, 'gorra').acc).not.toContain('gorra');
  });
  it('preserva las vistas fuera del paso personaje', () => {
    expect(vistaPorPaso('personaje', false, 'mesa')).toBe('general');
    for (const paso of ['llegada', 'sala', 'nombre', 'invitar'])
      expect(vistaPorPaso(paso, false, 'mesa')).toBe('general');
    expect(vistaPorPaso('dentro', false, 'mesa')).toBe('seguir');
    expect(vistaPorPaso('dentro', true, 'mesa')).toBe('general');
    expect(vistaPorPaso('agentes', false, 'mesa')).toEqual({ zona: 'mesa' });
    expect(vistaPorPaso('agentes', false)).toBe('general');
  });
});
describe('encuadre frontal', () => {
  it.each([
    [1440, 900],
    [390, 844],
    [320, 640],
  ])('cabe completo en %i×%i, incluso con accesorios', (ancho, alto) => {
    const pies = { x: 3, y: 2, z: -1 };
    const e = encuadreVestidor(ancho, alto, pies, false);
    const camera = new PerspectiveCamera(28, ancho / alto, 0.1, 1000);
    camera.position.copy(new Vector3(e.posicion.x, e.posicion.y, e.posicion.z));
    camera.lookAt(e.objetivo.x, e.objetivo.y, e.objetivo.z);
    camera.updateMatrixWorld();
    const area = areaVestidor(ancho, alto);
    for (const x of [-0.6, 0.6])
      for (const y of [0, 2.1])
        for (const z of [-0.3, 0.3]) {
          const p = new Vector3(pies.x + x, pies.y + y, pies.z + z).project(camera);
          const sx = ((p.x + 1) * ancho) / 2,
            sy = ((1 - p.y) * alto) / 2;
          expect(sx).toBeGreaterThan(area.x);
          expect(sx).toBeLessThan(area.x + area.ancho);
          expect(sy).toBeGreaterThan(area.y);
          expect(sy).toBeLessThan(area.y + area.alto);
        }
    expect(encuadreVestidor(ancho, alto, pies, true).distancia).toBeLessThan(e.distancia);
  });
});

describe('control temporal de cámara', () => {
  it('restaura cámara y controles al salir, incluso al volver al nombre', async () => {
    const { tomarCamara } = await import('./controlCamaraVestidor');
    const camera = new PerspectiveCamera(28, 1.6, 0.1, 100);
    camera.position.set(3, 7, 12);
    camera.lookAt(0, 1, 0);
    const posicion = camera.position.clone(),
      orientacion = camera.quaternion.clone();
    const controles = { enabled: true };
    const restaurar = tomarCamara(camera, controles);
    expect(controles.enabled).toBe(false);
    camera.position.set(100, 200, 300);
    camera.lookAt(4, 5, 6);
    restaurar();
    expect(controles.enabled).toBe(true);
    expect(camera.position).toEqual(posicion);
    expect(camera.quaternion.toArray()).toEqual(orientacion.toArray());
  });
  it('conserva los controles ya deshabilitados y admite una escena sin órbita', async () => {
    const { tomarCamara } = await import('./controlCamaraVestidor');
    const camera = new PerspectiveCamera();
    const controles = { enabled: false };
    tomarCamara(camera, controles)();
    expect(controles.enabled).toBe(false);
    expect(() => tomarCamara(camera, null)()).not.toThrow();
  });
});
