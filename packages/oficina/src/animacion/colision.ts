import { cajaDe, NIVEL_Y, plano } from '../mansion/plano';
import type { Caja, Nivel } from '../mansion/plano';
import { PARAMETROS_SUELO } from '../escenarios/suelo';
import type { Suelo } from '../escenarios/suelo';
import type { Escenario } from '../escenarios/tipos';

/**
 * Mapa de colisión de UNA planta para el avatar propio: círculo contra cajas alineadas a los ejes.
 *
 * Qué bloquea (todo sale de `plano`, se calcula una sola vez en `crearMapaColision`):
 * - Muros del nivel, con el hueco de su vano de puerta (`ANCHO_VANO`) abierto. Barandas y bordes
 *   también bloquean; el grosor de la pared es `GROSOR_MURO`.
 * - Muebles con su huella (`cajaDe`), salvo los planos (espejo de agua, `alto` ≤ `ALTO_PLANO`) y los
 *   colgados sobre la cabeza (`y` ≥ `ALTURA_AVATAR`).
 * - Todo lo que no sea suelo del nivel: el vacío del atrio en los pisos altos, el exterior de la
 *   casa y lo que queda fuera de los ambientes (se obtiene por complemento de la unión de ambientes).
 * - Huecos de losa cuyo `y` es el de este nivel, y la piscina en el primer piso.
 * Las escaleras que arrancan en el nivel bloquean su huella más `MARGEN_ESCALERA` (no hay subida de nivel).
 *
 * Es colisión clásica de círculo contra AABB con sub-pasos (nunca avanza más de `radio / 2` entre
 * resoluciones, así que no atraviesa un muro con pasos grandes) y deslizamiento por la pared. No
 * viene de las secciones A6/A7 de investigacion-videojuegos.md (que cubren red y presupuesto).
 *
 * Con alturas (`crearMapaDeSuelo`, el mundo recorrible de `escenarios/suelo.ts`): cada caja tiene un
 * rango vertical y solo bloquea a quien tiene los pies en `y` si su tope queda a más de un paso por
 * encima (`y1 > y + paso`) y su base le alcanza el cuerpo (`y0 < y + altoCuerpo`). Así los muros de otra
 * planta no estorban, lo bajo se salta y lo alto se pasa por debajo. Las caras de las superficies
 * (peldaños, tarimas, losas, muebles pisables) chocan con el radio del pie (`RADIO_PIE`), no con el del
 * cuerpo: el cuerpo sube una escalera aunque los peldaños de más adelante le queden más altos que un
 * paso. Las funciones reciben la altura de los pies como último argumento; sin ella (NaN) toda caja
 * bloquea. Una grilla (`CELDA_MAPA`) limita cada consulta a las cajas cercanas.
 *
 * REGLA DE ORO: `moverConColision`, `puntoLibre` y `lineaLibre` no asignan memoria.
 */

/** Grosor (m) con que se materializan los muros. */
export const GROSOR_MURO = 0.2;
/** Muebles de esta altura o menos (espejo de agua) se pisan. */
export const ALTO_PLANO = 0.15;
/** Muebles colgados desde esta altura (m) quedan sobre la cabeza y no bloquean. */
export const ALTURA_AVATAR = 1.7;

/** Margen (m) alrededor de una escalera para que brazos y hombros no la atraviesen. */
export const MARGEN_ESCALERA = 0.15;

/** Tolerancia: tras empujar fuera de una caja el círculo queda a `radio` exacto, no a `radio - ε`. */
const EPS = 1e-6;
/** Distancia grande con que se cierran los bordes exteriores del mapa. */
const EXTERIOR = 50;
const PASADAS = 4;
const MAX_SUBPASOS = 512;

export interface MapaColision {
  /** x0, x1, z0, z1 por caja, en ese orden. */
  cajas: Float64Array;
  n: number;
  /** Rectángulo que contiene el suelo transitable del nivel. */
  limites: Caja;
  /** Mundo con alturas: rango vertical (y0, y1) de cada caja. Sin él, toda caja bloquea a cualquier altura. */
  alturas?: Float64Array;
  /**
   * Radio de contacto de cada caja si es menor que el del cuerpo (0: el del cuerpo). Las caras de las
   * superficies chocan con `RADIO_PIE`; un sólido puede traer el suyo (`Solido.radio`).
   */
  radios?: Float64Array;
  /** Lo más alto que se sube caminando y el alto del cuerpo (los del suelo). */
  paso?: number;
  altoCuerpo?: number;
  /** El suelo del que salió el mapa: lo usan el avatar (alturas) y la navegación (varias plantas). */
  suelo?: Suelo;
  /** Grilla: por celda, las cajas que la tocan infladas en `RADIO_MAX_REJILLA` (CSR). */
  rejilla?: Rejilla;
}

