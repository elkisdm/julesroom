import { alturaEn, PARAMETROS_SUELO, superficieBajo, SIN_SUELO } from '../escenarios/suelo';
import type { Suelo } from '../escenarios/suelo';
import { lineaLibre, puntoLibre } from './colision';
import type { MapaColision } from './colision';

/**
 * Navegación por clic: A* sobre una grilla rasterizada del mapa de colisión y luego suavizado de
 * la ruta por línea de vista (`lineaLibre`).
 *
 * - `crearNavegacion` rasteriza una vez (asigna): una celda es transitable si un círculo de
 *   `radio` centrado en ella queda libre (`puntoLibre`), así que la ruta ya deja espacio al cuerpo.
 * - `buscarRuta` no asigna: cola indexada, costos y padres están preasignados en la navegación y
 *   se invalidan con una marca por búsqueda, sin limpiar los arreglos.
 * - A* usa 8 vecinos sin cortar esquinas (la diagonal exige libres sus dos ortogonales), costo
 *   octil y heurística octil (admisible y consistente: no reabre nodos).
 *
 * Varios niveles (el mapa trae `suelo`, ver `colision.crearMapaDeSuelo`): una grilla por CAPA. La capa
 * `k` es la vista desde arriba del suelo cortado a la altura `yMin + (k + 1)·ESPACIO_CAPAS`: cada celda
 * guarda la superficie más alta bajo ese corte, y es transitable si el cuerpo cabe a esa altura. Dentro
 * de una capa dos vecinas se unen si su desnivel no pasa de un paso (un peldaño, una tarima baja); entre
 * capas, la misma celda a la misma altura es el mismo lugar (costo 0). Así las escaleras (rectas y de
 * caracol) y las rampas unen los niveles sin declararlas: aparecen enteras en alguna capa. El corte
 * cada 1,2 m deja ver cada peldaño junto a su vecino aunque haya otra superficie encima (la vuelta del
 * caracol sube 2,6 m; una planta, 3,9). Bajar de una superficie alta (una mesa, un sofá) al piso es una
 * arista de un solo sentido (`bajarPorElBorde`, hasta `PARAMETROS_SUELO.alcanceSalto`): se baja caminando
 * por el borde, pero no se sube sin saltar. El suavizado por línea de vista se hace recorriendo el tramo
 * como el cuerpo (altura con `alturaEn`, sin caídas ni choques a la altura de cada muestra).
 */

export interface Navegacion {
  mapa: MapaColision;
  celda: number;
  radio: number;
  /** Esquina (x, z) de la celda (0, 0). */
  x0: number;
  z0: number;
  cols: number;
  rows: number;
  /** 1 si el círculo de `radio` cabe en el centro de la celda. */
  libre: Uint8Array;
  g: Float64Array;
  f: Float64Array;
  padre: Int32Array;
  /** `marca[i] === tick` ⇒ la celda se generó en la búsqueda en curso. */
  marca: Int32Array;
  /** `cerrada[i] === tick` ⇒ ya se expandió. */
  cerrada: Int32Array;
  tick: number;
  /** Cola de prioridad binaria indexada: celdas por f, y posición de cada celda en la cola. */
  cola: Int32Array;
  pos: Int32Array;
  nCola: number;
  /** Celdas de la ruta de origen a destino. */
  cadena: Int32Array;
  /** Búsqueda en curso: origen y destino exactos, y cuántas celdas tiene la cadena. */
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  m: number;
  /** Varios niveles: el suelo, cuántas capas hay y la altura de cada nodo (capa·celdas + celda). */
  suelo: Suelo | null;
  capas: number;
  /** Celdas por capa (cols · rows). */
  area: number;
  /** Altura de la superficie de cada nodo (NaN si no hay); `null` en un mapa de un nivel. */
  alturas: Float64Array | null;
  /** Altura de los pies en el origen exacto y en el destino de la búsqueda en curso. */
  oy: number;
  dy: number;
}

