/**
 * Suelo con altura: dónde se apoyan los pies en cada punto del escenario. Lógica pura, sin three.
 *
 * El mundo recorrible (`DatosSuelo`, en `tipos.ts`) son superficies (losas con sus huecos, peldaños de
 * escaleras rectas y de caracol, rampas, tarimas y muebles pisables) y sólidos con un rango de altura
 * (muros, barandas, muebles no pisables, bordes de seguridad). `crearSuelo` lo indexa una vez en una
 * grilla de celdas de `CELDA` m; desde ahí las consultas no asignan memoria y cuestan microsegundos.
 *
 * Regla del paso: desde unos pies a la altura `yActual`, se apoya en la superficie más alta que quede a
 * lo sumo un `paso` por encima (subir un peldaño, una tarima baja, o bajar cualquier cosa). Lo que
 * queda más alto que un paso solo se alcanza saltando: en el aire `yActual` sube y la consulta lo ve.
 * Si no hay nada debajo, `SIN_SUELO` (caída sin fin: fuera del mundo).
 *
 * API para quien anima:
 * - `alturaEn(suelo, x, z, yActual)`: la superficie bajo los pies del cuerpo (la usa el avatar).
 * - `alturaPie(suelo, x, z, yCuerpo)`: la cara (peldaño, tarima) bajo un pie, con más alcance que un
 *   paso (un pie se apoya en el peldaño siguiente mientras el cuerpo sigue en el anterior).
 * - `puntoEnSuelo(...)`: dónde cae un rayo (clic) sobre las superficies, por debajo de un corte.
 * - `sueloDe(escenario)`: el suelo indexado del escenario (o uno plano desde su colisión si no trae).
 */
import { cajaDe } from '../mansion/plano';
import type { Escalera, Mueble, Tramo } from '../mansion/plano';
import type {
  Caja,
  DatosSuelo,
  Escenario,
  Punto3,
  Solido,
  Superficie,
  SuperficiePlana,
  SuperficieSector,
} from './tipos';

/** Valores iniciales parametrizables (cada escenario puede pasar los suyos en `DatosSuelo`). */
export const PARAMETROS_SUELO = {
  /** Lo más alto (m) que se sube caminando: un peldaño (≤ 0,19), una tarima de 0,25, una grada de 0,3. */
  paso: 0.35,
  /** Alto del cuerpo (m): lo que está más arriba se pasa por debajo. */
  altoCuerpo: 1.7,
  /** Cuánto más arriba que el cuerpo alcanza un pie (m), para apoyarlo en el peldaño siguiente. */
  alcancePie: 0.6,
  /**
   * Lo más alto (m) que llega la tapa de un mueble para subirse de un salto: bajo el arco del salto
   * (`PARAMETROS_SALTO.altura`) queda margen para pasar sobre el borde y aterrizar con control en el aire.
   */
  alcanceSalto: 1,
  /**
   * Hasta dónde sobre su base (m) bloquea un mueble que no se pisa. Se cuenta con el paso de los pies (un
   * cuerpo con los pies a `alturaInfranqueable − paso` o más lo pasa): debe quedar sobre el pie más alto de
   * un salto desde otra mesa (`alcanceSalto` + `PARAMETROS_SALTO.altura`) para que no se sobrevuele, y bajo el
   * alto de una planta (3,9) para que no cierre la columna entera hasta la de arriba.
   */
  alturaInfranqueable: 3,
};

/** Contrahuella máxima de cualquier escalera (la misma con que se dibujan, `render/casa/arquitectura`). */
export const CONTRAHUELLA_MAX = 0.19;
/** Espesor de un peldaño volado (m). */
export const GROSOR_PELDANO = 0.06;
/** Altura que devuelve una consulta sin nada debajo. */
export const SIN_SUELO = Number.NEGATIVE_INFINITY;

