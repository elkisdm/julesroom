import { describe, it, expect } from 'vitest';
import { OBJETOS_NUEVOS, PIEZAS_NUEVAS } from './ampliacion';
import { CATALOGO_OBJETOS, tipoObjeto } from './catalogo';
import { huella } from './rejilla';
describe('catálogo ampliado', () => {
  it('incluye al menos 40 objetos y 10 piezas de construcción, todos únicos', () => {
    expect(
      OBJETOS_NUEVOS.filter((t) => t.categoria !== 'construccion').length,
    ).toBeGreaterThanOrEqual(40);
    expect(
      OBJETOS_NUEVOS.filter((t) => t.categoria === 'construccion').length,
    ).toBeGreaterThanOrEqual(10);
    expect(new Set(CATALOGO_OBJETOS.map((t) => t.tipo)).size).toBe(CATALOGO_OBJETOS.length);
  });
  it('cada ficha declara medidas, pisable, asiento y piezas dentro de su huella', () => {
    for (const t of OBJETOS_NUEVOS) {
      expect(tipoObjeto(t.tipo)).toBe(t);
      expect(typeof t.pisable, t.tipo).toBe('boolean');
      for (const n of [t.ancho, t.alto, t.fondo]) expect(n).toBeGreaterThan(0);
      const partes = PIEZAS_NUEVAS[t.tipo]!;
      expect(partes.length, t.tipo).toBeGreaterThan(0);
      for (const p of partes) {
        expect(
          p.s.every((n) => n > 0),
          t.tipo,
        ).toBe(true);
        expect(Math.abs(p.c[0]) + p.s[0] / 2, t.tipo).toBeLessThanOrEqual(0.501);
        expect(Math.abs(p.c[2]) + p.s[2] / 2, t.tipo).toBeLessThanOrEqual(0.501);
        expect(p.c[1] - p.s[1] / 2, t.tipo).toBeGreaterThanOrEqual(-0.001);
        expect(p.c[1] + p.s[1] / 2, t.tipo).toBeLessThanOrEqual(1.001);
      }
      if (t.sentable) expect(t.asientos?.length, t.tipo).toBeGreaterThan(0);
      const h = huella({ tipo: t.tipo, x: 0, z: 0, giro: 1 });
      expect(h.x1 - h.x0).toBeCloseTo(t.fondo);
      expect(h.z1 - h.z0).toBeCloseTo(t.ancho);
    }
  });
  it('las puertas/arcos tienen colisión por pilares, las tarimas se pisan y las plantas no', () => {
    expect(tipoObjeto('arco-modular')?.colisiones).toHaveLength(5);
    expect(tipoObjeto('tarima')?.pisable).toBe(true);
    expect(tipoObjeto('monstera')?.pisable).toBe(false);
    expect(tipoObjeto('escalones')?.colisiones).toHaveLength(3);
  });
});