/** Separación (m) entre los cortes de las capas de la navegación en varios niveles. */
export const ESPACIO_CAPAS = 1.2;
/** Muestreo (m) con que el suavizado recorre un tramo en varios niveles. */
const MUESTREO = 0.08;
/** El origen y el destino se buscan primero entre los nodos a esta distancia vertical (m) de sus pies. */
const TOLERANCIA_ALTURA = 0.6;

const DIAGONAL = Math.SQRT2;
/** Pasos (dx, dz) de los 8 vecinos: los 4 primeros ortogonales. */
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];

export function crearNavegacion(mapa: MapaColision, celda = 0.25, radio: number): Navegacion {
  const { x0, x1, z0, z1 } = mapa.limites;
  const cols = Math.max(1, Math.ceil((x1 - x0) / celda));
  const rows = Math.max(1, Math.ceil((z1 - z0) / celda));
  const area = cols * rows;
  const suelo = mapa.suelo ?? null;
  const capas = suelo
    ? Math.max(1, Math.ceil((suelo.yMax - suelo.yMin) / ESPACIO_CAPAS + 1e-9) + 1)
    : 1;
  const total = area * capas;
  const libre = new Uint8Array(total);
  const alturas = suelo ? new Float64Array(total) : null;
  for (let k = 0; k < capas; k++) {
    const corte = suelo ? suelo.yMin + (k + 1) * ESPACIO_CAPAS : 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const cx = x0 + (i + 0.5) * celda;
        const cz = z0 + (j + 0.5) * celda;
        const n = k * area + j * cols + i;
        if (!suelo || !alturas) {
          libre[n] = puntoLibre(mapa, cx, cz, radio) ? 1 : 0;
          continue;
        }
        const h = superficieBajo(suelo, cx, cz, corte);
        alturas[n] = h === SIN_SUELO ? Number.NaN : h;
        libre[n] = h !== SIN_SUELO && puntoLibre(mapa, cx, cz, radio, h) ? 1 : 0;
      }
    }
  }
  return {
    mapa,
    celda,
    radio,
    x0,
    z0,
    cols,
    rows,
    libre,
    g: new Float64Array(total),
    f: new Float64Array(total),
    padre: new Int32Array(total),
    marca: new Int32Array(total),
    cerrada: new Int32Array(total),
    tick: 0,
    cola: new Int32Array(total),
    pos: new Int32Array(total),
    nCola: 0,
    cadena: new Int32Array(total),
    ox: 0,
    oz: 0,
    dx: 0,
    dz: 0,
    m: 0,
    suelo,
    capas,
    area,
    alturas,
    oy: 0,
    dy: 0,
  };
}

function subir(nav: Navegacion, desde: number): void {
  const { cola, pos, f } = nav;
  let i = desde;
  const nodo = cola[i] as number;
  const fn = f[nodo] as number;
  while (i > 0) {
    const padre = (i - 1) >> 1;
    const pn = cola[padre] as number;
    if ((f[pn] as number) <= fn) break;
    cola[i] = pn;
    pos[pn] = i;
    i = padre;
  }
  cola[i] = nodo;
  pos[nodo] = i;
}

function bajar(nav: Navegacion): void {
  const { cola, pos, f } = nav;
  const n = nav.nCola;
  let i = 0;
  const nodo = cola[0] as number;
  const fn = f[nodo] as number;
  for (;;) {
    let h = 2 * i + 1;
    if (h >= n) break;
    if (h + 1 < n && (f[cola[h + 1] as number] as number) < (f[cola[h] as number] as number)) h++;
    const hn = cola[h] as number;
    if ((f[hn] as number) >= fn) break;
    cola[i] = hn;
    pos[hn] = i;
    i = h;
  }
  cola[i] = nodo;
  pos[nodo] = i;
}

/** Heurística octil entre dos celdas, en unidades de celda. */
function octil(c0: number, r0: number, c1: number, r1: number): number {
  const dx = Math.abs(c0 - c1);
  const dz = Math.abs(r0 - r1);
  return dx > dz ? dx + (DIAGONAL - 1) * dz : dz + (DIAGONAL - 1) * dx;
}

function columna(nav: Navegacion, x: number): number {
  const c = Math.floor((x - nav.x0) / nav.celda);
  return c < 0 ? 0 : c >= nav.cols ? nav.cols - 1 : c;
}