interface Rejilla {
  x0: number;
  z0: number;
  cols: number;
  rows: number;
  ini: Int32Array;
  items: Int32Array;
}

/** Radio (m) del pie: con él chocan las caras de las superficies (peldaño, tarima, losa, mueble pisable). */
export const RADIO_PIE = 0.1;
/** Lado (m) de las celdas de la grilla de un mapa con alturas. */
const CELDA_MAPA = 1;
/** Radio máximo que atiende la grilla; uno mayor recorre todas las cajas. */
const RADIO_MAX_REJILLA = 0.5;
/** Tablas de los peldaños de caracol: cuántas cajas por sector (a lo largo del radio). */
const CAJAS_POR_SECTOR = 4;

export interface SalidaMovimiento {
  x: number;
  z: number;
}

/**
 * Mapa a partir de cajas explícitas y su recinto (`limites`: fuera de él todo está bloqueado, con
 * cuatro bandas exteriores). Sirve para escenas sintéticas y pruebas.
 */
export function crearMapaDeCajas(cajas: readonly Caja[], limites: Caja): MapaColision {
  const { x0, x1, z0, z1 } = limites;
  const todas: Caja[] = [
    ...cajas,
    { x0: x0 - EXTERIOR, x1: x0, z0: z0 - EXTERIOR, z1: z1 + EXTERIOR },
    { x0: x1, x1: x1 + EXTERIOR, z0: z0 - EXTERIOR, z1: z1 + EXTERIOR },
    { x0, x1, z0: z0 - EXTERIOR, z1: z0 },
    { x0, x1, z0: z1, z1: z1 + EXTERIOR },
  ];
  const datos = new Float64Array(todas.length * 4);
  todas.forEach((c, i) => {
    datos[i * 4] = c.x0;
    datos[i * 4 + 1] = c.x1;
    datos[i * 4 + 2] = c.z0;
    datos[i * 4 + 3] = c.z1;
  });
  return { cajas: datos, n: todas.length, limites: { ...limites } };
}

function unicos(valores: number[]): number[] {
  return [...new Set(valores)].sort((a, b) => a - b);
}

/**
 * Cajas del complemento del suelo: una por cada celda de la grilla comprimida de los bordes de los
 * ambientes que no cae dentro de ninguno.
 */
function cajasSinSuelo(suelo: readonly Caja[]): Caja[] {
  const xs = unicos(suelo.flatMap((a) => [a.x0, a.x1]));
  const zs = unicos(suelo.flatMap((a) => [a.z0, a.z1]));
  const cajas: Caja[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const x0 = xs[i] as number;
      const x1 = xs[i + 1] as number;
      const z0 = zs[j] as number;
      const z1 = zs[j + 1] as number;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const cubierta = suelo.some((a) => cx > a.x0 && cx < a.x1 && cz > a.z0 && cz < a.z1);
      if (!cubierta) cajas.push({ x0, x1, z0, z1 });
    }
  }
  return cajas;
}

