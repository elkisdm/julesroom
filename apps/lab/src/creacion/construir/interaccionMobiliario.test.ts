import { describe, expect, it } from 'vitest';
import { encuadreGeneral, escenarioOficina, escenarioTrading } from '@oficina/motor';
import type { Encuadre } from '@oficina/motor';
import {
  cajaDesplazada,
  encuadreConstruir,
  estadoDeMotivo,
  filasDeAjustes,
  ndcSobreElDedo,
} from './interaccionMobiliario';

function elevacion(e: Encuadre): number {
  const dx = e.posicion.x - e.objetivo.x;
  const dy = e.posicion.y - e.objetivo.y;
  const dz = e.posicion.z - e.objetivo.z;
  return Math.atan2(dy, Math.hypot(dx, dz));
}

function distancia(e: Encuadre): number {
  return Math.hypot(
    e.posicion.x - e.objetivo.x,
    e.posicion.y - e.objetivo.y,
    e.posicion.z - e.objetivo.z,
  );
}

describe('estadoDeMotivo', () => {
  it('traduce los motivos del motor al color del fantasma', () => {
    expect(estadoDeMotivo(null)).toBe('libre');
    expect(estadoDeMotivo('Queda fuera de la sala.')).toBe('fuera');
    expect(estadoDeMotivo('Choca con un muro o tabique.')).toBe('choca');
    expect(estadoDeMotivo('Queda encima de la mesa baja.')).toBe('choca');
    expect(estadoDeMotivo('Corta el camino de las personas (desde mesa).')).toBe('bloquea');
    expect(estadoDeMotivo('Corta el paseo de las personas.')).toBe('bloquea');
  });
});

describe('filasDeAjustes', () => {
  it('lista lo movido y lo quitado, e ignora un id que ya no está en la plantilla', () => {
    const filas = filasDeAjustes(escenarioTrading, {
      sofa: { x: 1, z: 2, giro: 0 },
      pufs: 'quitado',
      'ya-no': 'quitado',
    });
    expect(filas.map((f) => f.id)).toEqual(['sofa', 'pufs']);
    expect(filas[0]?.estado).toBe('movido');
    expect(filas[0]?.nombre.length).toBeGreaterThan(2);
    expect(filas[1]?.estado).toBe('quitado');
  });
});

describe('cajaDesplazada', () => {
  it('traslada la huella sin cambiar su tamaño', () => {
    expect(cajaDesplazada({ x0: 0, x1: 2, z0: -1, z1: 1 }, 3, -0.5)).toEqual({
      x0: 3,
      x1: 5,
      z0: -1.5,
      z1: 0.5,
    });
  });
});

describe('ndcSobreElDedo', () => {
  it('el punto queda por encima del dedo', () => {
    const rect = { left: 0, top: 0, width: 390, height: 844 };
    const dedo = ndcSobreElDedo(200, 600, rect, 0);
    const arriba = ndcSobreElDedo(200, 600, rect, 84);
    expect(arriba.x).toBeCloseTo(dedo.x);
    expect(arriba.y).toBeGreaterThan(dedo.y);
  });
});

describe('encuadreConstruir', () => {
  it('en horizontal no cambia la vista', () => {
    expect(encuadreConstruir(escenarioTrading.vistas, 1440, 900)).toBeNull();
    expect(encuadreConstruir(escenarioOficina.vistas, 1440, 900)).toBeNull();
  });

  it.each([
    ['trading', escenarioTrading.vistas],
    ['oficina', escenarioOficina.vistas],
  ] as const)('en %s vertical se acerca y mira más al piso', (_nombre, vistas) => {
    for (const [ancho, alto] of [
      [390, 844],
      [320, 640],
    ] as const) {
      const general = encuadreGeneral(vistas, ancho, alto);
      const enc = encuadreConstruir(vistas, ancho, alto);
      expect(enc, `${ancho}×${alto}`).not.toBeNull();
      expect(elevacion(enc!)).toBeGreaterThan(50 * (Math.PI / 180));
      expect(distancia(enc!)).toBeLessThan(distancia(general) - 0.5);
      expect(enc!.objetivo.y).toBeLessThan(2);
    }
  });
});