function fila(nav: Navegacion, z: number): number {
  const r = Math.floor((z - nav.z0) / nav.celda);
  return r < 0 ? 0 : r >= nav.rows ? nav.rows - 1 : r;
}

/**
 * El nodo transitable más cercano (euclidiano en planta) al punto, buscando por anillos; -1 si no hay.
 * En varios niveles, entre los nodos de cada celda prefiere el de altura más cercana a `y` y solo acepta
 * los que están a `tolerancia` de ella (sin `y` o con tolerancia infinita, cualquiera).
 */
function celdaLibreCercana(
  nav: Navegacion,
  x: number,
  z: number,
  y = Number.NaN,
  tolerancia = Infinity,
): number {
  const c0 = columna(nav, x);
  const r0 = fila(nav, z);
  const { alturas, area, capas } = nav;
  const maxAnillo = Math.max(nav.cols, nav.rows);
  let mejor = -1;
  let mejorD2 = Infinity;
  let anilloHallado = -1;
  for (let a = 0; a <= maxAnillo; a++) {
    // Un anillo más allá del primero con celdas libres basta: la más cercana puede estar ahí.
    if (anilloHallado >= 0 && a > anilloHallado + 1) break;
    for (let dr = -a; dr <= a; dr++) {
      const r = r0 + dr;
      if (r < 0 || r >= nav.rows) continue;
      const borde = dr === -a || dr === a;
      const paso = borde || a === 0 ? 1 : 2 * a;
      for (let dc = -a; dc <= a; dc += paso) {
        const c = c0 + dc;
        if (c < 0 || c >= nav.cols) continue;
        const celda = r * nav.cols + c;
        const ex = nav.x0 + (c + 0.5) * nav.celda - x;
        const ez = nav.z0 + (r + 0.5) * nav.celda - z;
        for (let k = 0; k < capas; k++) {
          const idx = k * area + celda;
          if (nav.libre[idx] !== 1) continue;
          let dy = 0;
          if (alturas && y === y) {
            dy = Math.abs((alturas[idx] as number) - y);
            if (dy > tolerancia) continue;
          }
          // La altura pesa como una distancia en planta: entre dos pisos, el de los pies.
          const d2 = ex * ex + ez * ez + dy * dy;
          if (d2 < mejorD2) {
            mejorD2 = d2;
            mejor = idx;
          }
          if (anilloHallado < 0) anilloHallado = a;
        }
      }
    }
  }
  return mejor;
}

/** Nodo de origen o destino: primero cerca de la altura pedida; si no hay, en cualquier capa. */
function nodoCercano(
  nav: Navegacion,
  x: number,
  z: number,
  y: number,
  tolerancia = TOLERANCIA_ALTURA,
): number {
  if (!nav.alturas || y !== y) return celdaLibreCercana(nav, x, z);
  const cerca = celdaLibreCercana(nav, x, z, y, tolerancia);
  return cerca >= 0 ? cerca : celdaLibreCercana(nav, x, z, y);
}

/**
 * ¿Dos celdas vecinas (alturas ha, hb; centros en las columnas/filas dadas) se unen andando? Con un
 * desnivel de hasta un paso, sí. Una celda (0,25 m) puede abarcar dos peldaños: entre uno y dos pasos
 * se mira la superficie en el punto medio, que debe quedar a un paso de ambas.
 */
function unidas(
  nav: Navegacion,
  ha: number,
  hb: number,
  ca: number,
  ra: number,
  cb: number,
  rb: number,
): boolean {
  const suelo = nav.suelo;
  if (!suelo) return true;
  const d = Math.abs(hb - ha);
  if (d <= suelo.paso) return true;
  if (!(d <= 2 * suelo.paso)) return false;
  const bajo = ha < hb ? ha : hb;
  const alto = ha < hb ? hb : ha;
  const mx = nav.x0 + ((ca + cb) / 2 + 0.5) * nav.celda;
  const mz = nav.z0 + ((ra + rb) / 2 + 0.5) * nav.celda;
  const hm = alturaEn(suelo, mx, mz, bajo);
  return hm - bajo <= suelo.paso + 1e-9 && alto - hm <= suelo.paso + 1e-9;
}