/** Muebles de esta altura o menos son parte del piso (espejo de agua). Igual que `colision.ALTO_PLANO`. */
const ALTO_PLANO = 0.15;
/** Muebles colgados desde esta altura no estorban. Igual que `colision.ALTURA_AVATAR`. */
const COLGADO = 1.7;

/**
 * Muebles cuya cara de apoyo es más baja que su caja entera: el asiento de un sofá o un sillón (0,45 m), no
 * el respaldo. Los demás se pisan por su tapa (el alto de su geometría): no hay una lista de pisables.
 */
export const CARA_ASIENTO: Readonly<Record<string, number>> = {
  sofa: 0.45,
  'sofa-modular': 0.45,
  sillon: 0.45,
  'sillon-cuero': 0.45,
};

/** Lado (m) de las celdas del índice. */
const CELDA = 1;
/** Campos por superficie en `datos`. */
const F = 13;
const CAJA = 0;
const RAMPA_X = 1;
const RAMPA_Z = 2;
const SECTOR = 3;
const DOS_PI = Math.PI * 2;
const EPS = 1e-9;

export interface Suelo {
  readonly superficies: readonly Superficie[];
  readonly solidos: readonly Solido[];
  readonly limites: Caja;
  readonly paso: number;
  readonly altoCuerpo: number;
  /** Alturas mínima y máxima de las caras (la navegación arma sus capas entre ellas). */
  readonly yMin: number;
  readonly yMax: number;
  /** Índice: superficies empaquetadas (`F` campos) y, por celda, cuáles la tocan (CSR). */
  readonly datos: Float64Array;
  readonly cols: number;
  readonly rows: number;
  readonly ini: Int32Array;
  readonly items: Int32Array;
}

/** Indexa el suelo (se hace una vez por escenario; asigna). */
export function crearSuelo(d: DatosSuelo): Suelo {
  const { limites } = d;
  const cols = Math.max(1, Math.ceil((limites.x1 - limites.x0) / CELDA));
  const rows = Math.max(1, Math.ceil((limites.z1 - limites.z0) / CELDA));
  const datos = new Float64Array(d.superficies.length * F);
  let yMin = Infinity;
  let yMax = -Infinity;
  d.superficies.forEach((s, i) => {
    const o = i * F;
    if (s.forma === 'sector') {
      datos[o] = SECTOR;
      datos[o + 1] = s.cx - s.r1;
      datos[o + 2] = s.cx + s.r1;
      datos[o + 3] = s.cz - s.r1;
      datos[o + 4] = s.cz + s.r1;
      datos[o + 5] = s.y;
      datos[o + 6] = s.y;
      datos[o + 7] = s.cx;
      datos[o + 8] = s.cz;
      datos[o + 9] = s.r0 * s.r0;
      datos[o + 10] = s.r1 * s.r1;
      datos[o + 11] = s.desde;
      datos[o + 12] = s.hasta - s.desde;
    } else {
      datos[o] = s.forma === 'caja' ? CAJA : s.eje === 'x' ? RAMPA_X : RAMPA_Z;
      datos[o + 1] = s.x0;
      datos[o + 2] = s.x1;
      datos[o + 3] = s.z0;
      datos[o + 4] = s.z1;
      datos[o + 5] = s.forma === 'caja' ? s.y : s.y0;
      datos[o + 6] = s.forma === 'caja' ? s.y : s.y1;
    }
    yMin = Math.min(yMin, datos[o + 5] as number, datos[o + 6] as number);
    yMax = Math.max(yMax, datos[o + 5] as number, datos[o + 6] as number);
  });

  // Grilla CSR: primero cuántas superficies tocan cada celda, luego cuáles.
  const rango = (o: number) => {
    const c0 = Math.max(0, Math.floor(((datos[o + 1] as number) - limites.x0) / CELDA));
    const c1 = Math.min(cols - 1, Math.floor(((datos[o + 2] as number) - limites.x0) / CELDA));
    const r0 = Math.max(0, Math.floor(((datos[o + 3] as number) - limites.z0) / CELDA));
    const r1 = Math.min(rows - 1, Math.floor(((datos[o + 4] as number) - limites.z0) / CELDA));
    return [c0, c1, r0, r1] as const;
  };
  const cuenta = new Int32Array(cols * rows + 1);
  for (let i = 0; i < d.superficies.length; i++) {
    const [c0, c1, r0, r1] = rango(i * F);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cuenta[r * cols + c + 1]!++;
  }
  for (let k = 1; k <= cols * rows; k++) cuenta[k]! += cuenta[k - 1] as number;
  const ini = cuenta;
  const items = new Int32Array(ini[cols * rows] as number);
  const lleno = new Int32Array(cols * rows);
  for (let i = 0; i < d.superficies.length; i++) {
    const [c0, c1, r0, r1] = rango(i * F);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const k = r * cols + c;
        items[(ini[k] as number) + lleno[k]!++] = i;
      }
    }
  }

  return {
    superficies: d.superficies,
    solidos: d.solidos,
    limites: { ...limites },
    paso: d.paso ?? PARAMETROS_SUELO.paso,
    altoCuerpo: d.altoCuerpo ?? PARAMETROS_SUELO.altoCuerpo,
    yMin: Number.isFinite(yMin) ? yMin : 0,
    yMax: Number.isFinite(yMax) ? yMax : 0,
    datos,
    cols,
    rows,
    ini,
    items,
  };
}

