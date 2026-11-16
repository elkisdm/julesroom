import { describe, expect, it } from 'vitest';
import { RADIO_AVATAR } from '../../animacion/avatar';
import { crearMapaColisionDe, crearMapaDeCajas, puntoLibre } from '../../animacion/colision';
import type { MapaColision } from '../../animacion/colision';
import { NODO_SALIDA, NODO_VISITA } from '../../animacion/ruta';
import type { Nodo } from '../../animacion/ruta';
import { cajaDe } from '../../mansion/plano';
import type { Caja, Lugar, PuntoXZ } from '../../mansion/plano';
import { asignarPuestos } from '../../render/layout';
import type { AgenteOficina, Departamento } from '../../tipos';
import { escenarioPorId } from '../registro';
import { escenarioOficina } from './index';
import { EQUIPOS, MESAS, SALA } from './plano';

const e = escenarioOficina;
const p = e.planta;
const mapa = crearMapaColisionDe(e, 0);
const EPS = 1e-6;
/** Cada cuánto (m) se muestrea un tramo de ruta contra el mapa de colisión. */
const PASO = 0.05;

const dentro = (c: Caja, x: number, z: number, margen = 0) =>
  x >= c.x0 + margen - EPS &&
  x <= c.x1 - margen + EPS &&
  z >= c.z0 + margen - EPS &&
  z <= c.z1 - margen + EPS;

const solapan = (a: Caja, b: Caja) =>
  a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS;

function distanciaCajas(a: Caja, b: Caja): number {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
  return Math.hypot(dx, dz);
}

/** Primer punto del tramo a→b que choca (con un círculo de `radio`), o `null` si está libre. */
function choque(m: MapaColision, a: PuntoXZ, b: PuntoXZ, radio: number): PuntoXZ | null {
  const pasos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / PASO));
  for (let k = 0; k <= pasos; k++) {
    const t = k / pasos;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (!puntoLibre(m, x, z, radio)) return { x, z };
  }
  return null;
}

/** Mapa sin la silla del lugar: el primer tramo (levantarse) sale de dentro de ella. */
function mapaSinSilla(l: Lugar): MapaColision {
  const { cajas, limites } = e.colision(0);
  const silla = p.muebles.find((m) => m.id === l.silla);
  if (!silla) return mapa;
  const c = cajaDe(silla);
  return crearMapaDeCajas(
    cajas.filter((k) => !(k.x0 === c.x0 && k.x1 === c.x1 && k.z0 === c.z0 && k.z1 === c.z1)),
    limites,
  );
}

/** Revisa toda la cadena: el primer tramo sin la silla propia, el resto contra todo el mapa. */
function rutaLibre(l: Lugar, nodos: readonly Nodo[]): string | null {
  for (let i = 0; i + 1 < nodos.length; i++) {
    const a = nodos[i] as Nodo;
    const b = nodos[i + 1] as Nodo;
    const m = i < NODO_SALIDA ? mapaSinSilla(l) : mapa;
    const c = choque(m, a, b, RADIO_AVATAR);
    if (c)
      return `${l.id}: tramo ${i} (${a.x},${a.z})→(${b.x},${b.z}) choca en ${c.x.toFixed(2)},${c.z.toFixed(2)}`;
  }
  return null;
}

const SALA_CAJA: Caja = { x0: SALA.x0, x1: SALA.x1, z0: SALA.z0, z1: SALA.z1 };

/** Agentes de prueba repartidos en `deptos` departamentos, en orden. */
function agentesDe(cantidad: number, deptos: number) {
  const departamentos: Departamento[] = Array.from({ length: deptos }, (_, k) => ({
    id: `d${k + 1}`,
    nombre: `D${k + 1}`,
    lider: '',
    color: '#888888',
  }));
  const agentes: AgenteOficina[] = Array.from({ length: cantidad }, (_, i) => ({
    id: `a${i}`,
    nombre: `A${i}`,
    rol: 'QA',
    departamento: `d${(i % deptos) + 1}`,
    estado: 'trabajando',
  }));
  return { departamentos, agentes };
}