/** Relaja el nodo `v` (en la celda nc, nr) desde `actual` con el costo dado; destino en (ec, er). */
function relajar(
  nav: Navegacion,
  actual: number,
  v: number,
  nc: number,
  nr: number,
  costo: number,
  ec: number,
  er: number,
): void {
  const { g, f, padre, marca, cola, pos } = nav;
  if (marca[v] !== nav.tick) {
    marca[v] = nav.tick;
    g[v] = costo;
    f[v] = costo + octil(nc, nr, ec, er);
    padre[v] = actual;
    cola[nav.nCola] = v;
    pos[v] = nav.nCola;
    nav.nCola++;
    subir(nav, nav.nCola - 1);
  } else if (costo < (g[v] as number)) {
    g[v] = costo;
    f[v] = costo + octil(nc, nr, ec, er);
    padre[v] = actual;
    subir(nav, pos[v] as number);
  }
}

/**
 * Bajada por el borde: de una superficie alta a una celda libre dos pasos más allá y más baja (hasta el
 * alcance del salto), con la celda de en medio no libre: a ras del piso el cuerpo no cabe pegado al mueble,
 * pero sí a la altura de la superficie (así se distingue un borde de un muro, que cierra a toda altura).
 */
function bajarPorElBorde(
  nav: Navegacion,
  actual: number,
  ha: number,
  ec: number,
  er: number,
): void {
  const { cols, rows, libre, cerrada, alturas, area } = nav;
  const capa = (actual / area) | 0;
  const celda = actual - capa * area;
  const c = celda % cols;
  const r = (celda / cols) | 0;
  const ga = nav.g[actual] as number;
  const paso = nav.suelo ? nav.suelo.paso : 0;
  for (let d = 0; d < 8; d++) {
    const nc = c + 2 * (DX[d] as number);
    const nr = r + 2 * (DZ[d] as number);
    if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
    const v = capa * area + nr * cols + nc;
    if (libre[v] !== 1 || cerrada[v] === nav.tick) continue;
    const caida = ha - (alturas as Float64Array)[v]!;
    if (!(caida > paso && caida <= PARAMETROS_SUELO.alcanceSalto)) continue;
    // Con la celda de en medio libre, el camino normal ya la cruza (peldaños seguidos): no es un borde.
    if (libre[capa * area + (r + (DZ[d] as number)) * cols + c + (DX[d] as number)] === 1) continue;
    const mx = nav.x0 + (c + (DX[d] as number) + 0.5) * nav.celda;
    const mz = nav.z0 + (r + (DZ[d] as number) + 0.5) * nav.celda;
    if (!puntoLibre(nav.mapa, mx, mz, nav.radio, ha)) continue;
    relajar(nav, actual, v, nc, nr, ga + 2 * (d >= 4 ? DIAGONAL : 1), ec, er);
  }
}

