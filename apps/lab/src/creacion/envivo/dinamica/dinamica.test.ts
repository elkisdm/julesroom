import { describe, expect, it } from 'vitest';
import { formarPublico, leerD2, crearCuota, teclaD2 } from './modelo';

describe('dinámica D2', () => {
  it('coloca veinte lugares separados delante del anfitrión', () => {
    const r = formarPublico({ x: 0, y: 0, z: 0, rumbo: 0 }, 20, () => true);
    expect(r).toHaveLength(20);
    expect(r.every((p) => p.z > 0)).toBe(true);
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++)
        expect(Math.hypot(r[i]!.x - r[j]!.x, r[i]!.z - r[j]!.z)).toBeGreaterThanOrEqual(0.95);
  });
  it('omite muebles y no inventa lugares cuando no hay espacio', () => {
    expect(formarPublico({ x: 0, y: 0, z: 0, rumbo: 0 }, 20, () => false)).toEqual([]);
    expect(
      formarPublico({ x: 0, y: 0, z: 0, rumbo: 0 }, 20, (p) => p.x > 2).every((p) => p.x > 2),
    ).toBe(true);
  });
  it('rechaza órdenes de invitados, emisores ausentes y paquetes malformados', () => {
    const msg = JSON.stringify({ tipo: 'd2-parar', revision: 1 });
    expect(leerD2(msg, 'invitado', 'host', ['host', 'invitado'])).toBeNull();
    expect(leerD2(msg, 'host', 'host', ['host'])).toMatchObject({ tipo: 'd2-parar' });
    expect(leerD2('{', 'host', 'host', ['host'])).toBeNull();
    expect(
      leerD2(JSON.stringify({ tipo: 'd2-reaccion', reaccion: 1 }), 'ausente', 'host', ['host']),
    ).toBeNull();
    expect(
      leerD2(JSON.stringify({ tipo: 'd2-reaccion', reaccion: 9 }), 'host', 'host', ['host']),
    ).toBeNull();
  });
  it('limita frecuencia por identidad sin bloquear la otra persona', () => {
    const cuota = crearCuota(800);
    expect(cuota('a', 1000)).toBe(true);
    expect(cuota('a', 1100)).toBe(false);
    expect(cuota('b', 1100)).toBe(true);
    expect(cuota('a', 1800)).toBe(true);
  });
  it('no captura atajos al escribir o con modificadores', () => {
    expect(teclaD2('3', false, false)).toBe(3);
    expect(teclaD2('H', false, false)).toBe('grabar');
    expect(teclaD2('Escape', false, false)).toBe('salir');
    expect(teclaD2('3', true, false)).toBeNull();
    expect(teclaD2('h', false, true)).toBeNull();
  });
});
