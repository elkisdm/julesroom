/**
 * Operaciones del editor sobre muebles de la plantilla: mover, girar, quitar, restablecer.
 * Actúan sobre `mundo.ajustesMuebles` y delegan la validación a `aplicarAjustes`.
 */
import { describe, expect, it } from 'vitest';
import { crearMapaColisionDe, puntoLibre } from '../animacion/colision';
import { accionesDe } from '../escenarios/acciones';
import { escenarioTrading } from '../escenarios/trading';
import { escenarioOficina } from '../escenarios/oficina';
import { aplicarAjustes, piezasMovibles, TIPOS_FIJOS } from '../escenarios/personalizacion';
import type { Escenario } from '../escenarios/tipos';
import { ejemploEquipo } from '../definicion/definicion';
import { cajaDe } from '../mansion/plano';
import type { SalaGuardada } from './formato';
import { migrarDefinicion, mundoVacio, parsearSala, serializarSala } from './formato';
import { LIMITES_SALA } from './limites';
import {
  girarMueble,
  moverMueble,
  muebleBajoPunto,
  quitarMueble,
  restablecerMueble,
  restablecerSala,
  razonNoSeleccionable,
} from './mobiliario';
import { ajustar } from './rejilla';

const salaBase = (plantilla: string): SalaGuardada => ({
  version: 2,
  nombre: 'Test',
  plano: { plantilla },
  ocupantes: [],
  departamentos: ejemploEquipo.departamentos,
  tema: ejemploEquipo.tema,
  mundo: mundoVacio(),
});

const primeroMovible = (e: Escenario) => piezasMovibles(e)[0]!;

describe('razonNoSeleccionable', () => {
  it('un mueble movible no tiene razón de no seleccionable', () => {
    const p = primeroMovible(escenarioTrading);
    expect(razonNoSeleccionable(escenarioTrading, p.id)).toBeNull();
  });

  it('un mueble fijo devuelve una razón y no es seleccionable', () => {
    const fijo = escenarioTrading.planta.muebles.find((m) => TIPOS_FIJOS.has(m.tipo));
    expect(fijo, 'trading tiene arquitectura fija').toBeDefined();
    expect(razonNoSeleccionable(escenarioTrading, fijo!.id)).toMatch(/arquitectura/);
    const bajo = muebleBajoPunto(escenarioTrading, fijo!.x, fijo!.z);
    expect(bajo?.id).toBe(fijo!.id);
    expect(bajo?.motivo).toMatch(/arquitectura/);
  });

  it('un id que no existe devuelve razón', () => {
    expect(razonNoSeleccionable(escenarioTrading, 'no-existe')).toBeTypeOf('string');
  });
});

describe('moverMueble', () => {
  it('mover un sofá de la plantilla actualiza ajustesMuebles', () => {
    const e = escenarioTrading;
    const paso = LIMITES_SALA.paso;
    let movio = false;
    for (const p of piezasMovibles(e)) {
      const mueble = e.planta.muebles.find((m) => m.id === p.id)!;
      // Desplaza un paso de rejilla para que no se redondee lejos.
      const nx = ajustar(mueble.x + paso, paso);
      const r = moverMueble(salaBase('trading'), e, p.id, nx, mueble.z);
      if (!r.ok) continue;
      const ajuste = r.sala.mundo.ajustesMuebles[p.id];
      expect(ajuste).not.toBe('quitado');
      if (ajuste !== 'quitado' && ajuste) expect(ajuste.x).toBe(nx);
      movio = true;
      break;
    }
    expect(movio, 'algún mueble de trading cabe un paso más allá').toBe(true);
  });

  it('rechaza fuera de la sala con el mismo motivo que el motor', () => {
    const e = escenarioTrading;
    const id = 'pufs';
    const m = e.planta.muebles.find((x) => x.id === id)!;
    const directo = aplicarAjustes(e, { [id]: { x: 0, z: 9, giro: m.giro } });
    const r = moverMueble(salaBase('trading'), e, id, 0, 9);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe(directo.errores.find((x) => x.id === id)!.motivo);
  });

  it('rechaza cerrar un camino con el mismo motivo que el motor', () => {
    const e = escenarioTrading;
    const id = 'taburete-1';
    const m = e.planta.muebles.find((x) => x.id === id)!;
    const x = ajustar(0, LIMITES_SALA.paso);
    const z = ajustar(-6.48, LIMITES_SALA.paso);
    const directo = aplicarAjustes(e, { [id]: { x, z, giro: m.giro } });
    const r = moverMueble(salaBase('trading'), e, id, x, z);
    const error = directo.errores.find((er) => er.id === id);
    expect(error, 'el taburete en el pasillo cierra un camino').toBeDefined();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe(error!.motivo);
  });

  it('rechaza mover un mueble fijo', () => {
    const fijo = escenarioTrading.planta.muebles.find((m) => TIPOS_FIJOS.has(m.tipo));
    if (!fijo) return;
    const r = moverMueble(salaBase('trading'), escenarioTrading, fijo.id, fijo.x + 1, fijo.z);
    expect(r.ok).toBe(false);
  });

  it('un mueble que no existe falla sin lanzar', () => {
    const r = moverMueble(salaBase('trading'), escenarioTrading, 'fantasma', 0, 0);
    expect(r.ok).toBe(false);
  });
});