/** Altura de la superficie `i` en (x, z), o NaN si el punto no está sobre ella. No asigna. */
function alturaDe(s: Suelo, i: number, x: number, z: number): number {
  const d = s.datos;
  const o = i * F;
  const x0 = d[o + 1] as number;
  const x1 = d[o + 2] as number;
  const z0 = d[o + 3] as number;
  const z1 = d[o + 4] as number;
  if (x < x0 || x > x1 || z < z0 || z > z1) return Number.NaN;
  const forma = d[o] as number;
  if (forma === CAJA) return d[o + 5] as number;
  if (forma === RAMPA_X) {
    const y0 = d[o + 5] as number;
    return y0 + ((d[o + 6] as number) - y0) * ((x - x0) / (x1 - x0));
  }
  if (forma === RAMPA_Z) {
    const y0 = d[o + 5] as number;
    return y0 + ((d[o + 6] as number) - y0) * ((z - z0) / (z1 - z0));
  }
  const dx = x - (d[o + 7] as number);
  const dz = z - (d[o + 8] as number);
  const r2 = dx * dx + dz * dz;
  if (r2 < (d[o + 9] as number) || r2 > (d[o + 10] as number)) return Number.NaN;
  let u = Math.atan2(dz, dx) - (d[o + 11] as number);
  u -= DOS_PI * Math.floor(u / DOS_PI);
  return u <= (d[o + 12] as number) + EPS ? (d[o + 5] as number) : Number.NaN;
}

/**
 * La superficie más alta en (x, z) cuya cara no pase de `tope`; `SIN_SUELO` si no hay ninguna (o el
 * punto está fuera de los límites). No asigna.
 */
export function superficieBajo(s: Suelo, x: number, z: number, tope: number): number {
  const { limites } = s;
  if (!(x >= limites.x0 && x <= limites.x1 && z >= limites.z0 && z <= limites.z1)) return SIN_SUELO;
  let c = Math.floor((x - limites.x0) / CELDA);
  let r = Math.floor((z - limites.z0) / CELDA);
  if (c >= s.cols) c = s.cols - 1;
  if (r >= s.rows) r = s.rows - 1;
  const k = r * s.cols + c;
  let mejor = SIN_SUELO;
  const fin = s.ini[k + 1] as number;
  for (let j = s.ini[k] as number; j < fin; j++) {
    const h = alturaDe(s, s.items[j] as number, x, z);
    if (h <= tope + EPS && h > mejor) mejor = h;
  }
  return mejor;
}

