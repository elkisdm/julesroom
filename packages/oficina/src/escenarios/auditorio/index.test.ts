import { describe, expect, it } from 'vitest';
import { buscarRuta, crearNavegacion } from '../../animacion/navegacion';
import { piezasMovibles } from '../personalizacion';
import { escenarioAuditorio } from './index';
import { escenarioPorId } from '../registro';
import { accionesDe } from '../acciones';
import { alturaEn, sePisa, sueloDe } from '../suelo';
import { crearMapaDeSuelo, puntoLibre } from '../../animacion/colision';

describe('auditorio', () => {
  const e = escenarioAuditorio;
  it('se registra, tiene 44 × 32 m y reserva 25 butacas más los agentes', () => {
    expect(escenarioPorId('auditorio')).toBe(e);
    expect(e.suelo?.limites).toEqual({ x0: -22, x1: 22, z0: -16, z1: 16 });
    expect(e.planta.lugares.filter((l) => l.asiento)).toHaveLength(25);
    expect(e.planta.lugares.filter((l) => l.departamento === 'equipo-1')).toHaveLength(3);
  });
  it('se sube caminando por el escalón y la tarima', () => {
    const s = sueloDe(e);
    expect(alturaEn(s, 0, -8, 0)).toBe(0);
    expect(alturaEn(s, 0, -9.2, 0.2)).toBe(0.2);
    expect(alturaEn(s, 0, -12, 0.4)).toBe(0.4);
  });
  it('ofrece 25 asientos con E, aproximaciones libres y butacas no pisables', () => {
    const s = sueloDe(e),
      mapa = crearMapaDeSuelo(s);
    const acciones = accionesDe(e).filter((a) => a.tipo === 'sentarse');
    expect(acciones).toHaveLength(25);
    for (const a of acciones) {
      const p = a.asiento.aproximacion;
      expect(puntoLibre(mapa, p.x, p.z, 0.3, p.y), a.id).toBe(true);
    }
    for (const m of e.planta.muebles.filter((m) => m.tipo === 'silla')) {
      expect(m.pisable).toBe(false);
      expect(sePisa(m)).toBe(false);
      expect(puntoLibre(mapa, m.x, m.z, 0.3, 0)).toBe(false);
      expect(puntoLibre(mapa, m.x, m.z, 0.3, 1)).toBe(false);
    }
  });
  it('la navegación llega a la tarima y a cada butaca sin mover las plazas fijas', () => {
    const nav = crearNavegacion(crearMapaDeSuelo(sueloDe(e)), 0.25, 0.3);
    const ruta = new Float64Array(512);
    const entrada = e.entradas[0]!;
    expect(buscarRuta(nav, entrada.x, entrada.z, 0, -12, ruta, 512, 0, 0.4)).toBeGreaterThan(0);
    for (const a of accionesDe(e)) {
      if (a.tipo !== 'sentarse') continue;
      const p = a.asiento.aproximacion;
      expect(buscarRuta(nav, 0, 0, p.x, p.z, ruta, 512, 0, 0), a.id).toBeGreaterThan(0);
    }
    expect(piezasMovibles(e).some((p) => p.id.startsWith('butaca'))).toBe(false);
  });

  it('deja libre un centro de 16 × 12 m y todas las entradas', () => {
    const mapa = crearMapaDeSuelo(sueloDe(e));
    for (let x = -8; x <= 8; x++)
      for (let z = -8; z <= 4; z++) expect(puntoLibre(mapa, x, z, 0.3, 0), `${x},${z}`).toBe(true);
    expect(e.entradas.length).toBeGreaterThanOrEqual(25);
    for (const p of e.entradas) expect(puntoLibre(mapa, p.x, p.z, 0.3, p.y)).toBe(true);
  });
  it('una sala guardada con el auditorio de 30 × 22 m sigue dentro de los muros', () => {
    const l = e.suelo!.limites;
    for (const [x, z] of [
      [-15, -11],
      [15, 11],
      [-14.5, 10.5],
    ] as const)
      expect(x >= l.x0 && x <= l.x1 && z >= l.z0 && z <= l.z1).toBe(true);
  });
});