describe('escenario oficina: datos y registro', () => {
  it('se registra al importarse y se encuentra por id', () => {
    expect(escenarioPorId('oficina')).toBe(escenarioOficina);
    expect(e.id).toBe('oficina');
    expect(e.nombre).toBe('Oficina');
  });

  it('es de un solo nivel, interior, a las 10 y reparte por orden con las mesas de pie como común', () => {
    expect(p.niveles).toEqual([0]);
    expect(p.escaleras).toEqual([]);
    expect(p.huecos).toEqual([]);
    expect(e.asignacion).toBe('por-orden');
    expect(e.ambiente.tipo).toBe('interior');
    expect(e.ambiente.hora).toBe(10);
    expect(p.ambientes.some((a) => a.id === e.ambienteComun)).toBe(true);
    expect(e.zonas.find((z) => z.id === e.ambienteComun)?.tipo).toBe('paso');
  });

  // Los nombres del cliente de origen los vigila `guardia.test.ts` en todo el monorepo.
  it('no trae textos ni datos de cliente, marca, planes ni precios', () => {
    const textos = JSON.stringify(e, (_, v: unknown) => (typeof v === 'function' ? undefined : v));
    expect(textos).not.toMatch(/tanda|precio|suscrip|\bplan(es)?\b|\$|usd \d/i);
  });
});

describe('ambientes', () => {
  it('cubren todo el piso de la nave sin solaparse', () => {
    let area = 0;
    for (const [i, a] of p.ambientes.entries()) {
      expect(dentro(SALA_CAJA, a.x0, a.z0) && dentro(SALA_CAJA, a.x1, a.z1), a.id).toBe(true);
      area += (a.x1 - a.x0) * (a.z1 - a.z0);
      for (const b of p.ambientes.slice(i + 1))
        expect(solapan(a, b), `${a.id}/${b.id}`).toBe(false);
    }
    expect(area).toBeCloseTo((SALA.x1 - SALA.x0) * (SALA.z1 - SALA.z0), 6);
  });

  it('el pasillo de cada ambiente queda dentro de él y es caminable donde hay lugares', () => {
    for (const a of p.ambientes) {
      expect(a.pasilloZ > a.z0 && a.pasilloZ < a.z1, a.id).toBe(true);
      for (const l of p.lugares.filter((u) => u.ambiente === a.id)) {
        expect(puntoLibre(mapa, l.salida.x, a.pasilloZ, RADIO_AVATAR), `${a.id} ${l.id}`).toBe(
          true,
        );
      }
    }
  });
});

describe('lugares', () => {
  it('cada lugar está dentro de su ambiente y no hay dos en el mismo punto', () => {
    for (const l of p.lugares) {
      const a = p.ambientes.find((u) => u.id === l.ambiente);
      expect(a, l.id).toBeDefined();
      expect(dentro(a as Caja, l.x, l.z), l.id).toBe(true);
      expect(l.y).toBe(0);
    }
    expect(new Set(p.lugares.map((l) => `${l.x}|${l.z}`)).size).toBe(p.lugares.length);
    expect(new Set(p.lugares.map((l) => l.id)).size).toBe(p.lugares.length);
  });

  it('un lugar sentado está dentro de su silla; uno de pie, a más de 0,3 m de todo mueble', () => {
    for (const l of p.lugares) {
      if (l.asiento) {
        const silla = p.muebles.find((m) => m.id === l.silla);
        expect(silla, l.id).toBeDefined();
        expect(dentro(cajaDe(silla!), l.x, l.z), l.id).toBe(true);
      } else {
        expect(l.silla).toBeNull();
        for (const m of p.muebles) {
          const punto = { x0: l.x, x1: l.x, z0: l.z, z1: l.z };
          expect(distanciaCajas(punto, cajaDe(m)), `${l.id} con ${m.id}`).toBeGreaterThan(0.3);
        }
      }
    }
  });

  it('la salida de cada lugar es un punto libre para el cuerpo entero', () => {
    for (const l of p.lugares) {
      expect(Math.hypot(l.salida.x - l.x, l.salida.z - l.z), l.id).toBeGreaterThan(0.3);
      expect(puntoLibre(mapa, l.salida.x, l.salida.z, RADIO_AVATAR), l.id).toBe(true);
      expect(Math.hypot(l.mira.x - l.x, l.mira.z - l.z), l.id).toBeGreaterThan(0.2);
    }
  });

  it(`hay ${EQUIPOS} mesas largas con 8 puestos sentados y 4 de pie cada una; las mesas de pie traen los comunes`, () => {
    expect(EQUIPOS).toBe(4);
    for (let k = 1; k <= EQUIPOS; k++) {
      const propios = p.lugares.filter((l) => l.departamento === `equipo-${k}`);
      expect(propios.filter((l) => l.asiento && !l.extra)).toHaveLength(8);
      expect(propios.filter((l) => !l.asiento && l.extra)).toHaveLength(4);
      // Cuatro por lado de su mesa: la mitad mira a la cámara (se ven las caras).
      const sentados = propios.filter((l) => l.asiento);
      expect(sentados.filter((l) => l.yaw === 0)).toHaveLength(4);
    }
    const comunes = p.lugares.filter((l) => l.ambiente === e.ambienteComun);
    expect(comunes.length).toBeGreaterThanOrEqual(12);
    expect(comunes.every((l) => l.departamento === null)).toBe(true);
  });
});

