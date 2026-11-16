import { describe, expect, it } from 'vitest';
import { colocarPantalla, encuadrarPantalla, cabePantalla } from './colocacion';
import { escenarioOficina } from '@oficina/motor';
import type { Escenario } from '@oficina/motor';
const sala = (
  ancho: number,
  cajas: { x0: number; x1: number; z0: number; z1: number }[] = [],
): Escenario => ({
  ...escenarioOficina,
  suelo: undefined,
  planta: { ...escenarioOficina.planta, muebles: [] },
  entradas: [{ x: 0, y: 0, z: 0, yaw: 0 }],
  colision: () => ({ limites: { x0: -ancho / 2, x1: ancho / 2, z0: -10, z1: 10 }, cajas }),
});
describe('pantalla apoyada y libre', () => {
  it('coloca seis metros frente al anfitrión y orientada hacia él', () => {
    const p = colocarPantalla(sala(20), { x: 0, y: 0, z: 0, rumbo: 0 });
    expect(p).toMatchObject({ ancho: 6, y: 0, x: 0 });
    expect(p!.z).toBeGreaterThan(0);
    expect(Math.cos(p!.giro)).toBeCloseTo(-1);
  });
  it('reduce el ancho si no cabe y no cruza un muro', () => {
    const e = sala(4, [{ x0: -2, x1: 2, z0: 3.8, z1: 4.2 }]);
    const p = colocarPantalla(e, { x: 0, y: 0, z: 0, rumbo: 0 });
    expect(p).not.toBeNull();
    expect(p!.ancho).toBeLessThan(4);
    expect(cabePantalla(e, p!)).toBe(true);
    expect(cabePantalla(e, { ...p!, z: 4 })).toBe(false);
  });
  it('rechaza un espacio sin ancho mínimo', () => {
    expect(colocarPantalla(sala(1), { x: 0, y: 0, z: 0, rumbo: 0 })).toBeNull();
  });
  it('encuadra 16:9 en horizontal y vertical desde la normal de la pantalla', () => {
    const p = { x: 0, y: 0, z: 3, giro: 0, ancho: 6 };
    const h = encuadrarPantalla(p, 28, 16 / 9);
    const v = encuadrarPantalla(p, 28, 9 / 16);
    expect(h.posicion.z).toBeGreaterThan(p.z);
    expect(v.posicion.z).toBeGreaterThan(h.posicion.z);
    expect(h.posicion.y).toBeCloseTo(h.objetivo.y);
  });
});
