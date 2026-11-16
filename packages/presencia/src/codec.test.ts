import { describe, expect, it } from 'vitest';
import {
  LARGO_PAQUETE,
  VERSION_PAQUETE,
  codificar,
  decodificar,
  esMasNuevo,
  type PaquetePosicion,
} from './codec';

const base: PaquetePosicion = {
  seq: 7,
  x: 1.5,
  y: 0.25,
  z: -3.75,
  rumbo: 1,
  saltos: 3,
  sentado: false,
};

describe('codec', () => {
  it('expone versión 1 y largo 19', () => {
    expect(VERSION_PAQUETE).toBe(1);
    expect(LARGO_PAQUETE).toBe(19);
  });

  it('la altura de una mesa o de un mueble alto viaja sin pérdida y sin cambiar la versión', () => {
    for (const y of [0.74, 0.92, 1, 3.1]) {
      const bytes = codificar({ ...base, y, saltos: 1 });
      expect(bytes[0]).toBe(VERSION_PAQUETE);
      expect(decodificar(bytes)!.y).toBeCloseTo(y, 6);
    }
  });

  it('ida y vuelta conserva los campos', () => {
    const bytes = codificar(base);
    expect(bytes.length).toBe(19);
    const p = decodificar(bytes)!;
    expect(p.seq).toBe(7);
    expect(p.x).toBeCloseTo(1.5);
    expect(p.y).toBeCloseTo(0.25);
    expect(p.z).toBeCloseTo(-3.75);
    expect(p.rumbo).toBeCloseTo(1, 3);
    expect(p.saltos).toBe(3);
    expect(p.sentado).toBe(false);
  });

  it('el bit 0 de flags es sentado', () => {
    const bytes = codificar({ ...base, sentado: true });
    expect(bytes[1]! & 1).toBe(1);
    expect(decodificar(bytes)!.sentado).toBe(true);
  });

  it('usa el destino si se entrega', () => {
    const destino = new Uint8Array(19);
    expect(codificar(base, destino)).toBe(destino);
    expect(decodificar(destino)!.seq).toBe(7);
  });

  it('normaliza rumbo negativo y mayor a 2π', () => {
    expect(decodificar(codificar({ ...base, rumbo: -Math.PI / 2 }))!.rumbo).toBeCloseTo(
      1.5 * Math.PI,
      3,
    );
    expect(decodificar(codificar({ ...base, rumbo: 2 * Math.PI + 1 }))!.rumbo).toBeCloseTo(1, 3);
  });

  it('rumbo cercano a 2π envuelve sin salirse de rango', () => {
    const r = decodificar(codificar({ ...base, rumbo: 2 * Math.PI - 1e-6 }))!.rumbo;
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(2 * Math.PI);
    expect(Math.min(r, 2 * Math.PI - r)).toBeLessThan(1e-3);
  });

  it('saltos y seq envuelven', () => {
    const p = decodificar(codificar({ ...base, saltos: 256, seq: 65536 }))!;
    expect(p.saltos).toBe(0);
    expect(p.seq).toBe(0);
    expect(decodificar(codificar({ ...base, saltos: 255 }))!.saltos).toBe(255);
  });

  it('NaN se sanea a 0 y no rompe', () => {
    const p = decodificar(codificar({ ...base, x: NaN, rumbo: NaN, seq: NaN }))!;
    expect(p.x).toBe(0);
    expect(p.rumbo).toBe(0);
    expect(p.seq).toBe(0);
  });

  it('rechaza largo o versión incorrectos', () => {
    expect(decodificar(new Uint8Array(18))).toBeNull();
    expect(decodificar(new Uint8Array(20))).toBeNull();
    const bytes = codificar(base);
    bytes[0] = 2;
    expect(decodificar(bytes)).toBeNull();
  });

  it('esMasNuevo compara de forma circular', () => {
    expect(esMasNuevo(5, 4)).toBe(true);
    expect(esMasNuevo(4, 5)).toBe(false);
    expect(esMasNuevo(5, 5)).toBe(false);
    expect(esMasNuevo(0, 65535)).toBe(true);
    expect(esMasNuevo(65535, 0)).toBe(false);
    expect(esMasNuevo(100, 65000)).toBe(true);
  });
});
