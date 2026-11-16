import { describe, expect, it } from 'vitest';
import { PROGRAMAS, crearOrden, ordenEn, programaPorNombre } from './programa';

describe('programas de mando', () => {
  it('cada programa termina parado y sus tramos van en orden hasta su duración', () => {
    for (const p of PROGRAMAS) {
      const ultimo = p.tramos[p.tramos.length - 1];
      expect(ultimo?.hasta).toBe(p.duracion);
      for (let i = 1; i < p.tramos.length; i++) {
        expect(p.tramos[i]?.hasta).toBeGreaterThan(p.tramos[i - 1]?.hasta ?? 0);
      }
    }
  });

  it('caminar: quieto al principio y luego hacia delante sin correr', () => {
    const p = programaPorNombre('caminar');
    const o = crearOrden();
    expect(ordenEn(p, 0.1, -1, o).magnitud).toBe(0);
    ordenEn(p, 2, 1.9, o);
    expect(o.magnitud).toBe(1);
    expect(o.correr).toBe(false);
    expect(o.dirZ).toBe(1);
  });

  it('un salto se pide una sola vez, en el cuadro que cruza su segundo', () => {
    const p = programaPorNombre('saltar');
    const o = crearOrden();
    let pedidos = 0;
    const dt = 1 / 60;
    for (let t = 0; t < p.duracion; t += dt) if (ordenEn(p, t, t - dt, o).saltar) pedidos++;
    expect(pedidos).toBe(3);
  });

  it('se repite: un salto en el segundo 0,4 vuelve a pedirse en la siguiente vuelta', () => {
    const p = programaPorNombre('saltar');
    const o = crearOrden();
    expect(ordenEn(p, p.duracion + 0.41, p.duracion + 0.39, o).saltar).toBe(true);
  });

  it('un nombre desconocido da el primer programa', () => {
    expect(programaPorNombre('nada').nombre).toBe('caminar');
  });
});
