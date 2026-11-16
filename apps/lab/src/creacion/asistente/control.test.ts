import { describe, expect, it } from 'vitest';
import {
  puedeInteractuar,
  reconocerOrden,
  crearEstado,
  ordenar,
  actualizar,
  etiqueta,
} from './control';
const p = { x: 0, y: 0, z: 0 };
describe('órdenes de Jules', () => {
  it.each([
    ['jules espera', 'esperar'],
    ['JULES ESPERA', 'esperar'],
    ['deja de seguirme', 'esperar'],
    ['ven', 'venir'],
    ['Jules, ven aquí', 'venir'],
    ['sígueme', 'seguir'],
    ['SIGUEME', 'seguir'],
    ['quédate', 'esperar'],
    ['QUEDATE AQUI', 'esperar'],
    ['Jules sígueme por favor', 'seguir'],
    ['vuelve a tu puesto', 'puesto'],
    ['@Jules vuelve a tu puesto', 'puesto'],
    ['Jules, no me sigas', 'esperar'],
    ['espera aquí', 'esperar'],
    ['ven conmigo', 'venir'],
    ['me gustaría que me sigas', null],
    ['el evento es mañana', null],
    ['no vengas', null],
    ['no me esperes', null],
    ['sígueme en instagram', null],
    ['quédate con el cambio', null],
    ['vender', null],
    ['hola jules', null],
    ['siguiente', null],
  ])('%s → %s', (texto, orden) => expect(reconocerOrden(texto)).toBe(orden));
  it('espera por defecto, sigue explícitamente y congela al esperar', () => {
    const e = crearEstado(p);
    expect(e.modo).toBe('esperar');
    ordenar(e, 'seguir', p, p);
    expect(etiqueta(e)).toBe('te sigue');
    ordenar(e, 'esperar', { x: 3, y: 0, z: 2 }, p);
    expect(e.destino).toEqual({ x: 3, y: 0, z: 2 });
    actualizar(e, p, { x: 9, y: 0, z: 9 });
    expect(e.modo).toBe('esperar');
  });
  it('venir sigue la llamada hasta llegar y luego espera; puesto vuelve al origen', () => {
    const e = crearEstado(p),
      yo = { x: 6, y: 0, z: 0 };
    ordenar(e, 'venir', p, yo);
    actualizar(e, p, yo);
    expect(e.modo).toBe('venir');
    actualizar(e, { x: 4.5, y: 0, z: 0 }, yo);
    expect(e.modo).toBe('esperar');
    ordenar(e, 'puesto', yo, yo);
    expect(e.destino).toEqual(p);
    actualizar(e, p, yo);
    expect(e.modo).toBe('esperar');
  });
  it('guía termina al llegar y una orden la interrumpe', () => {
    const e = crearEstado(p);
    ordenar(e, 'guiar', p, p, { x: 4, y: 0, z: 0 });
    expect(e.modo).toBe('guiar');
    actualizar(e, { x: 4, y: 0, z: 0 }, p);
    expect(e.modo).toBe('esperar');
    ordenar(e, 'guiar', p, p, { x: 8, y: 0, z: 0 });
    ordenar(e, 'esperar', p, p);
    expect(e.destino).toEqual(p);
  });
});

describe('prioridad de E', () => {
  const yo = { ...p, estado: 'de-pie' };
  const jules = { ...p, x: 2 };
  it('abre Jules cerca, pero no roba E a un asiento más cercano', () => {
    expect(puedeInteractuar(jules, yo, [])).toBe(true);
    expect(puedeInteractuar(jules, yo, [{ ...p, x: 1, radio: 1.3 }])).toBe(false);
    expect(puedeInteractuar(jules, yo, [{ ...p, x: 3, radio: 1.3 }])).toBe(true);
  });
  it('permite levantarse y no abre Jules desde lejos', () => {
    expect(puedeInteractuar(jules, { ...yo, estado: 'sentado' }, [])).toBe(false);
    expect(puedeInteractuar({ ...p, x: 4 }, yo, [])).toBe(false);
  });
});
