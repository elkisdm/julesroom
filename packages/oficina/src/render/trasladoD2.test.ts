import { describe, it, expect } from 'vitest';
import { crearAvatar, crearMando } from '../animacion/avatar';
import { crearMapaDeCajas } from '../animacion/colision';
import { consumirTrasladoD2, type MandoD2 } from './trasladoD2';
const mapa = crearMapaDeCajas([{ x0: 2, x1: 4, z0: 2, z1: 4 }], {
  x0: -10,
  x1: 10,
  z0: -10,
  z1: 10,
});
describe('traslado local consentido D2', () => {
  it('consume una orden y reinicia la locomoción con el rumbo del anfitrión', () => {
    const a = crearAvatar(0, 0, 0);
    const m: MandoD2 = crearMando();
    m.trasladoD2 = { x: 1, y: 0, z: 1, rumbo: 1 };
    expect(consumirTrasladoD2(m, a, mapa)).toBe(true);
    expect(a.x).toBe(1);
    expect(a.rumbo).toBe(1);
    expect(m.trasladoD2).toBeUndefined();
  });
  it('rechaza una orden dentro de un mueble sin mover el avatar', () => {
    const a = crearAvatar(0, 0, 0);
    const m: MandoD2 = crearMando();
    m.trasladoD2 = { x: 3, y: 0, z: 3, rumbo: 0 };
    expect(consumirTrasladoD2(m, a, mapa)).toBe(false);
    expect(a.x).toBe(0);
  });
  it('rechaza un destino fuera de los límites del mapa', () => {
    const a = crearAvatar(0, 0, 0);
    const m: MandoD2 = crearMando();
    m.trasladoD2 = { x: 50, y: 0, z: 0, rumbo: 0 };
    expect(consumirTrasladoD2(m, a, mapa)).toBe(false);
    expect(a.x).toBe(0);
  });
});
