import { describe, expect, it } from 'vitest';
import { RADIO_AVATAR } from '../animacion/avatar';
import { crearMapaDeSuelo, puntoLibre } from '../animacion/colision';
import { PELVIS_SENTADA } from '../animacion/sentarse';
import { escenarioMansion } from './mansion';
import { escenarioOficina } from './oficina';
import { escenarioTrading } from './trading';
import {
  accionBajoRayo,
  accionCercana,
  accionesDe,
  ETIQUETA_ACCION,
  PARAMETROS_ACCIONES,
} from './acciones';
import { alturaEn, sueloDe } from './suelo';
import type { Accion, AccionAbrir, AccionSentarse } from './tipos';

const escenarios = [escenarioMansion, escenarioTrading, escenarioOficina];
const sentadas = (acciones: readonly Accion[]) =>
  acciones.filter((a): a is AccionSentarse => a.tipo === 'sentarse');

describe.each(escenarios)('acciones derivadas de $id', (e) => {
  const acciones = accionesDe(e);

  it('ids únicos y se arman una sola vez', () => {
    expect(new Set(acciones.map((a) => a.id)).size).toBe(acciones.length);
    expect(accionesDe(e)).toBe(acciones);
  });

  it('un «abrir» por cada interés, con su panel', () => {
    const abrir = acciones.filter((a): a is AccionAbrir => a.tipo === 'abrir');
    expect(abrir.map((a) => a.interes)).toEqual(e.intereses.map((i) => i.id));
    for (const a of abrir) {
      const i = e.intereses.find((x) => x.id === a.interes);
      expect(a.panel).toBe(i?.panel);
      expect(a.radio).toBe(i?.radio);
    }
  });

  it('no ofrece los asientos de los agentes', () => {
    const ocupados = new Set(e.planta.lugares.flatMap((l) => (l.silla ? [l.silla] : [])));
    for (const a of sentadas(acciones)) {
      const id = a.id.replace(/^sentarse:/, '').replace(/:\d+$/, '');
      expect(ocupados.has(id)).toBe(false);
    }
  });

  it('cada aproximación está libre para el avatar y sobre suelo', () => {
    const suelo = sueloDe(e);
    const mapa = crearMapaDeSuelo(suelo);
    for (const a of sentadas(acciones)) {
      const p = a.asiento.aproximacion;
      expect(puntoLibre(mapa, p.x, p.z, RADIO_AVATAR, p.y), a.id).toBe(true);
      expect(alturaEn(suelo, p.x, p.z, p.y), a.id).toBeCloseTo(p.y, 6);
      expect(Math.hypot(p.x - a.asiento.x, p.z - a.asiento.z), a.id).toBeLessThan(2);
    }
  });
});

describe('asientos por escenario', () => {
  it('trading: butacas del aula, plazas libres del sofá (la del medio da a la mesa baja), sillones y taburetes', () => {
    const s = sentadas(accionesDe(escenarioTrading));
    expect(s.filter((a) => a.nombre === 'Butaca')).toHaveLength(12);
    expect(s.filter((a) => a.nombre === 'Sofá').map((a) => a.id)).toEqual([
      'sentarse:sofa:1',
      'sentarse:sofa:3',
    ]);
    expect(s.filter((a) => a.nombre === 'Sillón').length).toBeGreaterThanOrEqual(3);
    expect(s.filter((a) => a.nombre === 'Taburete').length).toBeGreaterThanOrEqual(1);
  });

  it('trading: la butaca de la fila alta queda a la altura de su grada y mira a la pantalla', () => {
    const b = sentadas(accionesDe(escenarioTrading)).find((a) => a.id === 'sentarse:butaca-3-1');
    expect(b?.asiento.y).toBeCloseTo(0.6 + 0.52, 6);
    expect(b?.asiento.yaw).toBeCloseTo(Math.PI, 6);
    expect(b?.asiento.aproximacion.y).toBeCloseTo(0.3, 6);
    expect(b?.asiento.aproximacion.z).toBeLessThan(b?.asiento.z ?? 0);
  });

  it('oficina: sofás de dos plazas, sillones, sillas libres de la reunión y taburetes', () => {
    const s = sentadas(accionesDe(escenarioOficina));
    expect(s.filter((a) => a.nombre === 'Sofá').length).toBeGreaterThanOrEqual(3);
    expect(s.filter((a) => a.nombre === 'Sillón')).toHaveLength(4);
    expect(s.filter((a) => a.nombre === 'Silla').length).toBeGreaterThanOrEqual(1);
    expect(s.filter((a) => a.nombre === 'Taburete')).toHaveLength(4);
  });

  it('mansión: ofrece los asientos que no son de un agente (taburetes) a la altura de su piso', () => {
    const s = sentadas(accionesDe(escenarioMansion));
    expect(s.length).toBeGreaterThan(0);
    for (const a of s) {
      expect(a.asiento.y - (a.y ?? 0)).toBeCloseTo(PELVIS_SENTADA, 1);
    }
  });

  it('las plazas de un sofá quedan separadas a lo largo de su ancho y miran igual', () => {
    const sofa = sentadas(accionesDe(escenarioTrading)).filter((a) => a.nombre === 'Sofá');
    const zs = sofa.map((a) => a.asiento.z).sort((a, b) => a - b);
    expect(zs[1]! - zs[0]!).toBeGreaterThan(1.5);
    expect(new Set(sofa.map((a) => a.asiento.yaw)).size).toBe(1);
  });
});