describe('rutas', () => {
  it('desde cada lugar a cada punto de café, ningún tramo cruza un mueble ni un muro', () => {
    const fallas: string[] = [];
    for (const l of p.lugares) {
      for (const cafe of p.cafe) {
        const nodos = e.rutas.crearRuta(l, cafe, false);
        expect(nodos.at(-1)).toEqual({ x: cafe.x, y: 0, z: cafe.z });
        const f = rutaLibre(l, nodos);
        if (f) fallas.push(f);
      }
    }
    expect(fallas).toEqual([]);
  });

  it('cada visita a un colega del mismo ambiente va y vuelve sin cruzar muebles', () => {
    const fallas: string[] = [];
    const cafe = p.cafe[0]!;
    for (const a of p.lugares) {
      for (const b of p.lugares) {
        if (a === b || a.ambiente !== b.ambiente) continue;
        const nodos = e.rutas.crearRuta(a, cafe, false);
        const original = nodos.map((n) => ({ ...n }));
        e.rutas.escribirVisita(nodos, b);
        const f = rutaLibre(a, nodos.slice(0, NODO_VISITA + 1));
        if (f) fallas.push(`visita a ${b.id}: ${f}`);
        e.rutas.quitarVisita(nodos);
        expect(nodos).toEqual(original);
      }
    }
    expect(fallas).toEqual([]);
  });

  it.each([3, 4])(
    'con 75 agentes en %i departamentos, los puestos que rebosan también quedan libres',
    (deptos) => {
      const { agentes, departamentos } = agentesDe(75, deptos);
      const fallas: string[] = [];
      for (const puesto of asignarPuestos(agentes, departamentos, e)) {
        const l = puesto.lugar;
        if (!l.asiento && !puntoLibre(mapa, l.x, l.z, RADIO_AVATAR))
          fallas.push(`${l.id} pisa un mueble`);
        const f = rutaLibre(l, e.rutas.crearRuta(l, puesto.cafe, false));
        if (f) fallas.push(f);
      }
      expect(fallas).toEqual([]);
    },
  );
});

describe('puestos (asignación por orden)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'] as const;
  const deptos: Departamento[] = ids.map((id) => ({ id, nombre: id, lider: '', color: '#888888' }));
  const agentes: AgenteOficina[] = Array.from({ length: 36 }, (_, i) => ({
    id: `x${i}`,
    nombre: `X${i}`,
    rol: 'QA',
    departamento: ids[Math.floor(i / 8) % 5]!,
    estado: 'trabajando',
  }));
  const puestos = asignarPuestos(agentes, deptos, e);
  const de = (d: string) =>
    puestos.filter((u) => agentes.find((a) => a.id === u.agenteId)?.departamento === d);

  it('el departamento i ocupa la mesa larga del equipo i, sentados primero', () => {
    for (const [i, d] of ['a', 'b', 'c', 'd'].entries()) {
      const suyos = de(d);
      expect(suyos).toHaveLength(8);
      expect(suyos.every((u) => u.lugar.departamento === `equipo-${i + 1}` && u.sentado)).toBe(
        true,
      );
      const mesa = MESAS[i]!;
      expect(suyos.every((u) => Math.abs(u.lugar.x - mesa.x) < 2.5)).toBe(true);
    }
  });

  it('un departamento sin mesa cae en las mesas de pie del frente', () => {
    const sobrantes = de('e');
    expect(sobrantes).toHaveLength(4);
    expect(sobrantes.every((u) => u.ambiente === e.ambienteComun)).toBe(true);
  });
});

