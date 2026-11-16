import { describe, expect, it } from 'vitest';
import { ejemploEquipo } from '../definicion/definicion';
import { escenarioOficina, escenarioTrading } from '../index';
import { evaluarColocacion } from './colocacion';
import { migrarDefinicion, type SalaGuardada } from './formato';
import { LIMITES_SALA } from './limites';
import {
  asignarPuesto,
  cambiarPlantilla,
  colocar,
  duplicar,
  fijarPantalla,
  fijarVariante,
  girarObjeto,
  mover,
  quitar,
} from './operaciones';

const E = escenarioTrading;
const vacia = (): SalaGuardada =>
  migrarDefinicion({ ...ejemploEquipo, plano: { plantilla: 'trading' } });

function hueco(): { x: number; z: number } {
  for (let x = -16; x < 16; x += 0.5)
    for (let z = -12; z < 7; z += 0.5)
      if (
        evaluarColocacion(
          { id: 't', tipo: 'mesa-redonda', x, z, giro: 0 },
          { escenario: E, objetos: [] },
        ).estado === 'libre'
      )
        return { x, z };
  throw new Error('sin hueco');
}

function una() {
  const p = hueco();
  const r = colocar(vacia(), E, { tipo: 'planta-grande', x: p.x + 0.1, z: p.z + 0.1, giro: 0 });
  if (!r.ok) throw new Error(r.motivo);
  return { sala: r.sala, p };
}

describe('operaciones', () => {
  it('colocar ajusta a la rejilla y asigna un id nuevo, sin mutar la sala', () => {
    const base = vacia();
    const p = hueco();
    const r = colocar(base, E, { tipo: 'planta-grande', x: p.x + 0.1, z: p.z + 0.1, giro: 0 });
    expect(r.ok && r.sala.mundo.objetos).toEqual([
      { id: 'obj-1', tipo: 'planta-grande', x: p.x, z: p.z, giro: 0 },
    ]);
    expect(base.mundo.objetos).toEqual([]);
  });

  it('los ids nuevos no se repiten tras quitar', () => {
    const { sala, p } = una();
    const r2 = colocar(sala, E, { tipo: 'maceta-baja', x: p.x + 2, z: p.z, giro: 0 });
    expect(r2.ok && r2.sala.mundo.objetos.map((o) => o.id)).toEqual(['obj-1', 'obj-2']);
    const q = quitar(r2.ok ? r2.sala : sala, 'obj-1');
    const r3 = q.ok && colocar(q.sala, E, { tipo: 'maceta-baja', x: p.x, z: p.z, giro: 0 });
    expect(r3 && r3.ok && r3.sala.mundo.objetos.map((o) => o.id)).toEqual(['obj-2', 'obj-3']);
  });

  it('rechaza colocar encima de otro, fuera de la sala y al llegar al tope', () => {
    const { sala, p } = una();
    const choque = colocar(sala, E, { tipo: 'planta-grande', x: p.x, z: p.z, giro: 0 });
    expect(choque).toMatchObject({ ok: false });
    expect(colocar(sala, E, { tipo: 'planta-grande', x: 500, z: 0, giro: 0 })).toEqual({
      ok: false,
      motivo: 'Fuera de la sala',
    });
    const tope = colocar(
      sala,
      E,
      { tipo: 'maceta-baja', x: p.x + 3, z: p.z, giro: 0 },
      { ...LIMITES_SALA, maxObjetos: 1 },
    );
    expect(tope).toEqual({ ok: false, motivo: 'Llegaste al tope de 1 objetos' });
  });

  it('mover, girar y quitar; un id inexistente da «No existe ese objeto»', () => {
    const { sala, p } = una();
    const m = mover(sala, E, 'obj-1', p.x + 1.1, p.z);
    expect(m.ok && m.sala.mundo.objetos[0]).toMatchObject({ x: p.x + 1, z: p.z });
    const g = girarObjeto(sala, E, 'obj-1', 1);
    expect(g.ok && g.sala.mundo.objetos[0]!.giro).toBe(1);
    const q = quitar(sala, 'obj-1');
    expect(q.ok && q.sala.mundo.objetos).toEqual([]);
    const nada = { ok: false, motivo: 'No existe ese objeto' };
    expect(mover(sala, E, 'x', 0, 0)).toEqual(nada);
    expect(girarObjeto(sala, E, 'x', 1)).toEqual(nada);
    expect(duplicar(sala, E, 'x')).toEqual(nada);
    expect(quitar(sala, 'x')).toEqual(nada);
  });

  it('duplicar busca un hueco libre cercano', () => {
    const { sala } = una();
    const d = duplicar(sala, E, 'obj-1');
    expect(d.ok && d.sala.mundo.objetos).toHaveLength(2);
    if (d.ok) {
      const [a, b] = d.sala.mundo.objetos;
      expect(b!.id).toBe('obj-2');
      expect(a!.x === b!.x && a!.z === b!.z).toBe(false);
    }
  });

  it('fijarPantalla, fijarVariante', () => {
    const s = vacia();
    const p = fijarPantalla(s, 'muro', 'video');
    expect(p.ok && p.sala.mundo.pantallas).toEqual({ muro: 'video' });
    const v = fijarVariante(s, 'noche');
    expect(v.ok && v.sala.mundo.variante).toBe('noche');
    const w = fijarVariante(v.ok ? v.sala : s, undefined);
    expect(w.ok && w.sala.mundo.variante).toBeUndefined();
  });

  it('asignarPuesto: un lugar tiene un solo ocupante', () => {
    const a = asignarPuesto(vacia(), 'eq-1', 'l1');
    const b = a.ok && asignarPuesto(a.sala, 'eq-2', 'l1');
    expect(b && b.ok && b.sala.mundo.puestos).toEqual({ 'eq-2': 'l1' });
    const c = b && b.ok && asignarPuesto(b.sala, 'eq-2', null);
    expect(c && c.ok && c.sala.mundo.puestos).toEqual({});
  });

  it('cambiarPlantilla descarta lo que ya no cabe y vacía ajustes, pantallas y puestos', () => {
    const { sala, p } = una();
    const rica: SalaGuardada = {
      ...sala,
      mundo: {
        ...sala.mundo,
        objetos: [
          ...sala.mundo.objetos,
          { id: 'obj-9', tipo: 'planta-grande', x: 17.5, z: 7, giro: 0 },
        ],
        ajustesMuebles: { m1: 'quitado' },
        pantallas: { muro: 'video' },
        puestos: { 'eq-1': 'l1' },
        variante: 'noche',
      },
    };
    const r = cambiarPlantilla(rica, escenarioOficina);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sala.plano.plantilla).toBe('oficina');
      expect(r.sala.mundo.ajustesMuebles).toEqual({});
      expect(r.sala.mundo.pantallas).toEqual({});
      expect(r.sala.mundo.puestos).toEqual({});
      expect(r.sala.mundo.variante).toBeUndefined();
      expect(r.descartados).toBe(rica.mundo.objetos.length - r.sala.mundo.objetos.length);
      expect(r.descartados).toBeGreaterThanOrEqual(1);
      expect(p).toBeDefined();
    }
  });
});
