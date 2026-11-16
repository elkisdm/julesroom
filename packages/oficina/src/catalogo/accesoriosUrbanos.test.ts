import { describe, expect, it } from 'vitest';
import { catalogoBase } from './base';
import { ACCESORIOS } from '../render/accesorios';
import { alternarPieza } from '../vestuario/resolver';
import { atuendoPorRol } from '../vestuario/roles';
describe('extras urbanos', () => {
  it('los seis extras nuevos tienen zona y dibujo', () => {
    for (const id of [
      'lentes-oscuros',
      'reloj',
      'bufanda-lana',
      'gorro-urbano',
      'audifonos-estudio',
      'mochila-urbana',
    ]) {
      expect(
        catalogoBase.piezas.find((p) => p.id === id),
        id,
      ).toBeDefined();
      expect(ACCESORIOS[id], id).toBeDefined();
    }
  });
  it('reemplaza lentes sin duplicar la zona y los puede quitar', () => {
    const c = { ...catalogoBase, paquetes: [] };
    const a = { ...atuendoPorRol('', 0), acc: ['lentes'] };
    const b = alternarPieza(c, a, 'lentes-oscuros');
    expect(b.acc).toEqual(['lentes-oscuros']);
    expect(alternarPieza(c, b, 'lentes-oscuros').acc).toEqual([]);
  });
});