/** A* del nodo `s` al `e`; devuelve cuántos nodos tiene la ruta (en `nav.cadena`) o 0. */
function aEstrella(nav: Navegacion, s: number, e: number): number {
  const { cols, rows, libre, g, f, padre, marca, cerrada, cola, pos, area, capas, alturas } = nav;
  const paso = nav.suelo ? nav.suelo.paso : 0;
  nav.tick++;
  const tick = nav.tick;
  const ecelda = e % area;
  const ec = ecelda % cols;
  const er = (ecelda / cols) | 0;
  nav.nCola = 0;
  marca[s] = tick;
  g[s] = 0;
  const scelda = s % area;
  f[s] = octil(scelda % cols, (scelda / cols) | 0, ec, er);
  padre[s] = -1;
  cola[0] = s;
  pos[s] = 0;
  nav.nCola = 1;

  while (nav.nCola > 0) {
    const actual = cola[0] as number;
    nav.nCola--;
    if (nav.nCola > 0) {
      cola[0] = cola[nav.nCola] as number;
      pos[cola[0] as number] = 0;
      bajar(nav);
    }
    cerrada[actual] = tick;
    if (actual === e) {
      let m = 0;
      for (let k = actual; k !== -1; k = padre[k] as number) m++;
      let i = m;
      for (let k = actual; k !== -1; k = padre[k] as number) nav.cadena[--i] = k;
      return m;
    }
    const capa = (actual / area) | 0;
    const celda = actual - capa * area;
    const base = capa * area;
    const c = celda % cols;
    const r = (celda / cols) | 0;
    const ga = g[actual] as number;
    const ha = alturas ? (alturas[actual] as number) : 0;
    for (let d = 0; d < 8; d++) {
      const nc = c + (DX[d] as number);
      const nr = r + (DZ[d] as number);
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const vecino = base + nr * cols + nc;
      if (libre[vecino] !== 1 || cerrada[vecino] === tick) continue;
      let desnivel = 0;
      if (alturas) {
        const hv = alturas[vecino] as number;
        desnivel = Math.abs(hv - ha);
        if (desnivel > paso && !unidas(nav, ha, hv, c, r, nc, nr)) continue;
      }
      if (d >= 4) {
        // Diagonal: no corta esquinas (y las dos ortogonales también deben unirse sin desnivel de más).
        const o1 = base + r * cols + nc;
        const o2 = base + nr * cols + c;
        if (libre[o1] !== 1 || libre[o2] !== 1) continue;
        if (
          alturas &&
          (!unidas(nav, ha, alturas[o1] as number, c, r, nc, r) ||
            !unidas(nav, ha, alturas[o2] as number, c, r, c, nr))
        ) {
          continue;
        }
      }
      relajar(
        nav,
        actual,
        vecino,
        nc,
        nr,
        ga + (d >= 4 ? DIAGONAL : 1) + desnivel / nav.celda,
        ec,
        er,
      );
    }
    if (alturas) bajarPorElBorde(nav, actual, ha, ec, er);
    // La misma celda a la misma altura en la capa de arriba o de abajo es el mismo lugar.
    if (alturas) {
      for (let dk = -1; dk <= 1; dk += 2) {
        const k = capa + dk;
        if (k < 0 || k >= capas) continue;
        const v = k * area + celda;
        if (libre[v] !== 1 || cerrada[v] === tick) continue;
        if (Math.abs((alturas[v] as number) - ha) > 1e-6) continue;
        relajar(nav, actual, v, c, r, ga, ec, er);
      }
    }
  }
  return 0;
}

/** Nodos del suavizado: 0 = origen exacto, 1..m = centros de la cadena, m + 1 = destino exacto. */
function nodoX(nav: Navegacion, k: number): number {
  if (k === 0) return nav.ox;
  if (k > nav.m) return nav.dx;
  return nav.x0 + ((((nav.cadena[k - 1] as number) % nav.area) % nav.cols) + 0.5) * nav.celda;
}

function nodoZ(nav: Navegacion, k: number): number {
  if (k === 0) return nav.oz;
  if (k > nav.m) return nav.dz;
  return nav.z0 + (((((nav.cadena[k - 1] as number) % nav.area) / nav.cols) | 0) + 0.5) * nav.celda;
}

function nodoY(nav: Navegacion, k: number): number {
  if (k === 0) return nav.oy;
  if (k > nav.m) return nav.dy;
  return nav.alturas ? (nav.alturas[nav.cadena[k - 1] as number] as number) : 0;
}

/**
 * ¿Se va en línea recta del nodo `a` al `b`? En un nivel, `lineaLibre`. En varios, se recorre el tramo
 * como el cuerpo: cada muestra toma la altura de `alturaEn` desde la anterior, sin caer más de un paso
 * ni chocar a esa altura, y debe terminar a la altura de `b` (no por debajo ni por encima de ella).
 */