/** Las cajas que bloquean y el recinto caminable de un nivel de la mansión. */
export function cajasDeNivel(nivel: Nivel): { cajas: Caja[]; limites: Caja } {
  const suelo = plano.ambientes.filter((a) => a.nivel === nivel);
  const cajas: Caja[] = cajasSinSuelo(suelo);
  const h = GROSOR_MURO / 2;

  for (const m of plano.muros) {
    if (m.nivel !== nivel) continue;
    // Tramos del muro: si hay vano, queda abierto su ancho centrado en `centro`.
    const tramos: [number, number][] = [];
    if (m.vano) {
      const a = m.vano.centro - m.vano.ancho / 2;
      const b = m.vano.centro + m.vano.ancho / 2;
      if (a > m.desde) tramos.push([m.desde, a]);
      if (b < m.hasta) tramos.push([b, m.hasta]);
    } else {
      tramos.push([m.desde, m.hasta]);
    }
    for (const [d, hasta] of tramos) {
      cajas.push(
        m.eje === 'x'
          ? { x0: m.pos - h, x1: m.pos + h, z0: d, z1: hasta }
          : { x0: d, x1: hasta, z0: m.pos - h, z1: m.pos + h },
      );
    }
  }

  for (const m of plano.muebles) {
    const a = suelo.find((s) => s.id === m.ambiente);
    if (!a || m.alto <= ALTO_PLANO || m.y >= ALTURA_AVATAR) continue;
    cajas.push(cajaDe(m));
  }

  // La escalera que arranca en este nivel es un sólido (se camina bajo ella o contra sus peldaños);
  // con un margen para que los brazos del personaje no la atraviesen.
  for (const esc of plano.escaleras) {
    for (const t of esc.tramos) {
      if (t.desde.y !== NIVEL_Y[nivel] || t.hasta.y <= t.desde.y) continue;
      const m = t.ancho / 2 + MARGEN_ESCALERA;
      cajas.push({
        x0: Math.min(t.desde.x, t.hasta.x) - m,
        x1: Math.max(t.desde.x, t.hasta.x) + m,
        z0: Math.min(t.desde.z, t.hasta.z) - m,
        z1: Math.max(t.desde.z, t.hasta.z) + m,
      });
    }
  }

  for (const hu of plano.huecos) {
    if (hu.y === NIVEL_Y[nivel]) cajas.push({ x0: hu.x0, x1: hu.x1, z0: hu.z0, z1: hu.z1 });
  }
  if (nivel === 'piso1') {
    const p = plano.piscina;
    cajas.push({ x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1 });
  }

  const limites: Caja = {
    x0: Math.min(...suelo.map((a) => a.x0)),
    x1: Math.max(...suelo.map((a) => a.x1)),
    z0: Math.min(...suelo.map((a) => a.z0)),
    z1: Math.max(...suelo.map((a) => a.z1)),
  };
  return { cajas, limites };
}

/** Crea el mapa de colisión de un nivel de la mansión (se hace una vez; asigna). */
export function crearMapaColision(nivel: Nivel): MapaColision {
  const { cajas, limites } = cajasDeNivel(nivel);
  return crearMapaDeCajas(cajas, limites);
}

/** Crea el mapa de colisión del nivel `y` de un escenario (se hace una vez; asigna). */
export function crearMapaColisionDe(escenario: Escenario, y: number): MapaColision {
  const { cajas, limites } = escenario.colision(y);
  return crearMapaDeCajas(cajas, limites);
}

/**
 * Mapa con alturas del mundo recorrible (se hace una vez por escenario; asigna): los sólidos del suelo,
 * las caras de sus superficies (con el radio del pie) y cuatro bandas exteriores que bloquean a toda
 * altura. Una rampa no tiene cara (se sube andando). Un peldaño de caracol se aproxima con
 * `CAJAS_POR_SECTOR` cajas a lo largo de su radio, cada una del ancho de su arco.
 */
