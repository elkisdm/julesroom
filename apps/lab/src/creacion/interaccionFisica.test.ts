import { describe, expect, it, vi } from 'vitest';
import {
  crearAccionesHablar,
  actualizarAccionesHablar,
  miradasCercanas,
} from './interaccionFisica';
import type { OcupanteAgente } from '@oficina/motor';
const agentes = [{ id: 'a', nombre: 'Nova', tipo: 'agente' }] as OcupanteAgente[];
describe('interacción física con agentes', () => {
  it('usa posiciones vivas, excluye rigs ausentes y saluda solo al ejecutar la acción extra', () => {
    const hablar = vi.fn(),
      acciones = crearAccionesHablar(agentes, hablar);
    expect(acciones[0]?.x).toBe(Infinity);
    expect(hablar).not.toHaveBeenCalled();
    actualizarAccionesHablar(acciones, () => ({ x: 2, y: 0, z: 3, rumbo: 0 }));
    expect(acciones[0]).toMatchObject({ x: 2, y: 0, z: 3 });
    acciones[0]!.alEjecutar();
    expect(hablar).toHaveBeenCalledExactlyOnceWith('a');
    actualizarAccionesHablar(acciones, () => null);
    expect(acciones[0]?.x).toBe(Infinity);
  });
  it('mira al avatar cercano en la misma planta y retira la mirada al alejarse', () => {
    const acciones = crearAccionesHablar(agentes, vi.fn());
    actualizarAccionesHablar(acciones, () => ({ x: 1, y: 0, z: 0, rumbo: 0 }));
    expect(miradasCercanas(acciones, { x: 0, y: 0, z: 0 })).toEqual({ a: 'avatar-propio' });
    expect(miradasCercanas(acciones, { x: 20, y: 0, z: 0 })).toEqual({});
    expect(miradasCercanas(acciones, { x: 1, y: 4, z: 0 })).toEqual({});
  });
});