describe('girarMueble', () => {
  it('girar un mueble movible', () => {
    const e = escenarioTrading;
    const p = primeroMovible(e);
    const r = girarMueble(salaBase('trading'), e, p.id, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ajuste = r.sala.mundo.ajustesMuebles[p.id];
    expect(ajuste).toEqual(expect.objectContaining({ giro: expect.any(Number) }));
  });
});

describe('quitarMueble', () => {
  it('quitar un mueble movible pone «quitado» en ajustesMuebles', () => {
    const e = escenarioTrading;
    const p = primeroMovible(e);
    const r = quitarMueble(salaBase('trading'), e, p.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sala.mundo.ajustesMuebles[p.id]).toBe('quitado');
  });

  it('quitar un mueble fijo falla', () => {
    const fijo = escenarioTrading.planta.muebles.find((m) => TIPOS_FIJOS.has(m.tipo));
    if (!fijo) return;
    const r = quitarMueble(salaBase('trading'), escenarioTrading, fijo.id);
    expect(r.ok).toBe(false);
  });
});

describe('restablecerMueble', () => {
  it('restablecer un mueble movido borra su ajuste', () => {
    const e = escenarioTrading;
    for (const p of piezasMovibles(e)) {
      const mueble = e.planta.muebles.find((m) => m.id === p.id)!;
      const movida = moverMueble(salaBase('trading'), e, p.id, mueble.x + 0.5, mueble.z);
      if (!movida.ok) continue;
      const r = restablecerMueble(movida.sala, p.id);
      expect(r.mundo.ajustesMuebles[p.id]).toBeUndefined();
      return;
    }
  });

  it('restablecer un mueble quitado lo restaura', () => {
    const e = escenarioTrading;
    const p = primeroMovible(e);
    const quitada = quitarMueble(salaBase('trading'), e, p.id);
    expect(quitada.ok).toBe(true);
    if (!quitada.ok) return;
    const r = restablecerMueble(quitada.sala, p.id);
    expect(r.mundo.ajustesMuebles[p.id]).toBeUndefined();
  });
});

describe('restablecerSala', () => {
  it('restablecer la sala vacía ajustesMuebles', () => {
    const e = escenarioTrading;
    const p = primeroMovible(e);
    const quitada = quitarMueble(salaBase('trading'), e, p.id);
    expect(quitada.ok).toBe(true);
    if (!quitada.ok) return;
    const r = restablecerSala(quitada.sala);
    expect(Object.keys(r.mundo.ajustesMuebles)).toHaveLength(0);
  });
});

describe('consistencia con aplicarAjustes', () => {
  it('mover un sofá y aplicar produce un escenario con el mueble en la nueva posición', () => {
    const e = escenarioTrading;
    const paso = LIMITES_SALA.paso;
    for (const p of piezasMovibles(e)) {
      const mueble = e.planta.muebles.find((m) => m.id === p.id)!;
      const nx = ajustar(mueble.x + paso, paso);
      const r = moverMueble(salaBase('trading'), e, p.id, nx, mueble.z);
      if (!r.ok) continue;
      const { escenario, errores } = aplicarAjustes(e, r.sala.mundo.ajustesMuebles);
      if (errores.some((x) => x.id === p.id)) continue;
      const movido = escenario.planta.muebles.find((m) => m.id === p.id);
      expect(movido?.x).toBe(nx);
      return;
    }
  });

  it('quitar un mueble y aplicar lo saca del escenario', () => {
    const e = escenarioTrading;
    const p = primeroMovible(e);
    const r = quitarMueble(salaBase('trading'), e, p.id);
    if (!r.ok) return;
    const { escenario } = aplicarAjustes(e, r.sala.mundo.ajustesMuebles);
    expect(escenario.planta.muebles.some((m) => m.id === p.id)).toBe(false);
  });

  it('una sala sin ajustesMuebles carga igual que hoy', () => {
    const { escenario, errores } = aplicarAjustes(escenarioTrading, {});
    expect(escenario).toBe(escenarioTrading);
    expect(errores).toHaveLength(0);
  });

  it('un ajuste que apunta a un mueble inexistente se ignora sin lanzar', () => {
    const { escenario, errores } = aplicarAjustes(escenarioTrading, { 'no-existe': 'quitado' });
    expect(errores.some((x) => x.id === 'no-existe')).toBe(true);
    expect(escenario).toBe(escenarioTrading);
  });
});

describe('el mueble movido arrastra colisión y asiento', () => {
  it('mover el sofá de la oficina deja libre el sitio viejo y ofrece sentarse en el nuevo', () => {
    const e = escenarioOficina;
    const id = 'lounge-sofa';
    const antes = e.planta.muebles.find((m) => m.id === id)!;
    let sala: SalaGuardada | null = null;
    for (const dx of [2.5, 3, -2.5, 2, -2]) {
      for (const dz of [-3.5, -3, -4, 2.5, -2.5]) {
        const r = moverMueble(salaBase('oficina'), e, id, antes.x + dx, antes.z + dz);
        if (!r.ok) continue;
        const a = r.sala.mundo.ajustesMuebles[id];
        if (!a || a === 'quitado') continue;
        if (Math.hypot(a.x - antes.x, a.z - antes.z) < 1.5) continue;
        sala = r.sala;
        break;
      }
      if (sala) break;
    }
    expect(sala, 'el sofá cabe en algún hueco de la rejilla').not.toBeNull();
    const { escenario } = aplicarAjustes(e, sala!.mundo.ajustesMuebles);
    const movido = escenario.planta.muebles.find((m) => m.id === id)!;
    const nuevo = crearMapaColisionDe(escenario, 0);
    const viejo = crearMapaColisionDe(e, 0);
    expect(puntoLibre(viejo, antes.x, antes.z, 0.05)).toBe(false);
    expect(puntoLibre(nuevo, antes.x, antes.z, 0.05)).toBe(true);
    expect(puntoLibre(nuevo, movido.x, movido.z, 0.05)).toBe(false);
    const caja = cajaDe(movido);
    const plazas = accionesDe(escenario).filter((a) => a.id.startsWith(`sentarse:${id}`));
    expect(plazas.length).toBeGreaterThan(0);
    for (const a of plazas) {
      expect(a.x >= caja.x0 && a.x <= caja.x1 && a.z >= caja.z0 && a.z <= caja.z1).toBe(true);
    }
    expect(accionesDe(e).some((a) => a.id.startsWith(`sentarse:${id}`))).toBe(true);
  });

  it('quitar un mueble saca su sólido y su sentarse; restablecer lo devuelve', () => {
    const e = escenarioOficina;
    const id = 'lounge-sofa';
    const antes = e.planta.muebles.find((m) => m.id === id)!;
    const quitada = quitarMueble(salaBase('oficina'), e, id);
    expect(quitada.ok).toBe(true);
    if (!quitada.ok) return;
    const { escenario } = aplicarAjustes(e, quitada.sala.mundo.ajustesMuebles);
    expect(escenario.planta.muebles.some((m) => m.id === id)).toBe(false);
    expect(puntoLibre(crearMapaColisionDe(escenario, 0), antes.x, antes.z, 0.05)).toBe(true);
    expect(accionesDe(escenario).some((a) => a.id.startsWith(`sentarse:${id}`))).toBe(false);
    const vuelta = restablecerMueble(quitada.sala, id);
    expect(vuelta.mundo.ajustesMuebles[id]).toBeUndefined();
    const { escenario: restaurado } = aplicarAjustes(e, vuelta.mundo.ajustesMuebles);
    expect(restaurado).toBe(e);
  });
});

describe('guardar, exportar e importar', () => {
  it('exportar e importar conserva los ajustes', () => {
    const e = escenarioTrading;
    const p = primeroMovible(e);
    const base = migrarDefinicion({ ...ejemploEquipo, plano: { plantilla: 'trading' } });
    const quitada = quitarMueble(base, e, p.id);
    expect(quitada.ok).toBe(true);
    if (!quitada.ok) return;
    const leida = parsearSala(serializarSala(quitada.sala));
    expect(leida.ok).toBe(true);
    if (!leida.ok) return;
    expect(leida.sala.mundo.ajustesMuebles).toEqual(quitada.sala.mundo.ajustesMuebles);
  });
});

describe('cuatro cuartos de vuelta', () => {
  it('una vuelta entera deja el ajuste vacío', () => {
    const e = escenarioTrading;
    for (const p of piezasMovibles(e)) {
      let sala = salaBase('trading');
      let completa = true;
      for (let i = 0; i < 4; i++) {
        const r = girarMueble(sala, e, p.id, 1);
        if (!r.ok) {
          completa = false;
          break;
        }
        sala = r.sala;
      }
      if (!completa) continue;
      expect(sala.mundo.ajustesMuebles[p.id]).toBeUndefined();
      return;
    }
    expect.fail('ningún mueble pudo girar una vuelta entera en su sitio');
  });
});

describe('deshacer: la sala anterior restaura exactamente', () => {
  it('quitar y restablecer deja la sala idéntica a la original', () => {
    const base = salaBase('trading');
    const e = escenarioTrading;
    const p = primeroMovible(e);
    const quitada = quitarMueble(base, e, p.id);
    if (!quitada.ok) return;
    const r = restablecerMueble(quitada.sala, p.id);
    expect(r.mundo.ajustesMuebles).toEqual(base.mundo.ajustesMuebles);
  });
});