/**
 * Altura del suelo bajo unos pies en `yActual`: la superficie más alta a ≤ un `paso` por encima (sube un
 * peldaño o una tarima; si hay varias, la más alta) o, si no la hay, la más alta por debajo (caída). Fuera
 * de todo, `SIN_SUELO`. No asigna.
 */
export function alturaEn(s: Suelo, x: number, z: number, yActual: number): number {
  return superficieBajo(s, x, z, yActual + s.paso);
}

/**
 * Altura de la cara (peldaño, losa, tarima) donde se apoya un pie en (x, z) con el cuerpo en `yCuerpo`:
 * alcanza `PARAMETROS_SUELO.alcancePie` por encima (el pie que va delante pisa el peldaño siguiente). No asigna.
 */
export function alturaPie(s: Suelo, x: number, z: number, yCuerpo: number): number {
  return superficieBajo(s, x, z, yCuerpo + PARAMETROS_SUELO.alcancePie);
}

/**
 * Dónde cae un rayo (origen o, dirección d) sobre la cara superior de las superficies, ignorando las que
 * están sobre `tope` (el corte de la casa de muñecas). Escribe el punto en `salida` y devuelve si tocó
 * alguna. Recorre todas las superficies: es por clic, no por cuadro.
 */
export function puntoEnSuelo(
  s: Suelo,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  tope: number,
  salida: Punto3,
): boolean {
  let mejorT = Infinity;
  const d = s.datos;
  const n = s.superficies.length;
  for (let i = 0; i < n; i++) {
    const o = i * F;
    const forma = d[o] as number;
    const y0 = d[o + 5] as number;
    const y1 = d[o + 6] as number;
    let t: number;
    if (forma === CAJA || forma === SECTOR) {
      if (y0 > tope + EPS || !(dy < 0)) continue;
      t = (y0 - oy) / dy;
    } else {
      // Plano y = y0 + k·(u − u0) a lo largo del eje de la rampa.
      const enX = forma === RAMPA_X;
      const u0 = d[o + (enX ? 1 : 3)] as number;
      const k = (y1 - y0) / ((d[o + (enX ? 2 : 4)] as number) - u0);
      const ou = enX ? ox : oz;
      const du = enX ? dx : dz;
      const den = dy - k * du;
      if (!(den < 0)) continue;
      t = (y0 + k * (ou - u0) - oy) / den;
    }
    if (!(t > 0) || t >= mejorT) continue;
    const h = alturaDe(s, i, ox + dx * t, oz + dz * t);
    if (h !== h || h > tope + EPS) continue;
    mejorT = t;
  }
  if (!Number.isFinite(mejorT)) return false;
  salida.x = ox + dx * mejorT;
  salida.y = oy + dy * mejorT;
  salida.z = oz + dz * mejorT;
  return true;
}

// --- construcción de los datos ---

/** Resta de cajas: lo que queda de `base` tras quitarle `quitar` (en rectángulos sin solape). */
export function restarCajas(base: readonly Caja[], quitar: readonly Caja[]): Caja[] {
  let resto: Caja[] = base.map((c) => ({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1 }));
  for (const q of quitar) {
    const siguiente: Caja[] = [];
    for (const c of resto) {
      if (q.x1 <= c.x0 || q.x0 >= c.x1 || q.z1 <= c.z0 || q.z0 >= c.z1) {
        siguiente.push(c);
        continue;
      }
      if (q.x0 > c.x0) siguiente.push({ ...c, x1: q.x0 });
      if (q.x1 < c.x1) siguiente.push({ ...c, x0: q.x1 });
      const x0 = Math.max(c.x0, q.x0);
      const x1 = Math.min(c.x1, q.x1);
      if (q.z0 > c.z0) siguiente.push({ x0, x1, z0: c.z0, z1: q.z0 });
      if (q.z1 < c.z1) siguiente.push({ x0, x1, z0: q.z1, z1: c.z1 });
    }
    resto = siguiente;
  }
  return resto;
}

