import { describe, expect, it } from 'vitest';
import { crearSuelo } from '../escenarios/suelo';
import { alturaBajoAsiento, alturaPies } from './apoyoVisual';

const datos: Parameters<typeof crearSuelo>[0] = {
  limites: { x0: -5, x1: 5, z0: -5, z1: 5 },
  superficies: [
    { id: 'piso', tipo: 'losa', forma: 'caja', x0: -5, x1: 5, z0: -5, z1: 5, y: 0, grosor: 0.3 },
    {
      id: 'tarima',
      tipo: 'tarima',
      forma: 'caja',
      x0: 1,
      x1: 3,
      z0: 1,
      z1: 3,
      y: 0.4,
      grosor: 0.3,
    },
  ],
  solidos: [],
};
const suelo = crearSuelo(datos);
const base = { enSuelo: true, estado: 'de-pie', x: 0, z: 0, y: 0.9, ySuelo: 0.9 };

describe('apoyo visual de la marca y las sombras', () => {
  it('en el suelo: el apoyo (en una escalera, la altura del peldaño, no la del piso de abajo)', () => {
    expect(alturaPies(base, suelo)).toBe(0.9);
  });

  it('sentado: el apoyo, no la raíz bajada al asiento', () => {
    expect(alturaPies({ ...base, estado: 'sentado', y: 0.45, ySuelo: 0 }, suelo)).toBe(0);
  });

  it('en el aire sobre una tarima: la cara de la tarima, que es donde aterriza', () => {
    const salto = { ...base, enSuelo: false, x: 2, z: 2, y: 1.1, ySuelo: 0 };
    expect(alturaPies(salto, suelo)).toBeCloseTo(0.4);
  });

  it('en el aire sin nada debajo: el apoyo del despegue', () => {
    expect(alturaPies({ ...base, enSuelo: false, x: 50, y: 1, ySuelo: 0 }, suelo)).toBe(0);
    expect(alturaPies({ ...base, enSuelo: false, y: 1, ySuelo: 0.2 }, null)).toBe(0.2);
  });

  it('persona sentada: el piso bajo el asiento, o el respaldo si no hay', () => {
    expect(alturaBajoAsiento(suelo, 0, 0, 0.45, -1)).toBe(0);
    expect(alturaBajoAsiento(suelo, 50, 0, 0.45, -1)).toBe(-1);
  });
});
