import { describe, expect, it } from 'vitest';
import {
  escenarioInicial,
  varianteInicial,
  parsearVista,
  propsDeVista,
  serializarVista,
  vistaPorDefecto,
} from './vista';

const ZONAS = ['aula', 'mesas'];

describe('vista', () => {
  it('parsea general, seguir y zona:<id>', () => {
    expect(parsearVista('general', ZONAS)).toBe('general');
    expect(parsearVista('seguir', ZONAS)).toBe('seguir');
    expect(parsearVista('zona:aula', ZONAS)).toEqual({ zona: 'aula' });
  });
  it('un valor inválido o una zona que no existe cae en general', () => {
    expect(parsearVista(null, ZONAS)).toBe('general');
    expect(parsearVista('otra', ZONAS)).toBe('general');
    expect(parsearVista('zona:nada', ZONAS)).toBe('general');
  });
  it('sin vista en la URL, un teléfono vertical abre siguiendo al avatar y el escritorio en general', () => {
    expect(vistaPorDefecto(390, 844)).toBe('seguir');
    expect(vistaPorDefecto(1440, 900)).toBe('general');
    expect(vistaPorDefecto(800, 800)).toBe('general');
  });
  it('serializar y parsear son inversos', () => {
    for (const v of ['general', 'seguir', { zona: 'mesas' }] as const)
      expect(parsearVista(serializarVista(v), ZONAS)).toEqual(v);
  });
  it('solo «seguir» hace que la cámara siga al avatar', () => {
    expect(propsDeVista('seguir').seguirAvatar).toBe(true);
    expect(propsDeVista('general').seguirAvatar).toBe(false);
    expect(propsDeVista({ zona: 'aula' }).vista).toEqual({ zona: 'aula' });
    expect(propsDeVista({ zona: 'aula' }).seguirAvatar).toBe(false);
  });
});

describe('escenario inicial', () => {
  it('respeta el pedido si existe; si no, trading y luego la mansión', () => {
    expect(escenarioInicial('mansion', ['mansion', 'trading'])).toBe('mansion');
    expect(escenarioInicial(null, ['mansion', 'trading'])).toBe('trading');
    expect(escenarioInicial('x', ['mansion'])).toBe('mansion');
  });
});

describe('varianteInicial', () => {
  it('la pedida si existe; si no, ninguna (el motor usa la primera)', () => {
    expect(varianteInicial('tarde', ['manana', 'tarde'])).toBe('tarde');
    expect(varianteInicial('noche', ['manana', 'tarde'])).toBeUndefined();
    expect(varianteInicial(null, ['manana', 'tarde'])).toBeUndefined();
  });
});