/** Cuántos peldaños de igual contrahuella (≤ `CONTRAHUELLA_MAX`) tiene un tramo. */
const numeroPeldanos = (t: Tramo) =>
  Math.max(1, Math.ceil(Math.abs(t.hasta.y - t.desde.y) / CONTRAHUELLA_MAX - 1e-9));

/**
 * Peldaños de un tramo recto alineado con x o con z, de abajo hacia arriba: el `j`-ésimo cubre la
 * fracción [j/n, (j+1)/n] del recorrido a la altura `desde.y + (j+1)·h` (el mismo reparto que el dibujo).
 */
export function peldanosRectos(id: string, t: Tramo, grosor = GROSOR_PELDANO): SuperficiePlana[] {
  const enZ = Math.abs(t.hasta.x - t.desde.x) < 1e-6;
  const enX = Math.abs(t.hasta.z - t.desde.z) < 1e-6;
  if (!enZ && !enX) throw new Error(`Tramo no alineado con un eje en la escalera ${id}`);
  const n = numeroPeldanos(t);
  const h = (t.hasta.y - t.desde.y) / n;
  const medio = t.ancho / 2;
  return Array.from({ length: n }, (_, j): SuperficiePlana => {
    const a = enZ ? t.desde.z : t.desde.x;
    const b = enZ ? t.hasta.z : t.hasta.x;
    const u0 = a + ((b - a) * j) / n;
    const u1 = a + ((b - a) * (j + 1)) / n;
    const lo = Math.min(u0, u1);
    const hi = Math.max(u0, u1);
    return {
      id: `${id}#${j}`,
      tipo: 'peldano',
      forma: 'caja',
      x0: enZ ? t.desde.x - medio : lo,
      x1: enZ ? t.desde.x + medio : hi,
      z0: enZ ? lo : t.desde.z - medio,
      z1: enZ ? hi : t.desde.z + medio,
      y: t.desde.y + (j + 1) * h,
      grosor,
    };
  });
}

/** Si los extremos de los tramos están sobre un mismo círculo, el eje de la escalera de caracol. */
export function ejeCaracol(e: Escalera): { x: number; z: number; radio: number } | null {
  const puntos = [e.tramos[0]?.desde, ...e.tramos.map((t) => t.hasta)];
  if (puntos.length < 4 || puntos.some((p) => !p)) return null;
  const [a, b, c] = puntos as Punto3[];
  const d = 2 * (a!.x * (b!.z - c!.z) + b!.x * (c!.z - a!.z) + c!.x * (a!.z - b!.z));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a!.x * a!.x + a!.z * a!.z;
  const b2 = b!.x * b!.x + b!.z * b!.z;
  const c2 = c!.x * c!.x + c!.z * c!.z;
  const x = (a2 * (b!.z - c!.z) + b2 * (c!.z - a!.z) + c2 * (a!.z - b!.z)) / d;
  const z = (a2 * (c!.x - b!.x) + b2 * (a!.x - c!.x) + c2 * (b!.x - a!.x)) / d;
  const radio = Math.hypot(a!.x - x, a!.z - z);
  const enCirculo = (puntos as Punto3[]).every(
    (p) => Math.abs(Math.hypot(p.x - x, p.z - z) - radio) < 0.01,
  );
  return enCirculo ? { x, z, radio } : null;
}

/**
 * Peldaños de una escalera de caracol: sectores de corona entre `r0` (columna) y `r1` (borde exterior),
 * con el mismo reparto de contrahuellas y ángulos que el dibujo (`render/casa/arquitectura.peldanos`).
 */
