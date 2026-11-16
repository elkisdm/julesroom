import { describe, expect, it } from 'vitest';
import { crearMapaColision, crearMapaColisionDe, puntoLibre } from '../animacion/colision';
import { RADIO_AVATAR } from '../animacion/avatar';
import { crearRuta, escribirVisita, quitarVisita } from '../mansion/rutas';
import { ambienteDe, NIVEL_Y, plano } from '../mansion/plano';
import { ELEVACION_GRADOS } from '../render/orbita';
import { escenarioMansion } from './mansion';

describe('escenarioMansion', () => {
  it('envuelve el plano sin copiar sus datos', () => {
    const p = escenarioMansion.planta;
    expect(p.ambientes).toBe(plano.ambientes);
    expect(p.muebles).toBe(plano.muebles);
    expect(p.lugares).toBe(plano.lugares);
    expect(p.muros).toBe(plano.muros);
    expect(p.vanos).toBe(plano.vanos);
    expect(p.escaleras).toBe(plano.escaleras);
    expect(p.huecos).toBe(plano.huecos);
    expect(p.cafe).toBe(plano.cafe);
    expect(p.luz).toBe(plano.luz);
    expect(p.niveles).toEqual(Object.values(NIVEL_Y));
    expect(p.asistente).toEqual({ x: plano.asistente.x, y: 3.7, z: plano.asistente.z });
  });

  it('la colisión de cada nivel es la de crearMapaColision', () => {
    for (const [nivel, y] of Object.entries(NIVEL_Y)) {
      const igual = crearMapaColision(nivel as keyof typeof NIVEL_Y);
      const desde = crearMapaColisionDe(escenarioMansion, y);
      expect(desde.n).toBe(igual.n);
      expect(Array.from(desde.cajas)).toEqual(Array.from(igual.cajas));
      expect(desde.limites).toEqual(igual.limites);
    }
  });

  it('las rutas son las de la mansión, para todos los lugares', () => {
    const pausa = plano.cafe[0]!;
    for (const l of plano.lugares) {
      expect(escenarioMansion.rutas.crearRuta(l, pausa, false)).toEqual(crearRuta(l, pausa, false));
    }
    expect(escenarioMansion.rutas.escribirVisita).toBe(escribirVisita);
    expect(escenarioMansion.rutas.quitarVisita).toBe(quitarVisita);
  });

  it('la entrada del avatar está libre, en el piso 1 y fuera del atrio', () => {
    const e = escenarioMansion.entradas[0]!;
    expect(e.y).toBe(NIVEL_Y.piso1);
    const atrio = ambienteDe('atrio');
    expect(e.x < atrio.x0 || e.x > atrio.x1 || e.z < atrio.z0 || e.z > atrio.z1).toBe(true);
    const mapa = crearMapaColisionDe(escenarioMansion, e.y);
    expect(puntoLibre(mapa, e.x, e.z, RADIO_AVATAR)).toBe(true);
  });

  it('el paseo es el atrio (±3,6 m)', () => {
    expect(escenarioMansion.paseo).toEqual({ x0: -3.6, x1: 3.6, z0: -3.6, z1: 3.6 });
  });

  it('una zona por ambiente con departamento más el atrio y la cocina, con tipo según su uso', () => {
    const esperadas = plano.ambientes
      .filter((a) => a.departamento !== null || a.id === 'atrio' || a.id === 'cocina')
      .map((a) => a.id);
    expect(escenarioMansion.zonas.map((z) => z.id)).toEqual(esperadas);
    const tipo = (id: string) => escenarioMansion.zonas.find((z) => z.id === id)?.tipo;
    expect(tipo('desarrollo')).toBe('trabajo');
    expect(tipo('atrio')).toBe('paso');
    expect(tipo('cocina')).toBe('descanso');
    expect(tipo('living')).toBe('descanso');
  });

  it('las pantallas son el videowall y la pantalla de pipeline, sobre una zona existente', () => {
    const ids = escenarioMansion.pantallas.map((p) => p.id).sort();
    const muebles = plano.muebles
      .filter((m) => m.tipo === 'videowall' || m.tipo === 'pantalla-pipeline')
      .map((m) => m.id)
      .sort();
    expect(ids).toEqual(muebles);
    for (const p of escenarioMansion.pantallas) {
      expect(escenarioMansion.zonas.some((z) => z.id === p.zona)).toBe(true);
    }
  });

  it('las vistas conservan la caja de la casa, la elevación general y seguir sube a 35° y se aleja a 10,5 m', () => {
    const v = escenarioMansion.vistas;
    expect(v.general).toEqual({ x0: -16, x1: 16, y0: -4, y1: 15.5, z0: -4, z1: 10 });
    expect(v.elevacionGeneral).toBe(ELEVACION_GRADOS);
    expect(v.seguir.distancia).toBe(10.5);
    expect(v.seguir.elevacion).toBe(35);
    expect(v.zonas.map((z) => z.id)).toEqual(plano.ambientes.map((a) => a.id));
  });

  it('es un escenario exterior de asignación por id, con el atrio como ambiente común', () => {
    expect(escenarioMansion.id).toBe('mansion');
    expect(escenarioMansion.ambiente.tipo).toBe('exterior');
    expect(escenarioMansion.ambiente.hora).toBeNull();
    expect(escenarioMansion.ambienteComun).toBe('atrio');
    expect(escenarioMansion.asignacion).toBe('por-id');
  });
});
