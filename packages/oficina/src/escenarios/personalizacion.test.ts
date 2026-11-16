import { describe, expect, it } from 'vitest';
import { RADIO_AVATAR } from '../animacion/avatar';
import {
  avanzarAvatar,
  crearAvatar,
  crearMando,
  PARAMETROS_AVATAR,
  saltar,
} from '../animacion/avatar';
import type { Avatar, Mando } from '../animacion/avatar';
import { crearMapaColisionDe, crearMapaDeSuelo, puntoLibre } from '../animacion/colision';
import { buscarRuta, crearNavegacion } from '../animacion/navegacion';
import { cajaDe } from '../mansion/plano';
import { accionesDe } from './acciones';
import { escenarioMansion } from './mansion';
import { escenarioOficina } from './oficina';
import { aplicarAjustes, conSueloExtra, piezasMovibles } from './personalizacion';
import type { AjustesMuebles } from './personalizacion';
import { alturaEn, sueloDe } from './suelo';
import type { Escenario, Solido, SuperficiePlana } from './tipos';
import { escenarioTrading } from './trading';

const PI = Math.PI;
const DT = 1 / 60;
const ESCENARIOS = [escenarioMansion, escenarioTrading, escenarioOficina];
const mueble = (e: Escenario, id: string) => e.planta.muebles.find((m) => m.id === id);
const huella = (e: Escenario) =>
  JSON.stringify(e, (_, v: unknown) => (typeof v === 'function' ? undefined : v));

describe('ids estables por pieza', () => {
  it('cada mueble de cada plantilla tiene un id único', () => {
    for (const e of ESCENARIOS) {
      const ids = e.planta.muebles.map((m) => m.id);
      expect(new Set(ids).size, e.id).toBe(ids.length);
    }
  });

  it('los ids de la oficina no dependen de coordenadas (no cambian si se retoca la plantilla)', () => {
    for (const m of escenarioOficina.planta.muebles)
      expect(m.id, m.id).not.toMatch(/\d\.\d|-\d+\.\d/);
  });

  it('suelo pisable, sólidos, asientos e intereses usan el mismo id que `planta.muebles`', () => {
    for (const e of [escenarioTrading, escenarioOficina]) {
      const ids = new Set(e.planta.muebles.map((m) => m.id));
      const suelo = sueloDe(e);
      for (const s of suelo.superficies)
        if (s.tipo === 'mueble') expect(ids.has(s.id), s.id).toBe(true);
      if (e.suelo)
        for (const s of e.suelo.solidos)
          if (s.tipo === 'mueble' && !s.id.startsWith('butaca-'))
            expect(ids.has(s.id), s.id).toBe(true);
      for (const a of accionesDe(e)) {
        if (
          a.tipo !== 'sentarse' ||
          !e.planta.muebles.some((m) => a.id.startsWith(`sentarse:${m.id}`))
        )
          continue;
        const id = a.id.replace(/^sentarse:/, '').replace(/:\d+$/, '');
        expect(ids.has(id), a.id).toBe(true);
      }
      for (const i of e.intereses) if (i.mueble) expect(ids.has(i.mueble), i.id).toBe(true);
    }
  });
});