function tramoLibre(nav: Navegacion, a: number, b: number): boolean {
  const ax = nodoX(nav, a);
  const az = nodoZ(nav, a);
  const bx = nodoX(nav, b);
  const bz = nodoZ(nav, b);
  const suelo = nav.suelo;
  if (!suelo) return lineaLibre(nav.mapa, ax, az, bx, bz, nav.radio);
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / MUESTREO));
  let y = nodoY(nav, a);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    const h = alturaEn(suelo, x, z, y);
    if (h === SIN_SUELO || h < y - suelo.paso) return false;
    if (!puntoLibre(nav.mapa, x, z, nav.radio, h)) return false;
    y = h;
  }
  return Math.abs(y - nodoY(nav, b)) < 1e-3;
}

/**
 * Busca la ruta de (x0, z0) a (x1, z1) y la escribe en `ruta` como pares x, z (sin el origen; el
 * último punto es el destino). Devuelve cuántos puntos escribió, o 0 si no hay camino.
 *
 * - Un destino (u origen) dentro de un obstáculo se lleva al centro de la celda libre más cercana.
 * - Un destino libre se conserva exacto si se ve desde el último punto; si no, se usa el centro
 *   de su celda.
 * - Si el suavizado deja más de `maxPuntos`, se escriben los primeros `maxPuntos` (la ruta queda
 *   corta, pero siempre es válida).
 * - Varios niveles: `y0` son los pies de quien camina y `y1` la altura del destino (el piso que se
 *   tocó); sin `y1`, el destino se busca cerca de `y0` (el mismo piso, si lo hay). La ruta sale en
 *   planta: la altura la pone el suelo al caminarla. Si el destino está en una superficie a la que no se
 *   llega andando, la ruta va al piso más cercano bajo ella.
 */
export function buscarRuta(
  nav: Navegacion,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  ruta: Float64Array,
  maxPuntos: number,
  y0 = Number.NaN,
  y1 = Number.NaN,
): number {
  const limite = Math.min(maxPuntos, Math.floor(ruta.length / 2));
  if (limite <= 0) return 0;
  const multinivel = nav.alturas !== null;
  const yDestino = y1 === y1 ? y1 : y0;
  const s = nodoCercano(nav, x0, z0, y0);
  if (s < 0) return 0;
  let m = 0;
  // Un destino sobre una superficie a la que no se llega andando (otra mesa: se sube saltando) se lleva
  // al piso bajo ella, de una superficie a la siguiente más baja.
  for (let tope = yDestino; ;) {
    const e = nodoCercano(nav, x1, z1, tope);
    m = e < 0 ? 0 : aEstrella(nav, s, e);
    if (m === 0 && nav.suelo && tope === tope) {
      // Un destino dentro de un mueble que se pisa cae en su tapa (a menos de la tolerancia): se prueba con
      // la altura exacta, que lo lleva al piso junto a él.
      const exacto = nodoCercano(nav, x1, z1, tope, nav.suelo.paso);
      if (exacto >= 0 && exacto !== e) m = aEstrella(nav, s, exacto);
    }
    if (m > 0 || !nav.suelo || tope !== tope) break;
    const abajo = superficieBajo(nav.suelo, x1, z1, tope - nav.suelo.paso - 1e-6);
    if (abajo === SIN_SUELO) break;
    tope = abajo;
  }
  if (m === 0) return 0;

  const { mapa, radio } = nav;
  nav.ox = x0;
  nav.oz = z0;
  nav.dx = x1;
  nav.dz = z1;
  nav.m = m;
  nav.oy = multinivel ? (y0 === y0 ? y0 : nodoY(nav, 1)) : 0;
  nav.dy = multinivel ? nodoY(nav, m) : 0;
  let ultimo = m;
  const destinoLibre = multinivel
    ? puntoLibre(mapa, x1, z1, radio, nav.dy)
    : puntoLibre(mapa, x1, z1, radio);
  if (destinoLibre && tramoLibre(nav, m, m + 1)) ultimo = m + 1;

  let n = 0;
  let a = 0;
  while (a < ultimo && n < limite) {
    let b = a + 1;
    while (b < ultimo && tramoLibre(nav, a, b + 1)) b++;
    ruta[n * 2] = nodoX(nav, b);
    ruta[n * 2 + 1] = nodoZ(nav, b);
    n++;
    a = b;
  }
  return n;
}