describe('café', () => {
  it('12 puntos libres junto a la isla de la cocina, en 3 grupos de 4 contiguos', () => {
    expect(p.cafe).toHaveLength(12);
    for (const c of p.cafe) {
      expect(puntoLibre(mapa, c.x, c.z, RADIO_AVATAR), `${c.x},${c.z}`).toBe(true);
      expect(p.ambientes.find((a) => dentro(a, c.x, c.z))?.id).toBe('cocina');
    }
    const isla = cajaDe(p.muebles.find((m) => m.id === 'isla')!);
    for (const c of p.cafe)
      expect(distanciaCajas({ x0: c.x, x1: c.x, z0: c.z, z1: c.z }, isla)).toBeLessThan(1);
    for (let g = 0; g < 3; g++) {
      const grupo = p.cafe.slice(g * 4, g * 4 + 4);
      for (let i = 0; i + 1 < grupo.length; i++) {
        const a = grupo[i]!;
        const b = grupo[i + 1]!;
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1.2);
      }
    }
  });
});

describe('colisión', () => {
  it('los muros bloquean y la puerta de la sala de reunión queda abierta', () => {
    expect(puntoLibre(mapa, 0, SALA.z0 + 0.05, 0.2)).toBe(false);
    expect(puntoLibre(mapa, -9.5, -8, 0.2)).toBe(false);
    expect(puntoLibre(mapa, -13.2, -5, RADIO_AVATAR)).toBe(true);
    expect(puntoLibre(mapa, 0, SALA.z1 + 0.5, 0.1)).toBe(false);
  });

  it('las mesas largas, la isla y las mesas altas bloquean', () => {
    for (const m of MESAS) expect(puntoLibre(mapa, m.x, m.z, 0.2), `mesa ${m.equipo}`).toBe(false);
    expect(puntoLibre(mapa, 13.8, -7, 0.2)).toBe(false);
    expect(puntoLibre(mapa, 0, 3.7, 0.2)).toBe(false);
  });
});

describe('entradas, paseo, reuniones e intereses', () => {
  it('la entrada del avatar es libre, fuera del paseo, de las zonas de trabajo y de los corros', () => {
    expect(e.entradas.length).toBeGreaterThan(0);
    const t = e.entradas[0]!;
    expect(t.y).toBe(0);
    expect(puntoLibre(mapa, t.x, t.z, RADIO_AVATAR)).toBe(true);
    expect(dentro(e.paseo, t.x, t.z, -2), 'a menos de 2 m del paseo').toBe(false);
    for (const z of e.zonas.filter((u) => u.tipo === 'trabajo' || u.tipo === 'agentes')) {
      expect(dentro(z, t.x, t.z), z.id).toBe(false);
    }
    for (const r of e.reuniones)
      expect(Math.hypot(t.x - r.x, t.z - r.z)).toBeGreaterThan(r.radio + 2);
  });

  it('el paseo está dentro de la sala y sin muebles (las personas simuladas caminan en línea recta)', () => {
    expect(dentro(SALA_CAJA, e.paseo.x0, e.paseo.z0, 0.3)).toBe(true);
    expect(dentro(SALA_CAJA, e.paseo.x1, e.paseo.z1, 0.3)).toBe(true);
    const inflado = {
      x0: e.paseo.x0 - RADIO_AVATAR,
      x1: e.paseo.x1 + RADIO_AVATAR,
      z0: e.paseo.z0 - RADIO_AVATAR,
      z1: e.paseo.z1 + RADIO_AVATAR,
    };
    for (const m of p.muebles) expect(solapan(inflado, cajaDe(m)), m.id).toBe(false);
  });

  it('cada reunión tiene su centro dentro de la nave y sitio libre en su círculo', () => {
    for (const r of e.reuniones) {
      expect(dentro(SALA_CAJA, r.x, r.z, 0.3), `${r.x},${r.z}`).toBe(true);
      const libres = Array.from({ length: 16 }, (_, k) => (2 * Math.PI * k) / 16).filter((a) =>
        puntoLibre(mapa, r.x + Math.sin(a) * r.radio, r.z + Math.cos(a) * r.radio, 0.3),
      );
      expect(libres.length, `${r.x},${r.z}`).toBeGreaterThanOrEqual(r.cupo);
    }
  });

  it('trae los intereses de reunión, tablero y cocina, en celdas caminables y en zonas existentes', () => {
    const esperados = new Map<string, string>([
      ['reunion', 'aula'],
      ['tablero', 'agente'],
      ['cocina', 'chat'],
    ]);
    expect(e.intereses).toHaveLength(esperados.size);
    for (const [id, panel] of esperados) {
      expect(e.intereses.find((i) => i.id === id)?.panel, id).toBe(panel);
    }
    for (const i of e.intereses) {
      expect(puntoLibre(mapa, i.x, i.z, RADIO_AVATAR), i.id).toBe(true);
      expect(i.radio, i.id).toBeGreaterThan(0);
      expect(
        e.zonas.some((z) => z.id === i.zona),
        i.id,
      ).toBe(true);
    }
  });
});

