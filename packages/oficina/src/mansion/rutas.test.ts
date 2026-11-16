import { describe, expect, it } from 'vitest';
import { NODO_ASIENTO, NODO_PASILLO, NODO_SALIDA, NODO_VISITA } from '../animacion/ruta';
import type { Nodo } from '../animacion/ruta';
import { ambienteDe, cajaDe, NIVEL_Y, plano } from './plano';
import type { Lugar } from './plano';
import { crearRuta, escribirVisita, puestoDeVisita, quitarVisita } from './rutas';

/** Radio (m) del círculo que ocupa una persona al caminar. */
const RADIO = 0.2;
const EPS = 1e-6;

const cafeDe = (i: number) => plano.cafe[i % plano.cafe.length] as { x: number; z: number };
const rutaDe = (l: Lugar, i = 0) => crearRuta(l, cafeDe(i), false);

interface Muestra {
  x: number;
  y: number;
  z: number;
  /** El tramo de origen sube o baja (escalera). */
  escalera: boolean;
}

/** Puntos cada 5 cm a lo largo de la poligonal, con su altura interpolada. */
function muestrear(nodos: readonly Nodo[]): Muestra[] {
  const salida: Muestra[] = [];
  for (let i = 0; i + 1 < nodos.length; i++) {
    const a = nodos[i] as Nodo;
    const b = nodos[i + 1] as Nodo;
    const largo = Math.hypot(b.x - a.x, b.z - a.z);
    const pasos = Math.max(1, Math.ceil(largo / 0.05));
    for (let k = 0; k <= pasos; k++) {
      const f = k / pasos;
      salida.push({
        x: a.x + (b.x - a.x) * f,
        z: a.z + (b.z - a.z) * f,
        y: a.y + (b.y - a.y) * f,
        escalera: Math.abs(b.y - a.y) > EPS,
      });
    }
  }
  return salida;
}

const nivelDeY = (y: number) => Object.values(NIVEL_Y).find((n) => Math.abs(n - y) < 0.01);

function distanciaAMueble(p: { x: number; z: number }, m: Parameters<typeof cajaDe>[0]): number {
  const c = cajaDe(m);
  return Math.hypot(Math.max(0, c.x0 - p.x, p.x - c.x1), Math.max(0, c.z0 - p.z, p.z - c.z1));
}

/** Todas las rutas al café (una por lugar) y las del aro de luz de Contenido. */
const rutas = plano.lugares.map((lugar, i) => ({ lugar, nodos: rutaDe(lugar, i) }));

describe('crearRuta', () => {
  it('arranca en el lugar, sale por la salida libre y llega al pasillo del ambiente', () => {
    for (const { lugar, nodos } of rutas) {
      expect(nodos[NODO_ASIENTO]).toEqual({ x: lugar.x, y: lugar.y, z: lugar.z });
      expect(nodos[NODO_SALIDA]).toEqual({ x: lugar.salida.x, y: lugar.y, z: lugar.salida.z });
      const pasillo = nodos[NODO_PASILLO];
      expect(pasillo?.z).toBe(ambienteDe(lugar.ambiente).pasilloZ);
      expect(pasillo?.x).toBe(lugar.salida.x);
    }
  });

  it('los dos nodos de visita empiezan sobre el pasillo (no añaden recorrido)', () => {
    for (const { nodos } of rutas) {
      expect(nodos[NODO_VISITA - 1]).toEqual(nodos[NODO_PASILLO]);
      expect(nodos[NODO_VISITA]).toEqual(nodos[NODO_PASILLO]);
    }
  });

  it('todas terminan en el punto de pausa de la barra de café', () => {
    rutas.forEach(({ nodos }, i) => {
      const fin = nodos.at(-1) as Nodo;
      expect(fin).toEqual({ x: cafeDe(i).x, y: 0, z: cafeDe(i).z });
    });
  });

  it('la ruta al aro de luz de Contenido se queda en su ambiente y acaba frente al aro', () => {
    const luz = plano.luz;
    if (!luz) throw new Error('sin luz');
    for (const lugar of plano.lugares.filter((l) => l.ambiente === 'contenido')) {
      const nodos = crearRuta(lugar, luz, true);
      expect(nodos.at(-1)).toEqual({ x: luz.x, y: lugar.y, z: luz.z });
      expect(nodos.every((n) => n.y === lugar.y)).toBe(true);
    }
  });
});