describe('piezasMovibles', () => {
  const ids = (e: Escenario) => piezasMovibles(e).map((p) => p.id);

  it('trading: el mobiliario suelto se mueve; puestos, mesas con lugares, pantallas y arquitectura no', () => {
    const movibles = ids(escenarioTrading);
    for (const id of [
      'sofa',
      'mesa-baja',
      'pufs',
      'privado-mesa',
      'espera-sillon-1',
      'taburete-1',
      'jardinera-1',
    ])
      expect(movibles, id).toContain(id);
    for (const id of [
      'banco-a-1', // mesa de un puesto de agente
      'banco-a-1-silla-1', // silla de un puesto
      'mesa-cripto', // lugares de pie a su alrededor
      'quiosco', // lleva la pantalla de videos
      'barra', // café
      'columna-1',
      'muro-led-1',
      'aula-tarima',
      'aula-gradas',
    ])
      expect(movibles, id).not.toContain(id);
  });

  it('oficina: sofás, sillones, mesas sin puestos, sillas de reunión, plantas y bicicletas', () => {
    const movibles = ids(escenarioOficina);
    for (const id of [
      'lounge-sofa',
      'lounge-mesa',
      'reunion-mesa',
      'planta-1',
      'bicicleta-1',
      'descanso-sillon-1',
    ])
      expect(movibles, id).toContain(id);
    for (const id of ['mesa-1', 'mesa-alta-1', 'isla', 'credenza', 'estanteria', 'columna-1'])
      expect(movibles, id).not.toContain(id);
    const silla = escenarioOficina.planta.lugares.find((l) => l.silla)!.silla!;
    expect(movibles).not.toContain(silla);
  });

  it('la mansión todavía no se personaliza (su dibujo no sale de los datos)', () => {
    expect(piezasMovibles(escenarioMansion)).toEqual([]);
  });

  it('cada pieza trae nombre legible, tipo y su huella en planta', () => {
    for (const e of [escenarioTrading, escenarioOficina])
      for (const p of piezasMovibles(e)) {
        const m = mueble(e, p.id)!;
        expect(p.nombre.length, p.id).toBeGreaterThan(2);
        expect(p.tipo).toBe(m.tipo);
        expect(p.huella).toEqual(cajaDe(m));
      }
  });
});

describe('aplicarAjustes: casos válidos', () => {
  it('sin ajustes devuelve el mismo escenario y ningún error', () => {
    const r = aplicarAjustes(escenarioOficina, {});
    expect(r.escenario).toBe(escenarioOficina);
    expect(r.errores).toEqual([]);
  });

  it('mueve una pieza sin mutar el original y rehace la colisión', () => {
    const antes = huella(escenarioOficina);
    const r = aplicarAjustes(escenarioOficina, { 'lounge-sofa': { x: -13.2, z: -2.5, giro: 0 } });
    expect(r.errores).toEqual([]);
    expect(huella(escenarioOficina)).toBe(antes);
    expect(r.escenario).not.toBe(escenarioOficina);
    const m = mueble(r.escenario, 'lounge-sofa')!;
    expect([m.x, m.z, m.giro]).toEqual([-13.2, -2.5, 0]);
    const nuevo = crearMapaColisionDe(r.escenario, 0);
    const viejo = crearMapaColisionDe(escenarioOficina, 0);
    expect(puntoLibre(nuevo, -15.5, 1.9, 0.1)).toBe(true);
    expect(puntoLibre(nuevo, -13.2, -2.5, 0.1)).toBe(false);
    expect(puntoLibre(viejo, -15.5, 1.9, 0.1)).toBe(false);
    expect(puntoLibre(viejo, -13.2, -2.5, 0.1)).toBe(true);
  });

  it('rehace el suelo pisable (el sofá de trading se pisa en su nuevo sitio)', () => {
    const r = aplicarAjustes(escenarioTrading, { sofa: { x: 17.25, z: -3.4, giro: -PI / 2 } });
    expect(r.errores).toEqual([]);
    expect(alturaEn(sueloDe(r.escenario), 17.25, -2.3, 0.5)).toBeCloseTo(0.45, 6);
    expect(alturaEn(sueloDe(r.escenario), 17.25, -5.7, 0.5)).toBe(0);
    expect(alturaEn(sueloDe(escenarioTrading), 17.25, -5.7, 0.5)).toBeCloseTo(0.45, 6);
  });

  it('rehace los asientos: el sofá movido ofrece sentarse donde está ahora', () => {
    const r = aplicarAjustes(escenarioOficina, { 'lounge-sofa': { x: -13.2, z: -2.5, giro: 0 } });
    const caja = cajaDe(mueble(r.escenario, 'lounge-sofa')!);
    const plazas = accionesDe(r.escenario).filter((a) => a.id.startsWith('sentarse:lounge-sofa'));
    expect(plazas.length).toBeGreaterThan(0);
    for (const a of plazas) {
      expect(a.x >= caja.x0 && a.x <= caja.x1 && a.z >= caja.z0 && a.z <= caja.z1, a.id).toBe(true);
    }
  });

  it('quita una pieza: desaparece de la planta, de la colisión y de los asientos', () => {
    const r = aplicarAjustes(escenarioOficina, {
      'reunion-mesa': 'quitado',
      'reunion-silla-n1': 'quitado',
    });
    expect(r.errores).toEqual([]);
    expect(mueble(r.escenario, 'reunion-mesa')).toBeUndefined();
    expect(mueble(r.escenario, 'reunion-silla-n1')).toBeUndefined();
    expect(puntoLibre(crearMapaColisionDe(r.escenario, 0), -13.25, -8.4, 0.1)).toBe(true);
    expect(accionesDe(r.escenario).some((a) => a.id === 'sentarse:reunion-silla-n1')).toBe(false);
    expect(accionesDe(escenarioOficina).some((a) => a.id === 'sentarse:reunion-silla-n1')).toBe(
      true,
    );
  });

  it('un interés atado a un mueble se mueve y gira con él, y desaparece si se quita', () => {
    const base: Escenario = {
      ...escenarioOficina,
      intereses: [
        ...escenarioOficina.intereses,
        {
          id: 'charla',
          nombre: 'Charla',
          x: -13.2,
          z: 3.0,
          radio: 1,
          panel: 'chat',
          zona: 'lounge',
          mueble: 'lounge-mesa',
        },
      ],
    };
    const charla = (e: Escenario) => e.intereses.find((i) => i.id === 'charla');
    const movido = aplicarAjustes(base, { 'lounge-mesa': { x: -13.2, z: -2.5, giro: 0 } });
    expect(movido.errores).toEqual([]);
    expect(charla(movido.escenario)!.x).toBeCloseTo(-13.2, 9);
    expect(charla(movido.escenario)!.z).toBeCloseTo(-1.4, 9);
    const girado = aplicarAjustes(base, { 'lounge-mesa': { x: -13.2, z: 1.9, giro: PI / 2 } });
    expect(girado.errores).toEqual([]);
    expect(charla(girado.escenario)!.x).toBeCloseTo(-12.1, 9);
    expect(charla(girado.escenario)!.z).toBeCloseTo(1.9, 9);
    const quitado = aplicarAjustes(base, { 'lounge-mesa': 'quitado' });
    expect(charla(quitado.escenario)).toBeUndefined();
    // Los que no van atados a nada no cambian.
    expect(quitado.escenario.intereses.filter((i) => i.id !== 'charla')).toEqual(
      escenarioOficina.intereses,
    );
  });
});