describe('pantallas', () => {
  it('trae la de reunión (presentación), el tablero y un monitor por mesa, dentro de la sala', () => {
    const contenido = (id: string) => e.pantallas.find((s) => s.id === id)?.contenido;
    expect(contenido('reunion')).toBe('presentacion');
    expect(contenido('tablero')).toBe('tablero');
    for (const m of MESAS) expect(contenido(`monitor:${m.equipo}`)).toBe('agente');
    for (const s of e.pantallas) {
      expect(dentro(SALA_CAJA, s.x, s.z), s.id).toBe(true);
      expect(s.y - s.alto / 2, s.id).toBeGreaterThanOrEqual(0);
      expect(s.y + s.alto / 2, s.id).toBeLessThanOrEqual(SALA.alto);
      expect(
        e.zonas.some((z) => z.id === s.zona),
        s.id,
      ).toBe(true);
    }
  });
});

describe('vistas', () => {
  const g = e.vistas.general;

  it('la caja general contiene toda la planta, sus muebles y sus pantallas', () => {
    for (const a of p.ambientes) {
      expect(dentro({ x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1 }, a.x0, a.z0), a.id).toBe(true);
      expect(dentro({ x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1 }, a.x1, a.z1), a.id).toBe(true);
    }
    for (const m of p.muebles) expect(m.y + m.alto, m.id).toBeLessThanOrEqual(g.y1 + EPS);
    for (const s of e.pantallas) expect(s.y + s.alto / 2).toBeLessThanOrEqual(g.y1 + EPS);
    expect(g.y0).toBe(0);
  });

  it('la vertical es más angosta, corrida a lo sumo 1 m al fondo para centrar la nave, con el tablero entero', () => {
    const v = e.vistas.generalVertical!;
    expect(v.x1 - v.x0).toBeLessThan(g.x1 - g.x0);
    const CORRIDA = 1;
    expect(v.x0 >= g.x0 && v.x1 <= g.x1 && v.z0 >= g.z0 - CORRIDA && v.z1 <= g.z1).toBe(true);
    const tablero = e.pantallas.find((s) => s.id === 'tablero')!;
    expect(v.x0).toBeLessThanOrEqual(tablero.x - tablero.ancho / 2);
    expect(v.x1).toBeGreaterThanOrEqual(tablero.x + tablero.ancho / 2);
    expect(v.z0).toBeLessThanOrEqual(tablero.z);
    expect(v.z1).toBeGreaterThanOrEqual(g.z1 - CORRIDA - EPS);
  });

  it('la cámara general (42–46°) y la de seguimiento van altas para que nadie se tape', () => {
    expect(e.vistas.elevacionGeneral).toBeGreaterThanOrEqual(42);
    expect(e.vistas.elevacionGeneral).toBeLessThanOrEqual(46);
    expect(e.vistas.elevacionVertical ?? e.vistas.elevacionGeneral).toBeLessThanOrEqual(65);
    expect(e.vistas.seguir.elevacion).toBeGreaterThanOrEqual(35);
    expect(e.vistas.seguir.elevacion).toBeLessThanOrEqual(45);
    expect(e.vistas.seguir.distancia).toBeGreaterThan(0);
    expect(e.vistas.seguir.frente).toBe(SALA.z1);
  });

  it('hay una vista por zona, dentro de la general', () => {
    expect(e.vistas.zonas.map((v) => v.id).sort()).toEqual(e.zonas.map((z) => z.id).sort());
    for (const v of e.vistas.zonas) {
      expect(v.caja.x0 >= g.x0 - EPS && v.caja.x1 <= g.x1 + EPS, v.id).toBe(true);
      expect(v.caja.z0 >= g.z0 - EPS && v.caja.z1 <= g.z1 + EPS, v.id).toBe(true);
    }
  });
});