export function crearMapaDeSuelo(suelo: Suelo): MapaColision {
  const cajas: Caja[] = [];
  const rangos: number[] = [];
  const radios: number[] = [];
  const agregar = (c: Caja, y0: number, y1: number, radio: number) => {
    cajas.push(c);
    rangos.push(y0, y1);
    radios.push(radio);
  };
  for (const s of suelo.superficies) {
    if (s.forma === 'caja') {
      agregar(
        { x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1 },
        s.y - s.grosor,
        s.y,
        s.radio ?? RADIO_PIE,
      );
    } else if (s.forma === 'sector') {
      const medio = (s.desde + s.hasta) / 2;
      const arco = s.hasta - s.desde;
      for (let k = 0; k < CAJAS_POR_SECTOR; k++) {
        const r = s.r0 + ((s.r1 - s.r0) * (k + 0.5)) / CAJAS_POR_SECTOR;
        const h = Math.min(0.15, Math.max(0.03, (r * arco) / 2));
        const x = s.cx + r * Math.cos(medio);
        const z = s.cz + r * Math.sin(medio);
        agregar({ x0: x - h, x1: x + h, z0: z - h, z1: z + h }, s.y - s.grosor, s.y, RADIO_PIE);
      }
    }
  }
  for (const s of suelo.solidos) {
    agregar(
      s,
      s.y0,
      s.infranqueable ? Math.max(s.y1, s.y0 + PARAMETROS_SUELO.alturaInfranqueable) : s.y1,
      s.radio ?? 0,
    );
  }
  const { x0, x1, z0, z1 } = suelo.limites;
  for (const c of [
    { x0: x0 - EXTERIOR, x1: x0, z0: z0 - EXTERIOR, z1: z1 + EXTERIOR },
    { x0: x1, x1: x1 + EXTERIOR, z0: z0 - EXTERIOR, z1: z1 + EXTERIOR },
    { x0, x1, z0: z0 - EXTERIOR, z1: z0 },
    { x0, x1, z0: z1, z1: z1 + EXTERIOR },
  ]) {
    agregar(c, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 0);
  }
  const datos = new Float64Array(cajas.length * 4);
  cajas.forEach((c, i) => {
    datos[i * 4] = c.x0;
    datos[i * 4 + 1] = c.x1;
    datos[i * 4 + 2] = c.z0;
    datos[i * 4 + 3] = c.z1;
  });
  return {
    cajas: datos,
    n: cajas.length,
    limites: { ...suelo.limites },
    alturas: Float64Array.from(rangos),
    radios: Float64Array.from(radios),
    paso: suelo.paso,
    altoCuerpo: suelo.altoCuerpo,
    suelo,
    rejilla: crearRejilla(datos, cajas.length, suelo.limites),
  };
}

function crearRejilla(c: Float64Array, n: number, limites: Caja): Rejilla {
  const x0 = limites.x0 - CELDA_MAPA;
  const z0 = limites.z0 - CELDA_MAPA;
  const cols = Math.ceil((limites.x1 - limites.x0) / CELDA_MAPA) + 2;
  const rows = Math.ceil((limites.z1 - limites.z0) / CELDA_MAPA) + 2;
  const g = RADIO_MAX_REJILLA;
  const rango = (i: number) => {
    const o = i * 4;
    const clamp = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);
    return [
      clamp(Math.floor(((c[o] as number) - g - x0) / CELDA_MAPA), cols - 1),
      clamp(Math.floor(((c[o + 1] as number) + g - x0) / CELDA_MAPA), cols - 1),
      clamp(Math.floor(((c[o + 2] as number) - g - z0) / CELDA_MAPA), rows - 1),
      clamp(Math.floor(((c[o + 3] as number) + g - z0) / CELDA_MAPA), rows - 1),
    ] as const;
  };
  const ini = new Int32Array(cols * rows + 1);
  for (let i = 0; i < n; i++) {
    const [c0, c1, r0, r1] = rango(i);
    for (let r = r0; r <= r1; r++) for (let k = c0; k <= c1; k++) ini[r * cols + k + 1]!++;
  }
  for (let k = 1; k <= cols * rows; k++) ini[k]! += ini[k - 1] as number;
  const items = new Int32Array(ini[cols * rows] as number);
  const lleno = new Int32Array(cols * rows);
  for (let i = 0; i < n; i++) {
    const [c0, c1, r0, r1] = rango(i);
    for (let r = r0; r <= r1; r++) {
      for (let k = c0; k <= c1; k++) {
        const celda = r * cols + k;
        items[(ini[celda] as number) + lleno[celda]!++] = i;
      }
    }
  }
  return { x0, z0, cols, rows, ini, items };
}

/** Rango de la grilla que hay que recorrer para (x, z) y ese radio: [desde, hasta) en `rango`. */
const rango = new Int32Array(2);
function candidatas(m: MapaColision, x: number, z: number, radio: number): Int32Array | null {
  const g = m.rejilla;
  if (!g || radio > RADIO_MAX_REJILLA) {
    rango[0] = 0;
    rango[1] = m.n;
    return null;
  }
  let c = Math.floor((x - g.x0) / CELDA_MAPA);
  let r = Math.floor((z - g.z0) / CELDA_MAPA);
  c = c < 0 ? 0 : c >= g.cols ? g.cols - 1 : c;
  r = r < 0 ? 0 : r >= g.rows ? g.rows - 1 : r;
  const k = r * g.cols + c;
  rango[0] = g.ini[k] as number;
  rango[1] = g.ini[k + 1] as number;
  return g.items;
}

