import { describe, expect, it } from 'vitest';
import {
  indicePorTecla,
  modoPorAtajo,
  cambiarModo,
  normalizarPalanca,
  prepararMensaje,
  vistaInicial,
} from './interaccion';

describe('navegación de opciones', () => {
  it('recorre, envuelve y salta a los extremos', () => {
    expect(indicePorTecla('ArrowDown', 2, 3)).toBe(0);
    expect(indicePorTecla('ArrowUp', 0, 3)).toBe(2);
    expect(indicePorTecla('ArrowRight', 0, 3)).toBe(1);
    expect(indicePorTecla('ArrowLeft', 0, 3)).toBe(2);
    expect(indicePorTecla('Home', 2, 3)).toBe(0);
    expect(indicePorTecla('End', 0, 3)).toBe(2);
  });
  it('no inventa opciones vacías ni consume teclas de escritura', () => {
    expect(indicePorTecla('ArrowDown', 0, 0)).toBeNull();
    expect(indicePorTecla('a', 1, 3)).toBeNull();
  });
});
describe('modos exclusivos y atajos', () => {
  it('repetir el modo lo cierra y elegir otro lo sustituye', () => {
    expect(cambiarModo('construir', 'construir')).toBe('moverse');
    expect(cambiarModo('personas', 'ajustes')).toBe('ajustes');
  });
  it('los atajos exigen Alt y no capturan escritura ni modificadores del sistema', () => {
    expect(modoPorAtajo({ key: '2', altKey: true })).toBe('construir');
    expect(modoPorAtajo({ key: '6', altKey: true })).toBe('ajustes');
    expect(modoPorAtajo({ key: '2', altKey: false })).toBeNull();
    expect(modoPorAtajo({ key: '2', altKey: true, escribiendo: true })).toBeNull();
    expect(modoPorAtajo({ key: '2', altKey: true, metaKey: true })).toBeNull();
    expect(modoPorAtajo({ key: '7', altKey: true })).toBeNull();
    expect(modoPorAtajo({ key: '™', code: 'Digit2', altKey: true })).toBe('construir');
  });
});
describe('palanca y conversación de ejemplo', () => {
  it('limita el gesto al círculo y respeta el centro', () => {
    expect(normalizarPalanca(0, 0, 48)).toEqual({ x: 0, y: 0 });
    const p = normalizarPalanca(100, 100, 48);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(1);
    expect(normalizarPalanca(1, 1, 0)).toEqual({ x: 0, y: 0 });
  });
  it('rechaza mensajes vacíos y acota el texto local', () => {
    expect(prepararMensaje('  ')).toBeNull();
    expect(prepararMensaje(' Hola ')).toBe('Hola');
    expect(prepararMensaje('a'.repeat(800))?.length).toBe(500);
  });
});

describe('encuadre de entrada', () => {
  it('en teléfono muestra al personaje y en escritorio el mundo completo', () => {
    expect(vistaInicial(390)).toBe('seguir');
    expect(vistaInicial(600)).toBe('seguir');
    expect(vistaInicial(601)).toBe('general');
    expect(vistaInicial(1440)).toBe('general');
  });
});
