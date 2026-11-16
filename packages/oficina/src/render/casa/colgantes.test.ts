import { describe, expect, it } from 'vitest';
import { ambienteDe, cajaDe, plano } from '../../mansion/plano';
import { ALTO_LIBRE } from './arquitectura';
import { colgantes } from './colgantes';

describe('colgantes', () => {
  const lista = colgantes();

  it('cuelgan sobre las mesas de cocina, ventas, finanzas, investigación y el living', () => {
    const ambientes = new Set(lista.map((c) => c.ambiente));
    for (const id of ['cocina', 'ventas', 'finanzas', 'investigacion', 'living']) {
      expect(ambientes.has(id)).toBe(true);
    }
  });

  it('cada colgante queda bajo el cielo de su ambiente, sobre su mueble y con el charco encima', () => {
    for (const c of lista) {
      const a = ambienteDe(c.ambiente);
      const mueble = plano.muebles.find((m) => m.id === c.mueble);
      if (!mueble) throw new Error(`Mueble desconocido: ${c.mueble}`);
      const caja = cajaDe(mueble);
      expect(c.x).toBeGreaterThanOrEqual(caja.x0);
      expect(c.x).toBeLessThanOrEqual(caja.x1);
      expect(c.z).toBeGreaterThanOrEqual(caja.z0);
      expect(c.z).toBeLessThanOrEqual(caja.z1);
      expect(c.yCielo).toBeLessThanOrEqual(a.y + ALTO_LIBRE);
      expect(c.yPantalla).toBeLessThan(c.yCielo);
      expect(c.yPantalla).toBeGreaterThan(c.yCharco + 0.5);
      expect(c.yPiso).toBe(a.y);
      expect(c.yCharco).toBeCloseTo(a.y + mueble.y + mueble.alto + 0.004, 6);
    }
  });
});