describe('aplicarAjustes: validación por pieza', () => {
  const casos: {
    nombre: string;
    e: Escenario;
    id: string;
    a: AjustesMuebles[string];
    motivo: RegExp;
  }[] = [
    {
      nombre: 'id desconocido',
      e: escenarioTrading,
      id: 'no-existe',
      a: { x: 0, z: 0, giro: 0 },
      motivo: /no existe/i,
    },
    {
      nombre: 'pieza de un puesto',
      e: escenarioTrading,
      id: 'banco-a-1',
      a: { x: 0, z: 0, giro: 0 },
      motivo: /no se puede mover/i,
    },
    {
      nombre: 'quitar una pieza fija',
      e: escenarioTrading,
      id: 'quiosco',
      a: 'quitado',
      motivo: /no se puede/i,
    },
    {
      nombre: 'giro que no es de 90°',
      e: escenarioTrading,
      id: 'pufs',
      a: { x: -14, z: 0.7, giro: 0.3 },
      motivo: /90/,
    },
    {
      nombre: 'fuera de la sala',
      e: escenarioTrading,
      id: 'pufs',
      a: { x: 0, z: 9, giro: 0 },
      motivo: /fuera de la sala/i,
    },
    {
      nombre: 'sobre un muro',
      e: escenarioOficina,
      id: 'lounge-mesa',
      a: { x: -9.5, z: -7, giro: 0 },
      motivo: /muro/i,
    },
    {
      nombre: 'sobre otro mueble',
      e: escenarioTrading,
      id: 'pufs',
      a: { x: 15.95, z: -4.6, giro: 0 },
      motivo: /encima de/i,
    },
    {
      nombre: 'tapa la entrada',
      e: escenarioTrading,
      id: 'taburete-1',
      a: { x: 4.5, z: 6.8, giro: 0 },
      motivo: /entrada/i,
    },
    {
      nombre: 'ocupa un lugar de trabajo',
      e: escenarioTrading,
      id: 'taburete-1',
      a: { x: -7.75, z: -1.9, giro: 0 },
      motivo: /lugar de trabajo/i,
    },
    {
      nombre: 'tapa el café',
      e: escenarioTrading,
      id: 'taburete-1',
      a: { x: 14.75, z: 0.3, giro: 0 },
      motivo: /café/i,
    },
    {
      nombre: 'corta una ruta',
      e: escenarioTrading,
      id: 'taburete-1',
      a: { x: 0, z: -6.48, giro: 0 },
      motivo: /camino/i,
    },
    {
      nombre: 'corta el paseo',
      e: escenarioTrading,
      id: 'jardinera-3',
      a: { x: -8, z: 5.5, giro: 0 },
      motivo: /paseo/i,
    },
    {
      nombre: 'ocupa un punto de reunión',
      e: escenarioTrading,
      id: 'jardinera-3',
      a: { x: -14.2, z: -10.9, giro: 0 },
      motivo: /reunión/i,
    },
    {
      nombre: 'tapa un punto de interés',
      e: escenarioTrading,
      id: 'jardinera-3',
      a: { x: 14.5, z: -9, giro: 0 },
      motivo: /sala privada/i,
    },
    {
      nombre: 'en la mansión',
      e: escenarioMansion,
      id: escenarioMansion.planta.muebles[0]!.id,
      a: 'quitado',
      motivo: /todavía no/i,
    },
  ];

  for (const c of casos) {
    it(`${c.nombre}: queda en su sitio y se reporta con un motivo legible`, () => {
      const r = aplicarAjustes(c.e, { [c.id]: c.a });
      expect(r.errores).toHaveLength(1);
      expect(r.errores[0]!.id).toBe(c.id);
      expect(r.errores[0]!.motivo).toMatch(c.motivo);
      expect(r.escenario).toBe(c.e);
    });
  }

  it('las válidas se aplican y las inválidas quedan en su sitio, en el mismo llamado', () => {
    const r = aplicarAjustes(escenarioTrading, {
      'taburete-1': { x: 0, z: -6.48, giro: 0 },
      sofa: { x: 17.25, z: -3.4, giro: -PI / 2 },
      'jardinera-3': 'quitado',
    });
    expect(r.errores.map((e) => e.id)).toEqual(['taburete-1']);
    expect(mueble(r.escenario, 'taburete-1')).toEqual(mueble(escenarioTrading, 'taburete-1'));
    expect(mueble(r.escenario, 'sofa')!.z).toBe(-3.4);
    expect(mueble(r.escenario, 'jardinera-3')).toBeUndefined();
  });

  it('una pieza se valida contra las ya movidas (no se monta sobre otra recién puesta)', () => {
    const r = aplicarAjustes(escenarioOficina, {
      'lounge-sofa': { x: -13.2, z: -2.5, giro: 0 },
      'lounge-mesa': { x: -13.2, z: -2.5, giro: 0 },
    });
    expect(r.errores.map((e) => e.id)).toEqual(['lounge-mesa']);
  });

  it('ninguna pieza movible en su propio sitio da error (la plantilla es válida)', () => {
    for (const e of [escenarioTrading, escenarioOficina]) {
      const ajustes: AjustesMuebles = {};
      for (const p of piezasMovibles(e)) {
        const m = mueble(e, p.id)!;
        ajustes[p.id] = { x: m.x, z: m.z, giro: m.giro };
      }
      expect(aplicarAjustes(e, ajustes).errores, e.id).toEqual([]);
    }
  });
});

