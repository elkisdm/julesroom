import { crearMapaColisionDe, puntoLibre } from '../animacion/colision';
import type { MapaColision } from '../animacion/colision';
import type { Azar } from '../azar';
import type { Escenario, Reunion } from './tipos';

/** Holgura (m) que se le pide a quien está de pie respecto de cualquier mueble o muro. */
const HOLGURA = 0.3;
const INTENTOS = 10;

/** Dónde queda una persona: el punto y, si está en una reunión, el centro al que mira. */
export interface PuntoDeReunion {
  x: number;
  z: number;
  mirar?: { x: number; z: number };
}

/**
 * Reunión de la persona `i` y su lugar `k` en ella: se llenan en orden, cada una hasta su cupo.
 * `null` pasada la suma de cupos: esa persona no tiene reunión y pasea.
 */
export function reunionDe(
  reuniones: readonly Reunion[],
  i: number,
): { reunion: Reunion; lugar: number } | null {
  let resto = i;
  for (const reunion of reuniones) {
    if (resto < reunion.cupo) return { reunion, lugar: resto };
    resto -= reunion.cupo;
  }
  return null;
}

const mapas = new WeakMap<Escenario, MapaColision>();
function mapaDe(escenario: Escenario, y: number): MapaColision {
  let mapa = mapas.get(escenario);
  if (!mapa) {
    mapa = crearMapaColisionDe(escenario, y);
    mapas.set(escenario, mapa);
  }
  return mapa;
}

/**
 * Punto de la persona `i` (índice de la persona simulada) del escenario: reparte a la gente por los
 * puntos de reunión (`escenario.reuniones`) llenando cada cupo, de pie en el círculo de su reunión y mirando
 * al centro. Quien queda fuera de todos los cupos recibe un punto libre del paseo. Nunca cae en una celda
 * bloqueada: reintenta con otro ángulo y, si no hay lugar, se junta al paseo.
 */
export function puntoDeReunion(
  escenario: Escenario,
  i: number,
  azar: Azar,
  y = escenario.entradas[0]?.y ?? 0,
): PuntoDeReunion {
  const mapa = mapaDe(escenario, y);
  const asignada = reunionDe(escenario.reuniones, i);
  if (asignada) {
    const { reunion, lugar } = asignada;
    for (let intento = 0; intento < INTENTOS; intento++) {
      const angulo = (2 * Math.PI * (lugar + 0.5)) / reunion.cupo + (azar() - 0.5) * 0.9 + intento * 1.7;
      const distancia = reunion.radio * (0.85 + 0.15 * azar());
      const x = reunion.x + Math.sin(angulo) * distancia;
      const z = reunion.z + Math.cos(angulo) * distancia;
      if (puntoLibre(mapa, x, z, HOLGURA)) return { x, z, mirar: { x: reunion.x, z: reunion.z } };
    }
  }
  const { paseo } = escenario;
  for (let intento = 0; intento < 50; intento++) {
    const x = paseo.x0 + azar() * (paseo.x1 - paseo.x0);
    const z = paseo.z0 + azar() * (paseo.z1 - paseo.z0);
    if (puntoLibre(mapa, x, z, HOLGURA)) return { x, z };
  }
  return { x: (paseo.x0 + paseo.x1) / 2, z: (paseo.z0 + paseo.z1) / 2 };
}
