import { describe, expect, it } from 'vitest';
import { NIVEL_Y, plano } from '../../mansion/plano';
import type { Muro, Tramo } from '../../mansion/plano';
import {
  ALTO_VANO,
  CONTRAHUELLA_MAX,
  ESPESOR_MURO,
  estructura,
  exterior,
  peldanos,
  restarCaja,
  segmentosMuro,
} from './arquitectura';
import type { Bloque } from './arquitectura';

interface Volumen {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

const EPS = 1e-6;

/** ¿El bloque (con su cizalla, si la tiene) invade el volumen? Tocar una cara no cuenta. */
function invade(b: Bloque, v: Volumen): boolean {
  if (b.x1 <= v.x0 + EPS || b.x0 >= v.x1 - EPS) return false;
  const z0 = Math.max(b.z0, v.z0);
  const z1 = Math.min(b.z1, v.z1);
  if (z1 <= z0 + EPS) return false;
  const p = b.pendiente ?? 0;
  const zm = (b.z0 + b.z1) / 2;
  // Con cizalla la caja sube con z: su rango de alturas en [z0, z1] va de un extremo al otro.
  const bajo = Math.min(b.y0 + p * (z0 - zm), b.y0 + p * (z1 - zm));
  const alto = Math.max(b.y1 + p * (z0 - zm), b.y1 + p * (z1 - zm));
  return alto > v.y0 + EPS && bajo < v.y1 - EPS;
}

/** Puntos de la línea de paso de un tramo, cada 5 cm. */
function lineaDePaso(t: Tramo): { x: number; y: number; z: number }[] {
  const largo = Math.hypot(t.hasta.x - t.desde.x, t.hasta.z - t.desde.z);
  const n = Math.ceil(largo / 0.05);
  return Array.from({ length: n + 1 }, (_, i) => {
    const k = i / n;
    return {
      x: t.desde.x + (t.hasta.x - t.desde.x) * k,
      y: t.desde.y + (t.hasta.y - t.desde.y) * k,
      z: t.desde.z + (t.hasta.z - t.desde.z) * k,
    };
  });
}

const todo = [...estructura(), ...exterior()];
/** Lo que corta el paso: todo menos lo que se pisa (losas y peldaños, que se miden aparte). */
const solidos = todo.filter((b) => b.rol !== 'piso' && b.rol !== 'peldano');

describe('restarCaja', () => {
  it('deja el hueco libre y conserva el área del resto', () => {
    const c = { x0: 0, x1: 10, z0: 0, z1: 6 };
    const h = { x0: 2, x1: 4, z0: 1, z1: 3 };
    const partes = restarCaja(c, h);
    const area = partes.reduce((s, p) => s + (p.x1 - p.x0) * (p.z1 - p.z0), 0);
    expect(area).toBeCloseTo(60 - 4, 9);
    for (const p of partes) {
      const cruza = p.x0 < h.x1 && p.x1 > h.x0 && p.z0 < h.z1 && p.z1 > h.z0;
      expect(cruza).toBe(false);
    }
  });

  it('sin intersección devuelve la caja intacta', () => {
    const c = { x0: 0, x1: 1, z0: 0, z1: 1 };
    expect(restarCaja(c, { x0: 5, x1: 6, z0: 5, z1: 6 })).toEqual([c]);
  });
});

describe('segmentosMuro', () => {
  const conVano = plano.muros.filter((m): m is Muro & { vano: NonNullable<Muro['vano']> } =>
    Boolean(m.vano),
  );

  it('el plano tiene muros con vano', () => {
    expect(conVano.length).toBeGreaterThanOrEqual(6);
  });

  it.each(conVano.map((m) => [m.id, m] as const))('%s deja libre su vano', (_, muro) => {
    const y = NIVEL_Y[muro.nivel];
    const v = muro.vano;
    const hueco: Volumen = {
      x0: v.pos - ESPESOR_MURO,
      x1: v.pos + ESPESOR_MURO,
      y0: y,
      y1: y + ALTO_VANO,
      z0: v.centro - v.ancho / 2,
      z1: v.centro + v.ancho / 2,
    };
    const bloques = segmentosMuro(muro);
    for (const b of bloques) expect(invade(b, hueco)).toBe(false);
    // Y cierra el resto: el muro cubre su largo salvo el vano (en planta, a la altura de una persona).
    const cubierto = bloques
      .filter((b) => b.y0 <= y + 1 && b.y1 >= y + 1)
      .reduce((s, b) => s + (b.z1 - b.z0), 0);
    expect(cubierto).toBeCloseTo(muro.hasta - muro.desde - v.ancho, 6);
    // Sobre el vano queda el dintel hasta el cielo.
    const dintel = bloques.some(
      (b) =>
        Math.abs(b.y0 - (y + ALTO_VANO)) < EPS && b.z0 <= hueco.z0 + EPS && b.z1 >= hueco.z1 - EPS,
    );
    expect(dintel).toBe(true);
  });

  it('ningún sólido de la casa invade un vano del plano', () => {
    for (const v of plano.vanos) {
      const y = NIVEL_Y[v.nivel];
      const hueco: Volumen = {
        x0: v.pos - ESPESOR_MURO,
        x1: v.pos + ESPESOR_MURO,
        y0: y + 0.01,
        y1: y + ALTO_VANO,
        z0: v.centro - v.ancho / 2,
        z1: v.centro + v.ancho / 2,
      };
      const invasores = solidos.filter((b) => invade(b, hueco));
      expect(invasores, v.id).toEqual([]);
    }
  });
});

describe('peldanos', () => {
  it.each(plano.escaleras.map((e) => [e.id, e] as const))(
    '%s: contrahuella ≤ 0,19 m y cada peldaño dentro de su tramo',
    (_, escalera) => {
      const lista = peldanos(escalera);
      expect(lista.length).toBeGreaterThan(0);
      const primero = escalera.tramos[0] as Tramo;
      const ultimo = escalera.tramos[escalera.tramos.length - 1] as Tramo;
      let anterior = primero.desde.y;
      for (const p of lista) {
        const t = escalera.tramos[p.tramo] as Tramo;
        const dx = t.hasta.x - t.desde.x;
        const dz = t.hasta.z - t.desde.z;
        const largo = Math.hypot(dx, dz);
        const k = ((p.x - t.desde.x) * dx + (p.z - t.desde.z) * dz) / (largo * largo);
        const lateral = Math.abs((p.x - t.desde.x) * dz - (p.z - t.desde.z) * dx) / largo;
        expect(k).toBeGreaterThanOrEqual(-EPS);
        expect(k).toBeLessThanOrEqual(1 + EPS);
        expect(lateral).toBeLessThanOrEqual(t.ancho / 2);
        expect(p.y).toBeGreaterThan(Math.min(t.desde.y, t.hasta.y) - EPS);
        expect(p.y).toBeLessThanOrEqual(Math.max(t.desde.y, t.hasta.y) + EPS);
        const contrahuella = p.y - anterior;
        expect(contrahuella).toBeGreaterThan(0);
        expect(contrahuella).toBeLessThanOrEqual(CONTRAHUELLA_MAX + EPS);
        anterior = p.y;
      }
      // El último escalón llega (o deja a un paso de) la cara del piso de destino.
      expect(ultimo.hasta.y - anterior).toBeLessThanOrEqual(CONTRAHUELLA_MAX + EPS);
    },
  );

  it('CONTRAHUELLA_MAX es 0,19 m', () => {
    expect(CONTRAHUELLA_MAX).toBe(0.19);
  });
});

describe('estructura', () => {
  it('las escaleras tienen altura libre: nada sólido sobre la línea de paso (1,9 m)', () => {
    for (const escalera of plano.escaleras) {
      for (const tramo of escalera.tramos) {
        for (const p of lineaDePaso(tramo)) {
          const cabeza: Volumen = {
            x0: p.x - 0.1,
            x1: p.x + 0.1,
            y0: p.y + 0.12,
            y1: p.y + 1.9,
            z0: p.z - 0.1,
            z1: p.z + 0.1,
          };
          const choques = todo.filter((b) => b.rol !== 'peldano' && invade(b, cabeza));
          expect(choques, `${escalera.id} en (${p.x}, ${p.y}, ${p.z})`).toEqual([]);
        }
      }
    }
  });

  it('las losas respetan los huecos del plano', () => {
    for (const h of plano.huecos) {
      const v: Volumen = { ...h, y0: h.y - 0.29, y1: h.y - 0.01 };
      expect(todo.filter((b) => b.rol === 'piso' && invade(b, v))).toEqual([]);
    }
  });

  it('el atrio es de doble altura: no hay losa del segundo piso sobre él', () => {
    const atrio = plano.ambientes.find((a) => a.id === 'atrio');
    const pasarela = plano.ambientes.find((a) => a.id === 'pasarela');
    if (!atrio || !pasarela) throw new Error('El plano no tiene atrio o pasarela');
    const vacio: Volumen = {
      x0: atrio.x0 + 0.01,
      x1: atrio.x1 - 0.01,
      y0: NIVEL_Y.piso2 - 0.29,
      y1: NIVEL_Y.piso2 + 1.5,
      z0: pasarela.z1 + 0.01,
      z1: atrio.z1,
    };
    const deEscalera = new Set(['peldano', 'escalera', 'baranda']);
    const ocupan = todo.filter((b) => !deEscalera.has(b.rol) && invade(b, vacio));
    expect(ocupan).toEqual([]);
  });

  it('la piscina queda abierta: nada sobre la lámina de agua', () => {
    const { piscina } = plano;
    const v: Volumen = { ...piscina, y0: piscina.y + 0.01, y1: piscina.y + 3 };
    expect(todo.filter((b) => invade(b, v))).toEqual([]);
  });

  it('todo bloque tiene medidas positivas', () => {
    for (const b of todo) {
      expect(b.x1).toBeGreaterThan(b.x0);
      expect(b.y1).toBeGreaterThan(b.y0);
      expect(b.z1).toBeGreaterThan(b.z0);
    }
  });
});

describe('etiquetas de corte (lado)', () => {
  const bloques = estructura();
  const delLado = (lado: string) => bloques.filter((b) => b.lado === lado);

  it('el muro cortina y sus montantes son del norte, y nada más lo es salvo el antepecho del fondo', () => {
    const norte = delLado('norte');
    expect(norte.length).toBeGreaterThan(0);
    for (const b of norte) expect(b.z1).toBeLessThanOrEqual(-4);
    for (const b of bloques.filter((x) => x.rol === 'muro' && x.z1 <= -4)) {
      expect(b.lado, `${b.material} en z ${b.z0}`).toBe('norte');
    }
  });

  it('los muros de los costados y los vuelos de las losas son del este o del oeste según su x', () => {
    for (const b of delLado('este')) expect((b.x0 + b.x1) / 2).toBeGreaterThan(0);
    for (const b of delLado('oeste')) expect((b.x0 + b.x1) / 2).toBeLessThan(0);
    const bordeEste = bloques.find((b) => b.rol === 'muro' && b.x0 >= 16 - 1e-6 && b.x1 <= 16.3);
    expect(bordeEste?.lado).toBe('este');
    const bordeOeste = bloques.find((b) => b.rol === 'muro' && b.x1 <= -16 + 1e-6 && b.x0 >= -16.3);
    expect(bordeOeste?.lado).toBe('oeste');
  });

  it('los vuelos de las losas más allá de los muros de borde siguen a su costado', () => {
    const vuelos = bloques.filter(
      (b) => b.rol === 'piso' && (b.x0 >= 16.2 - 1e-6 || b.x1 <= -16.2 + 1e-6),
    );
    expect(vuelos.length).toBeGreaterThan(0);
    for (const b of vuelos) expect(b.lado).toBe(b.x0 > 0 ? 'este' : 'oeste');
  });

  it('todo muro interior (fino en x) lleva costado: ninguno tapa la vista sin poder ocultarse', () => {
    const sinLado = bloques.filter(
      (b) => b.rol === 'muro' && b.x1 - b.x0 <= 0.25 && b.z1 > -4 && !b.lado,
    );
    expect(sinLado).toEqual([]);
  });

  it('el suelo, los cielos, las barandas y las escaleras no se ocultan por costado', () => {
    for (const b of bloques) {
      if (['cielo', 'baranda', 'peldano', 'escalera', 'terreno', 'jardin'].includes(b.rol)) {
        expect(b.lado).toBeUndefined();
      }
    }
    const pisosInteriores = bloques.filter((b) => b.rol === 'piso' && b.x1 < 16.2 && b.x0 > -16.2);
    for (const b of pisosInteriores) expect(b.lado).toBeUndefined();
  });

  it('separar la fusión por costado suma pocas mallas: a lo sumo 8 sobre las de un material', () => {
    const materiales = new Set(todo.map((b) => b.material)).size;
    const grupos = new Set(todo.map((b) => `${b.material}|${b.lado ?? ''}`)).size;
    expect(grupos - materiales).toBeLessThanOrEqual(8);
  });
});
