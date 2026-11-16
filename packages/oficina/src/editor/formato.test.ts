import { describe, expect, it } from 'vitest';
import { ejemploEquipo, validarDefinicion } from '../definicion/definicion';
import '../index';
import {
  aDefinicion,
  migrarDefinicion,
  mundoVacio,
  parsearSala,
  serializarSala,
  validarSala,
  type ObjetoColocado,
  type SalaGuardada,
} from './formato';

const base = { ...ejemploEquipo, plano: { plantilla: 'trading' } };
const sala = (): SalaGuardada => migrarDefinicion(base);
const con = (m: Partial<SalaGuardada['mundo']>): SalaGuardada => ({
  ...sala(),
  mundo: { ...mundoVacio(), ...m },
});
const obj = (id: string, extra: Partial<ObjetoColocado> = {}): ObjetoColocado => ({
  id,
  tipo: 'planta-grande',
  x: 0,
  z: 0,
  giro: 0,
  ...extra,
});

describe('formato de sala', () => {
  it('migrarDefinicion: versión 2 con el mundo vacío; aDefinicion vuelve a una v1 válida', () => {
    const s = sala();
    expect(s.version).toBe(2);
    expect(s.mundo).toEqual(mundoVacio());
    const d = aDefinicion({ ...s, equipo: 'Eq' });
    expect(d).toEqual(base);
    expect(validarDefinicion(d).ok).toBe(true);
  });

  it('una sala válida pasa; ida y vuelta por texto', () => {
    const s = con({ objetos: [obj('obj-1')], variante: 'x' });
    expect(validarSala(s)).toEqual({ ok: true, errores: [] });
    const r = parsearSala(serializarSala(s));
    expect(r).toEqual({ ok: true, sala: s });
  });

  it.each([
    ['tipo desconocido', con({ objetos: [obj('a', { tipo: 'nada' })] }), /tipo/],
    ['ids repetidos', con({ objetos: [obj('a'), obj('a')] }), /repetido/],
    ['giro fuera de rango', con({ objetos: [obj('a', { giro: 4 as never })] }), /giro/],
    ['número no finito', con({ objetos: [obj('a', { x: Infinity })] }), /x/],
    ['pantalla con contenido inválido', con({ pantallas: { muro: 'otro' as never } }), /pantallas/],
    ['puesto de un ocupante inexistente', con({ puestos: { fantasma: 'l1' } }), /puestos/],
  ])('rechaza: %s', (_n, s, re) => {
    const r = validarSala(s);
    expect(r.ok).toBe(false);
    expect(r.errores.join(' ')).toMatch(re);
  });

  it('rechaza pasar el tope de objetos y respeta límites propios', () => {
    const s = con({ objetos: [obj('a'), obj('b')] });
    const r = validarSala(s, {
      maxObjetos: 1,
      paso: 0.5,
      historia: 1,
      celdaPaso: 0.25,
      anchoPaso: 0.6,
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' ')).toMatch(/1 objetos/);
  });

  it('también valida la proyección v1 (plantilla desconocida)', () => {
    const s = { ...sala(), plano: { plantilla: 'no-existe' } };
    expect(validarSala(s).ok).toBe(false);
  });

  it('validarSala no lanza con basura', () => {
    expect(validarSala(null).ok).toBe(false);
    expect(validarSala({ version: 2 }).ok).toBe(false);
  });

  it('parsearSala acepta una v1 y la migra', () => {
    const r = parsearSala(JSON.stringify(base));
    expect(r.ok && r.sala).toEqual(sala());
  });

  it('parsearSala: versión más nueva y JSON inválido dan errores legibles', () => {
    const n = parsearSala(JSON.stringify({ ...sala(), version: 3 }));
    expect(n.ok).toBe(false);
    expect(!n.ok && n.errores[0]).toMatch(/versión más nueva \(3\)/);
    const j = parsearSala('{roto');
    expect(!j.ok && j.errores[0]).toMatch(/JSON/);
  });
});