/** ¿La caja `i` bloquea a unos pies en `y`? Sin alturas o sin `y`, siempre. */
function bloquea(m: MapaColision, i: number, y: number): boolean {
  const a = m.alturas;
  if (!a || y !== y) return true;
  return (
    (a[i * 2 + 1] as number) > y + (m.paso as number) &&
    (a[i * 2] as number) < y + (m.altoCuerpo as number)
  );
}

/** Radio con que choca la caja `i`: el suyo si es menor que el pedido (cara de superficie, caracol). */
function radioDe(m: MapaColision, i: number, radio: number): number {
  const r = m.radios ? (m.radios[i] as number) : 0;
  return r > 0 && r < radio ? r : radio;
}

/**
 * Altura (m) de la base de lo más bajo que cubre a un cuerpo de ese radio en (x, z) por encima de
 * `yCabeza` (la losa de la planta de arriba, un mueble volado): hasta ahí sube la cabeza al saltar.
 * `Infinity` si no hay nada; sin alturas, tampoco hay techo. No asigna.
 */
export function techoSobre(
  m: MapaColision,
  x: number,
  z: number,
  radio: number,
  yCabeza: number,
): number {
  const a = m.alturas;
  if (!a) return Number.POSITIVE_INFINITY;
  const c = m.cajas;
  const lista = candidatas(m, x, z, radio);
  const fin = rango[1] as number;
  let techo = Number.POSITIVE_INFINITY;
  for (let k = rango[0] as number; k < fin; k++) {
    const i = lista ? (lista[k] as number) : k;
    const base = a[i * 2] as number;
    if (base < yCabeza - EPS || base >= techo) continue;
    const r = radioDe(m, i, radio) - EPS;
    const o = i * 4;
    const cx = Math.min(Math.max(x, c[o] as number), c[o + 1] as number);
    const cz = Math.min(Math.max(z, c[o + 2] as number), c[o + 3] as number);
    if ((x - cx) ** 2 + (z - cz) ** 2 < (r > 0 ? r * r : 0) || (r <= 0 && x === cx && z === cz)) {
      techo = base;
    }
  }
  return techo;
}

/**
 * ¿Un círculo de ese radio centrado en (x, z) queda libre de toda caja? Con `y` (pies) en un mapa con
 * alturas, solo cuentan las cajas que bloquean a esa altura.
 */
export function puntoLibre(
  m: MapaColision,
  x: number,
  z: number,
  radio: number,
  y = Number.NaN,
): boolean {
  const c = m.cajas;
  const lista = candidatas(m, x, z, radio);
  const fin = rango[1] as number;
  for (let k = rango[0] as number; k < fin; k++) {
    const i = lista ? (lista[k] as number) : k;
    if (m.alturas && !bloquea(m, i, y)) continue;
    const r = radioDe(m, i, radio) - EPS;
    const r2 = r > 0 ? r * r : 0;
    const o = i * 4;
    const cx =
      x < (c[o] as number) ? (c[o] as number) : x > (c[o + 1] as number) ? (c[o + 1] as number) : x;
    const cz =
      z < (c[o + 2] as number)
        ? (c[o + 2] as number)
        : z > (c[o + 3] as number)
          ? (c[o + 3] as number)
          : z;
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r2 || (r2 === 0 && dx === 0 && dz === 0)) return false;
  }
  return true;
}

/**
 * ¿El círculo puede ir en línea recta de (x0, z0) a (x1, z1)? Cada caja se infla por `radio` y se
 * prueba el segmento contra ese rectángulo (conservador en las esquinas: nunca dice libre algo
 * que choca). Rozar un borde cuenta como libre. Con `y`, solo las cajas que bloquean a esa altura.
 */