// --- suelo extra (lo que coloca el modo construir) ---

function correr(a: Avatar, m: Mando, e: Escenario, n: number) {
  const mapa = crearMapaDeSuelo(sueloDe(e));
  const nav = crearNavegacion(mapa, 0.25, RADIO_AVATAR);
  let yMax = a.y;
  for (let i = 0; i < n; i++) {
    avanzarAvatar(a, m, 0, mapa, nav, PARAMETROS_AVATAR, DT);
    yMax = Math.max(yMax, a.y);
  }
  return yMax;
}

const muro: Solido = {
  id: 'muro-extra',
  tipo: 'mueble',
  x0: 2,
  x1: 4,
  z0: 4.0,
  z1: 4.4,
  y0: 0,
  y1: 1,
};
const tarima: SuperficiePlana = {
  id: 'tarima-extra',
  tipo: 'tarima',
  forma: 'caja',
  x0: 2,
  x1: 4,
  z0: 3.2,
  z1: 4.4,
  y: 0.5,
  grosor: 0.5,
};

describe('conSueloExtra', () => {
  it('sin extras devuelve el mismo escenario', () => {
    expect(conSueloExtra(escenarioOficina)).toBe(escenarioOficina);
    expect(conSueloExtra(escenarioOficina, [], [])).toBe(escenarioOficina);
  });

  it('suma al suelo sin mutar el del escenario (también a uno sin suelo propio)', () => {
    const r = conSueloExtra(escenarioOficina, [muro], [tarima]);
    expect(escenarioOficina.suelo).toBeUndefined();
    expect(r.suelo!.solidos).toContain(muro);
    expect(r.suelo!.superficies).toContain(tarima);
    expect(sueloDe(escenarioOficina).solidos).not.toContain(muro);
    const t = conSueloExtra(escenarioTrading, [muro]);
    expect(t.suelo!.solidos.length).toBe(escenarioTrading.suelo!.solidos.length + 1);
    expect(escenarioTrading.suelo!.solidos).not.toContain(muro);
  });

  it('un sólido extra bloquea al avatar', () => {
    const libre = crearAvatar(3, 6, PI, 0);
    const m = crearMando();
    m.adelante = 1; // azimut 0: −z
    correr(libre, m, escenarioOficina, 120);
    expect(libre.z).toBeLessThan(3.5);
    const conMuro = conSueloExtra(escenarioOficina, [muro]);
    const a = crearAvatar(3, 6, PI, 0);
    correr(a, m, conMuro, 120);
    expect(a.z).toBeGreaterThan(muro.z1 + RADIO_AVATAR - 0.05);
  });

  it('una superficie extra (tarima) se pisa saltando y caminando no se sube', () => {
    const e = conSueloExtra(escenarioOficina, [], [tarima]);
    const caminando = crearAvatar(3, 5.4, PI, 0);
    const m = crearMando();
    m.adelante = 1;
    correr(caminando, m, e, 90);
    expect(caminando.y).toBe(0);
    expect(caminando.z).toBeGreaterThan(tarima.z1);

    const a = crearAvatar(3, 5.4, PI, 0);
    const n = crearMando();
    n.adelante = 1;
    correr(a, n, e, 6);
    saltar(n);
    const yMax = correr(a, n, e, 40);
    n.adelante = 0;
    correr(a, n, e, 30);
    expect(yMax).toBeGreaterThan(tarima.y);
    expect(a.enSuelo).toBe(true);
    expect(a.y).toBeCloseTo(tarima.y, 6);
  });

  it('la navegación por clic rodea un sólido extra', () => {
    const e = conSueloExtra(escenarioOficina, [muro]);
    const nav = crearNavegacion(crearMapaDeSuelo(sueloDe(e)), 0.25, RADIO_AVATAR);
    const ruta = new Float64Array(512);
    const n = buscarRuta(nav, 3, 6, 3, 2.6, ruta, 256, 0, 0);
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < n; i++) {
      const x = ruta[i * 2]!;
      const z = ruta[i * 2 + 1]!;
      const dentro =
        x > muro.x0 - RADIO_AVATAR + 0.05 &&
        x < muro.x1 + RADIO_AVATAR - 0.05 &&
        z > muro.z0 - RADIO_AVATAR + 0.05 &&
        z < muro.z1 + RADIO_AVATAR - 0.05;
      expect(dentro, `${x},${z}`).toBe(false);
    }
  });
});
