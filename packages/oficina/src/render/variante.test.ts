import { describe, expect, it } from 'vitest';
import { paletaLuz } from './casa/luz';
import { paletaConVariante } from './variante';

describe('paletaConVariante', () => {
  const base = paletaLuz(18.4);

  it('sin sol en la variante deja la paleta intacta', () => {
    expect(paletaConVariante(base, { hora: 18.4 })).toBe(base);
  });

  it('con sol: lo normaliza y deja lo demás como estaba', () => {
    const p = paletaConVariante(base, { hora: 18.4, sol: { x: -3, y: 0, z: -4 } });
    expect(p.sol.direccion.x).toBeCloseTo(-0.6);
    expect(p.sol.direccion.z).toBeCloseTo(-0.8);
    expect(p.sol.color).toBe(base.sol.color);
    expect(p.sol.intensidad).toBe(base.sol.intensidad);
    expect(p.hemisferio).toBe(base.hemisferio);
  });

  it('un sol de largo cero se ignora', () => {
    expect(paletaConVariante(base, { hora: 1, sol: { x: 0, y: 0, z: 0 } })).toBe(base);
  });
});