export function lineaLibre(
  m: MapaColision,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  radio: number,
  y = Number.NaN,
): boolean {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const c = m.cajas;
  for (let i = 0; i < m.n; i++) {
    if (m.alturas && !bloquea(m, i, y)) continue;
    const ri = radioDe(m, i, radio);
    const r = ri > EPS ? ri - EPS : 0;
    const o = i * 4;
    const bx0 = (c[o] as number) - r;
    const bx1 = (c[o + 1] as number) + r;
    const bz0 = (c[o + 2] as number) - r;
    const bz1 = (c[o + 3] as number) + r;
    let t0 = 0;
    let t1 = 1;
    if (Math.abs(dx) < 1e-12) {
      if (x0 <= bx0 || x0 >= bx1) continue;
    } else {
      let a = (bx0 - x0) / dx;
      let b = (bx1 - x0) / dx;
      if (a > b) {
        const t = a;
        a = b;
        b = t;
      }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 >= t1) continue;
    }
    if (Math.abs(dz) < 1e-12) {
      if (z0 <= bz0 || z0 >= bz1) continue;
    } else {
      let a = (bz0 - z0) / dz;
      let b = (bz1 - z0) / dz;
      if (a > b) {
        const t = a;
        a = b;
        b = t;
      }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 >= t1) continue;
    }
    return false;
  }
  return true;
}

const p = new Float64Array(4);
const X = 0;
const Z = 1;
const X_BUENO = 2;
const Z_BUENO = 3;

/** Empuja el círculo fuera de todas las cajas (varias pasadas por las esquinas); true si lo logra. */
function resolver(m: MapaColision, radio: number, y: number): boolean {
  const c = m.cajas;
  for (let pasada = 0; pasada < PASADAS; pasada++) {
    let movido = false;
    const lista = candidatas(m, p[X] as number, p[Z] as number, radio);
    const fin = rango[1] as number;
    for (let k = rango[0] as number; k < fin; k++) {
      const i = lista ? (lista[k] as number) : k;
      if (m.alturas && !bloquea(m, i, y)) continue;
      const ri = radioDe(m, i, radio);
      const r2 = ri * ri;
      const o = i * 4;
      const bx0 = c[o] as number;
      const bx1 = c[o + 1] as number;
      const bz0 = c[o + 2] as number;
      const bz1 = c[o + 3] as number;
      const x = p[X] as number;
      const z = p[Z] as number;
      const cx = x < bx0 ? bx0 : x > bx1 ? bx1 : x;
      const cz = z < bz0 ? bz0 : z > bz1 ? bz1 : z;
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r2) continue;
      movido = true;
      if (d2 > 1e-18) {
        const d = Math.sqrt(d2);
        const f = (ri - d) / d;
        p[X] = x + dx * f;
        p[Z] = z + dz * f;
      } else {
        // El centro quedó dentro de la caja: sale por el lado más cercano.
        const izq = x - bx0;
        const der = bx1 - x;
        const arr = z - bz0;
        const aba = bz1 - z;
        const min = Math.min(izq, der, arr, aba);
        if (min === izq) p[X] = bx0 - ri;
        else if (min === der) p[X] = bx1 + ri;
        else if (min === arr) p[Z] = bz0 - ri;
        else p[Z] = bz1 + ri;
      }
    }
    if (!movido) return true;
  }
  return puntoLibre(m, p[X] as number, p[Z] as number, radio, y);
}

/**
 * Mueve el círculo (x, z) en (dx, dz) deslizando por las paredes. Avanza en sub-pasos de a lo
 * sumo `radio / 2` para no atravesar nada con pasos grandes; si un sub-paso queda atrapado en una
 * esquina sin salida, se queda en la última posición buena. Con `y` (pies), choca solo con lo que
 * bloquea a esa altura.
 */
export function moverConColision(
  m: MapaColision,
  x: number,
  z: number,
  dx: number,
  dz: number,
  radio: number,
  salida: SalidaMovimiento,
  y = Number.NaN,
): void {
  const largo = Math.sqrt(dx * dx + dz * dz);
  let n = Math.ceil(largo / (radio / 2));
  if (!(n >= 1)) n = 1;
  else if (n > MAX_SUBPASOS) n = MAX_SUBPASOS;
  const sx = dx / n;
  const sz = dz / n;
  p[X] = x;
  p[Z] = z;
  p[X_BUENO] = x;
  p[Z_BUENO] = z;
  for (let i = 0; i < n; i++) {
    p[X] = (p[X] as number) + sx;
    p[Z] = (p[Z] as number) + sz;
    if (!resolver(m, radio, y)) {
      p[X] = p[X_BUENO] as number;
      p[Z] = p[Z_BUENO] as number;
      break;
    }
    p[X_BUENO] = p[X] as number;
    p[Z_BUENO] = p[Z] as number;
  }
  salida.x = p[X] as number;
  salida.z = p[Z] as number;
}