export function peldanosCaracol(
  e: Escalera,
  r0: number,
  r1: number,
  grosor = GROSOR_PELDANO,
): SuperficieSector[] {
  const eje = ejeCaracol(e);
  if (!eje) throw new Error(`La escalera ${e.id} no es de caracol`);
  let previo: number | null = null;
  const desenrollar = (a: number) => {
    if (previo === null) return a;
    let x = a;
    while (x - previo > Math.PI) x -= DOS_PI;
    while (previo - x > Math.PI) x += DOS_PI;
    return x;
  };
  return e.tramos.flatMap((t, i): SuperficieSector[] => {
    const n = numeroPeldanos(t);
    const h = (t.hasta.y - t.desde.y) / n;
    const a0 = desenrollar(Math.atan2(t.desde.z - eje.z, t.desde.x - eje.x));
    previo = a0;
    const a1 = desenrollar(Math.atan2(t.hasta.z - eje.z, t.hasta.x - eje.x));
    previo = a1;
    const paso = (a1 - a0) / n;
    return Array.from({ length: n }, (_, j): SuperficieSector => {
      const p = a0 + j * paso;
      const q = a0 + (j + 1) * paso;
      return {
        id: `${e.id}#${i}.${j}`,
        tipo: 'peldano',
        forma: 'sector',
        cx: eje.x,
        cz: eje.z,
        r0,
        r1,
        desde: Math.min(p, q),
        hasta: Math.max(p, q),
        y: t.desde.y + (j + 1) * h,
        grosor,
      };
    });
  });
}

/**
 * Tipos que por defecto NO se pisan aunque su tapa esté al alcance: puestos de trabajo (con monitores y
 * gente sentada encima o alrededor), sillas y equipo (caminar entre monitores se ve mal). El resto de los
 * muebles bajos se pisa. Es el único lugar de esta regla: el campo `pisable` del mueble manda sobre ella.
 */
export const NO_PISABLES_POR_DEFECTO: ReadonlySet<string> = new Set([
  'escritorio',
  'escritorio-nogal',
  'mesa-puesto',
  'mesa-larga',
  'mesa-reunion',
  'mesa-mezcla',
  'mesa-lectura',
  'mesa-cartas',
  'mesa-marmol',
  'silla',
  'silla-malla',
  'silla-madera',
  'taburete',
  'bicicleta',
  'carro-bar',
  'rack-mancuernas',
]);

/**
 * ¿Se sube a este mueble? `pisable` del mueble manda (`false` lo cierra; `true` lo abre aunque pase del
 * alcance). Sin él, se pisa si su tipo no está en `NO_PISABLES_POR_DEFECTO` y su tapa queda al alcance del
 * salto. Solo si apoya en el piso (no una repisa en el aire).
 */
export function sePisa(m: Pick<Mueble, 'y' | 'alto' | 'pisable'> & { tipo?: string }): boolean {
  if (m.y > PARAMETROS_SUELO.paso) return false;
  if (m.pisable !== undefined) return m.pisable;
  if (m.tipo !== undefined && NO_PISABLES_POR_DEFECTO.has(m.tipo)) return false;
  return m.y + m.alto <= PARAMETROS_SUELO.alcanceSalto;
}

/**
 * Muebles → superficies (los que `sePisa`, a la altura de su tapa y macizos hasta el piso) y sólidos (el
 * resto, de su base a su tapa; los que apoyan en el piso y no se pisan son `infranqueable`: no se
 * sobrevuelan). La altura sale de la geometría de cada mueble (`alto`, su huella girada), no de su tipo.
 * Los planos (≤ 0,15 m) son parte del piso y los colgados sobre la cabeza no estorban, como en la
 * colisión de un nivel. `yPiso` da la altura del piso de cada mueble.
 */
export function superficiesDeMuebles(
  muebles: readonly Mueble[],
  yPiso: (m: Mueble) => number,
): { superficies: Superficie[]; solidos: Solido[] } {
  const superficies: Superficie[] = [];
  const solidos: Solido[] = [];
  for (const m of muebles) {
    if (m.alto <= ALTO_PLANO || m.y >= COLGADO) continue;
    const base = yPiso(m) + m.y;
    const caja = cajaDe(m);
    if (sePisa(m)) {
      const alto = Math.min(CARA_ASIENTO[m.tipo] ?? m.alto, m.alto);
      superficies.push({
        id: m.id,
        tipo: m.tipo === 'tarima' ? 'tarima' : 'mueble',
        forma: 'caja',
        ...caja,
        y: base + alto,
        grosor: m.y + alto,
        radio: 0,
      });
    } else {
      solidos.push({
        id: m.id,
        tipo: 'mueble',
        ...caja,
        y0: base,
        y1: base + m.alto,
        ...(m.y <= PARAMETROS_SUELO.paso ? { infranqueable: true } : {}),
      });
    }
  }
  return { superficies, solidos };
}