describe('accionCercana', () => {
  const base = {
    tipo: 'abrir',
    nombre: 'x',
    y: undefined,
    radio: 1.5,
    interes: 'i',
    panel: 'p',
  } as const;
  const a: Accion = { ...base, id: 'a', x: 0, z: 1 };
  const b: Accion = { ...base, id: 'b', x: 0, z: -1 };

  it('sin nada al alcance devuelve null', () => {
    expect(accionCercana([a, b], 10, 10, 0, 0)).toBeNull();
    expect(accionCercana([], 0, 0, 0, 0)).toBeNull();
  });

  it('elige la más cercana', () => {
    expect(accionCercana([a, b], 0, 0.5, 0, 0)?.id).toBe('a');
    expect(accionCercana([a, b], 0, -0.5, 0, 0)?.id).toBe('b');
  });

  it('a igual distancia gana la que se mira de frente', () => {
    expect(accionCercana([a, b], 0, 0, 0, 0)?.id).toBe('a');
    expect(accionCercana([a, b], 0, 0, 0, Math.PI)?.id).toBe('b');
  });

  it('mirar de frente compensa una diferencia pequeña de distancia', () => {
    const lejosDeFrente: Accion = { ...base, id: 'f', x: 0, z: 1.3 };
    const cercaDeEspalda: Accion = { ...base, id: 'e', x: 0, z: -1.1 };
    expect(accionCercana([cercaDeEspalda, lejosDeFrente], 0, 0, 0, 0)?.id).toBe('f');
  });

  it('ignora las acciones de otra altura', () => {
    const arriba: AccionSentarse = {
      id: 's',
      tipo: 'sentarse',
      nombre: 'Silla',
      x: 0,
      z: 0.3,
      y: 3,
      radio: 1.5,
      asiento: { x: 0, z: 0.3, y: 3.45, yaw: 0, aproximacion: { x: 0, y: 3, z: 1 } },
    };
    expect(accionCercana([arriba], 0, 0, 0, 0)).toBeNull();
    expect(accionCercana([arriba], 0, 0, 3, 0)).toBe(arriba);
  });

  it('no ofrece las acciones excluidas (asiento ocupado)', () => {
    expect(accionCercana([a, b], 0, 0.5, 0, 0, null, new Set(['a']))?.id).toBe('b');
    expect(accionCercana([a], 0, 0.5, 0, 0, null, new Set(['a']))).toBeNull();
  });

  it('la que ya se tenía aguanta unos centímetros más allá del alcance', () => {
    const cerca: Accion = { ...base, id: 'c', x: 0, z: 1.6 };
    expect(accionCercana([cerca], 0, 0, 0, 0)).toBeNull();
    expect(accionCercana([cerca], 0, 0, 0, 0, cerca)).toBe(cerca);
    const muyLejos: Accion = {
      ...base,
      id: 'm',
      x: 0,
      z: 1.5 + PARAMETROS_ACCIONES.histeresis + 0.1,
    };
    expect(accionCercana([muyLejos], 0, 0, 0, 0, muyLejos)).toBeNull();
  });

  it('con un escenario real, junto a un sofá ofrece sentarse y cerca de una pantalla, abrir', () => {
    const acciones = accionesDe(escenarioTrading);
    const sofa = sentadas(acciones).find((s) => s.nombre === 'Sofá')!;
    const ap = sofa.asiento.aproximacion;
    const hallada = accionCercana(acciones, ap.x, ap.z, ap.y, sofa.asiento.yaw);
    expect(hallada?.tipo).toBe('sentarse');
    expect(ETIQUETA_ACCION[hallada!.tipo]).toBe('sentarse');
    const muro = acciones.find((x) => x.id === 'abrir:muro')!;
    expect(accionCercana(acciones, muro.x, muro.z + 1, 0, Math.PI)?.id).toBe('abrir:muro');
  });
});

describe('accionBajoRayo', () => {
  const acciones = accionesDe(escenarioTrading);
  const s = sentadas(acciones).find((x) => x.id === 'sentarse:sofa:3')!;

  it('un rayo desde arriba al asiento lo encuentra', () => {
    const { x, y, z } = s.asiento;
    expect(accionBajoRayo(acciones, x + 3, y + 3, z + 3, -3, -3, -3)).toBe(s);
  });

  it('un rayo que pasa lejos no encuentra nada', () => {
    const { x, y, z } = s.asiento;
    expect(accionBajoRayo(acciones, x + 3, y + 3, z + 3, -3, -3, -3.0 + 1.5)).toBeNull();
  });

  it('mira solo hacia delante del rayo', () => {
    const { x, y, z } = s.asiento;
    expect(accionBajoRayo(acciones, x - 3, y - 3, z - 3, -3, -3, -3)).toBeNull();
  });

  it('con dos asientos en la línea elige el más cercano al origen', () => {
    const [p1, p2] = sentadas(acciones).filter((x) => x.nombre === 'Sofá') as [
      AccionSentarse,
      AccionSentarse,
    ];
    const o = { x: p1.asiento.x, y: p1.asiento.y + 4, z: p1.asiento.z };
    expect(accionBajoRayo([p2, p1], o.x, o.y, o.z, 0, -1, 0)).toBe(p1);
  });
});