describe('las rutas no atraviesan muebles', () => {
  it('ningún tramo entra a menos de un radio de un mueble (salvo la silla propia al levantarse)', () => {
    const choques: string[] = [];
    for (const { lugar, nodos } of rutas) {
      const nivel = ambienteDe(lugar.ambiente).nivel;
      for (const p of muestrear(nodos)) {
        if (p.escalera || nivelDeY(p.y) === undefined) continue;
        for (const m of plano.muebles) {
          if (m.id === lugar.silla || ambienteDe(m.ambiente).y !== nivelDeY(p.y)) continue;
          if (distanciaAMueble(p, m) < RADIO - EPS)
            choques.push(`${lugar.ambiente} ${lugar.x},${lugar.z} (${nivel}) con ${m.id}`);
        }
      }
    }
    // Una sola aserción: con un `expect` por muestra el test pasaba de los 5 s.
    expect(choques).toEqual([]);
  });

  it('la visita a cada colega del mismo ambiente tampoco los atraviesa', () => {
    const choques: string[] = [];
    for (const visitante of plano.lugares) {
      for (const colega of plano.lugares) {
        if (colega === visitante || colega.ambiente !== visitante.ambiente) continue;
        const nodos = rutaDe(visitante);
        escribirVisita(nodos, colega);
        expect(nodos[NODO_VISITA]).toEqual({ ...puestoDeVisita(colega), y: colega.y });
        for (const p of muestrear(nodos.slice(0, NODO_VISITA + 1))) {
          for (const m of plano.muebles) {
            if (m.id === visitante.silla || ambienteDe(m.ambiente).y !== p.y) continue;
            if (distanciaAMueble(p, m) < RADIO - EPS)
              choques.push(
                `${visitante.x},${visitante.z} visita a ${colega.x},${colega.z} con ${m.id}`,
              );
          }
        }
      }
    }
    expect(choques).toEqual([]);
  });

  it('quitarVisita devuelve los nodos de visita al pasillo', () => {
    const [a, b] = plano.lugares.filter((l) => l.ambiente === 'desarrollo');
    if (!a || !b) throw new Error('faltan lugares');
    const nodos = rutaDe(a);
    const antes = JSON.stringify(nodos);
    escribirVisita(nodos, b);
    expect(JSON.stringify(nodos)).not.toBe(antes);
    quitarVisita(nodos);
    expect(JSON.stringify(nodos)).toBe(antes);
  });
});