/** Alto (m) con que un sólido del suelo plano bloquea a cualquier altura razonable del nivel. */
const ALTO_PLANO_SOLIDO = 50;

/** Tolerancia (m) con que una caja de colisión se reconoce como la huella de un mueble. */
const TOLERANCIA_HUELLA = 0.02;

const mismaHuella = (a: Caja, b: Caja) =>
  Math.abs(a.x0 - b.x0) <= TOLERANCIA_HUELLA &&
  Math.abs(a.x1 - b.x1) <= TOLERANCIA_HUELLA &&
  Math.abs(a.z0 - b.z0) <= TOLERANCIA_HUELLA &&
  Math.abs(a.z1 - b.z1) <= TOLERANCIA_HUELLA;

/**
 * Suelo plano de un nivel a partir de su colisión de cajas (escenarios sin `suelo` propio, pruebas): una
 * losa en los límites a la altura `y` y cada caja como sólido de altura completa (muros, columnas). Con
 * `muebles`, la caja que es la huella de uno de ellos toma la geometría del mueble: se sube de un salto si
 * `sePisa` (aterrizaje y pies en su tapa) o bloquea a toda altura. Bloquea lo mismo que
 * `crearMapaDeCajas(cajas, limites)` a la altura del piso.
 */
export function sueloPlano(
  colision: { cajas: readonly Caja[]; limites: Caja },
  y = 0,
  muebles: readonly Mueble[] = [],
): DatosSuelo {
  const { limites } = colision;
  const huellas = muebles.map((m) => ({ m, caja: cajaDe(m) }));
  const propios = huellas.filter((h) => colision.cajas.some((c) => mismaHuella(c, h.caja)));
  const derivados = superficiesDeMuebles(
    propios.map((h) => h.m),
    () => y,
  );
  const sueltas = colision.cajas.filter((c) => !propios.some((h) => mismaHuella(c, h.caja)));
  return {
    limites: { ...limites },
    superficies: [
      { id: 'piso', tipo: 'losa', forma: 'caja', ...limites, y, grosor: 0.3 },
      ...derivados.superficies,
    ],
    solidos: [
      ...sueltas.map((c, i): Solido => ({
        id: `caja-${i}`,
        tipo: 'mueble',
        x0: c.x0,
        x1: c.x1,
        z0: c.z0,
        z1: c.z1,
        y0: y - ALTO_PLANO_SOLIDO,
        y1: y + ALTO_PLANO_SOLIDO,
      })),
      ...derivados.solidos,
    ],
  };
}

/** Los datos del suelo de un escenario: el suyo o, sin él, uno plano del nivel de su entrada con su colisión y sus muebles. */
export function datosSueloDe(e: Escenario): DatosSuelo {
  if (e.suelo) return e.suelo;
  const y = e.entradas[0]?.y ?? e.planta.niveles[0] ?? 0;
  return sueloPlano(e.colision(y), y, e.planta.muebles);
}

const suelos = new WeakMap<Escenario, Suelo>();

/**
 * El suelo indexado de un escenario (una vez por escenario). Sin `suelo` propio, uno plano del nivel de
 * su primera entrada con las cajas de su colisión.
 */
export function sueloDe(e: Escenario): Suelo {
  let s = suelos.get(e);
  if (!s) {
    s = crearSuelo(datosSueloDe(e));
    suelos.set(e, s);
  }
  return s;
}
