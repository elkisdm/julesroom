import { describe, expect, it } from 'vitest';
import { crearMando } from '../animacion/avatar';
import {
  crearTeclas,
  DOBLE_CLIC,
  enCampoDeTexto,
  esDobleClic,
  escribirEjes,
  esClic,
  puntoEnPlano,
  registrarTecla,
  soltarTeclas,
} from './entradaAvatar';

describe('teclas del avatar', () => {
  it('WASD y flechas escriben los ejes: arriba/derecha positivos', () => {
    const t = crearTeclas();
    const m = crearMando();
    registrarTecla(t, 'KeyW', true);
    registrarTecla(t, 'ArrowRight', true);
    escribirEjes(t, m);
    expect([m.adelante, m.lateral]).toEqual([1, 1]);
    registrarTecla(t, 'KeyW', false);
    registrarTecla(t, 'KeyS', true);
    registrarTecla(t, 'ArrowRight', false);
    registrarTecla(t, 'KeyA', true);
    escribirEjes(t, m);
    expect([m.adelante, m.lateral]).toEqual([-1, -1]);
  });

  it('teclas opuestas se anulan y las que no son de movimiento se ignoran', () => {
    const t = crearTeclas();
    const m = crearMando();
    registrarTecla(t, 'KeyW', true);
    registrarTecla(t, 'ArrowDown', true);
    expect(registrarTecla(t, 'Space', true)).toBe(false);
    escribirEjes(t, m);
    expect(m.adelante).toBe(0);
    expect(m.lateral).toBe(0);
  });

  it('soltarTeclas deja todo en cero', () => {
    const t = crearTeclas();
    registrarTecla(t, 'KeyD', true);
    soltarTeclas(t);
    expect(t).toEqual(crearTeclas());
  });

  it('no se mueve mientras el foco está en un campo de texto', () => {
    expect(enCampoDeTexto({ tagName: 'input' })).toBe(true);
    expect(enCampoDeTexto({ tagName: 'TEXTAREA' })).toBe(true);
    expect(enCampoDeTexto({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(enCampoDeTexto({ tagName: 'CANVAS' })).toBe(false);
    expect(enCampoDeTexto(null)).toBe(false);
  });
});

describe('clic al piso', () => {
  it('más de 5 px es arrastre (órbita), no clic', () => {
    expect(esClic(100, 100, 103, 104)).toBe(true);
    expect(esClic(100, 100, 106, 100)).toBe(false);
  });

  it('el rayo cruza el plano a la altura pedida', () => {
    const salida = { x: 0, z: 0 };
    // Desde (0, 10, 10) hacia (0, −1, −1): cruza y = 0 en z = 0.
    expect(puntoEnPlano(10, -1, 0, 10, 0, -1, 0, salida)).toBe(true);
    expect(salida.x).toBeCloseTo(0, 9);
    expect(salida.z).toBeCloseTo(0, 9);
    expect(puntoEnPlano(10, -1, 2, 10, 1, -1, 3.9, salida)).toBe(true);
    expect(salida.x).toBeCloseTo(2 + 6.1, 9);
  });

  it('un rayo que sube o es paralelo no da punto', () => {
    const salida = { x: 0, z: 0 };
    expect(puntoEnPlano(10, 1, 0, 0, 0, 1, 0, salida)).toBe(false);
    expect(puntoEnPlano(10, 0, 0, 0, 0, 1, 0, salida)).toBe(false);
  });
});

describe('correr y doble clic', () => {
  it('Shift (izquierda o derecha) pide correr y soltarlo deja de correr', () => {
    const t = crearTeclas();
    const m = crearMando();
    registrarTecla(t, 'ShiftLeft', true);
    escribirEjes(t, m);
    expect(m.correr).toBe(true);
    registrarTecla(t, 'ShiftLeft', false);
    escribirEjes(t, m);
    expect(m.correr).toBe(false);
    registrarTecla(t, 'ShiftRight', true);
    soltarTeclas(t);
    escribirEjes(t, m);
    expect(m.correr).toBe(false);
  });

  it('dos clics cerca y rápido son doble clic; lejos o lentos, no', () => {
    const a = { t: 1000, x: 100, y: 100 };
    expect(esDobleClic(a, 1000 + DOBLE_CLIC.ms - 1, 104, 103)).toBe(true);
    expect(esDobleClic(a, 1000 + DOBLE_CLIC.ms + 1, 100, 100)).toBe(false);
    expect(esDobleClic(a, 1100, 100 + DOBLE_CLIC.px + 5, 100)).toBe(false);
    expect(esDobleClic(null, 1100, 100, 100)).toBe(false);
  });
});