describe('las rutas respetan muros, vanos y suelos', () => {
  it('cruzan cada muro solo por su vano', () => {
    for (const { lugar, nodos } of rutas) {
      const muestras = muestrear(nodos).filter((p) => !p.escalera);
      for (const muro of plano.muros) {
        if (muro.eje !== 'x') continue;
        const nivelY = NIVEL_Y[muro.nivel];
        for (let i = 0; i + 1 < muestras.length; i++) {
          const a = muestras[i] as Muestra;
          const b = muestras[i + 1] as Muestra;
          if (Math.abs(a.y - nivelY) > 0.01 || Math.abs(b.y - nivelY) > 0.01) continue;
          const cruza = (a.x - muro.pos) * (b.x - muro.pos) < 0;
          if (!cruza) continue;
          const t = (muro.pos - a.x) / (b.x - a.x);
          const z = a.z + (b.z - a.z) * t;
          if (z < muro.desde || z > muro.hasta) continue;
          const v = muro.vano;
          const pasa = v !== null && Math.abs(z - v.centro) <= v.ancho / 2 + EPS;
          expect(pasa, `${lugar.ambiente} cruza el muro x=${muro.pos} en z=${z.toFixed(2)}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('todo tramo a nivel de piso pisa suelo: dentro de un ambiente y fuera de los huecos', () => {
    for (const { lugar, nodos } of rutas) {
      for (const p of muestrear(nodos)) {
        const nivel = nivelDeY(p.y);
        if (p.escalera || nivel === undefined) continue;
        const suelo = plano.ambientes.some(
          (a) =>
            a.y === nivel &&
            p.x >= a.x0 - EPS &&
            p.x <= a.x1 + EPS &&
            p.z >= a.z0 - EPS &&
            p.z <= a.z1 + EPS,
        );
        expect(
          suelo,
          `${lugar.ambiente}: (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) a y=${nivel}`,
        ).toBe(true);
        for (const h of plano.huecos) {
          if (h.y !== nivel) continue;
          const dentro =
            p.x > h.x0 + EPS && p.x < h.x1 - EPS && p.z > h.z0 + EPS && p.z < h.z1 - EPS;
          expect(dentro, `${lugar.ambiente} pisa el hueco ${h.id}`).toBe(false);
        }
      }
    }
  });

  it('el paso por una escalera nunca invade su huella desde el piso donde arranca', () => {
    for (const { lugar, nodos } of rutas) {
      for (const p of muestrear(nodos)) {
        if (p.escalera) continue;
        for (const e of plano.escaleras) {
          const t = e.tramos[0];
          if (!t || Math.abs(t.desde.y - p.y) > 0.01) continue;
          const ultimo = e.tramos.at(-1) ?? t;
          const x0 = Math.min(t.desde.x, ultimo.hasta.x) - t.ancho / 2 + 0.05;
          const x1 = Math.max(t.desde.x, ultimo.hasta.x) + t.ancho / 2 - 0.05;
          const z0 = Math.min(t.desde.z, ultimo.hasta.z) + 0.05;
          const z1 = Math.max(t.desde.z, ultimo.hasta.z) - 0.05;
          // El caracol gira sobre sí mismo: su huella en planta es el círculo de la hélice.
          const dentro = p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;
          expect(
            dentro,
            `${lugar.ambiente} (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) en ${e.id}`,
          ).toBe(false);
        }
      }
    }
  });
});

describe('las rutas cambian de piso solo por escaleras', () => {
  const tramos = plano.escaleras.flatMap((e) => e.tramos);

  it('la altura solo cambia en un segmento que es un tramo de escalera', () => {
    for (const { lugar, nodos } of rutas) {
      for (let i = 0; i + 1 < nodos.length; i++) {
        const a = nodos[i] as Nodo;
        const b = nodos[i + 1] as Nodo;
        if (Math.abs(a.y - b.y) < EPS) continue;
        const esTramo = tramos.some(
          (t) => (near(a, t.desde) && near(b, t.hasta)) || (near(a, t.hasta) && near(b, t.desde)),
        );
        expect(esTramo, `${lugar.ambiente}: segmento ${i}`).toBe(true);
      }
    }
  });

  it('desde el piso 2, el piso 3 y la torre se baja hasta el piso 1 por las escaleras', () => {
    for (const { lugar, nodos } of rutas) {
      const y = ambienteDe(lugar.ambiente).y;
      const bajadas = nodos.slice(1).filter((n, i) => (nodos[i] as Nodo).y - n.y > EPS);
      const ys = nodos.map((n) => n.y);
      expect(Math.min(...ys), lugar.ambiente).toBe(0);
      if (y === 0) {
        expect(bajadas, lugar.ambiente).toHaveLength(0);
      } else {
        expect(bajadas.length, lugar.ambiente).toBeGreaterThan(0);
      }
    }
  });

  it('Investigación baja por el caracol y luego por las dos escultóricas', () => {
    const torre = rutas.find((r) => r.lugar.ambiente === 'investigacion');
    if (!torre) throw new Error('sin lugares en la torre');
    const orden = plano.escaleras
      .filter((e) => e.tramos.some((t) => torre.nodos.some((n) => near(n, t.hasta))))
      .map((e) => e.id);
    expect(orden).toEqual(
      expect.arrayContaining(['caracol', 'escultorica-2-3', 'escultorica-1-2']),
    );
    const posicion = (id: string) => {
      const e = plano.escaleras.find((s) => s.id === id);
      const hasta = e?.tramos.at(-1)?.hasta;
      return torre.nodos.findIndex((n) => hasta !== undefined && near(n, hasta));
    };
    expect(posicion('caracol')).toBeLessThan(posicion('escultorica-2-3'));
    expect(posicion('escultorica-2-3')).toBeLessThan(posicion('escultorica-1-2'));
  });
});

function near(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-6;
}
