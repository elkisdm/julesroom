import type { Caja, Escenario, ZonaEscenario } from '../escenarios/tipos';
import { tipoObjeto } from './catalogo';
import type { ObjetoColocado } from './formato';
import { LIMITES_SALA, type LimitesSala } from './limites';
import { huella } from './rejilla';

export type EstadoColocacion = 'libre' | 'choca' | 'bloquea' | 'fuera';

export interface ContextoColocacion {
  escenario: Escenario;
  objetos: readonly ObjetoColocado[];
  limites?: LimitesSala;
}

export interface ResultadoColocacion {
  estado: EstadoColocacion;
  motivo: string | null;
  /** Id del otro objeto con el que choca, si es un objeto. */
  contra?: string;
}

/** Roce tolerado entre cajas (m). */
const TOLERANCIA = 0.01;
const RADIO_PUESTO = 0.35;
const RADIO_ENTRADA = 0.8;

const nivelDe = (e: Escenario): number => e.entradas[0]?.y ?? 0;

const solapa = (a: Caja, b: Caja): boolean =>
  a.x0 < b.x1 - TOLERANCIA &&
  a.x1 > b.x0 + TOLERANCIA &&
  a.z0 < b.z1 - TOLERANCIA &&
  a.z1 > b.z0 + TOLERANCIA;

function tocaCirculo(c: Caja, x: number, z: number, r: number): boolean {
  const dx = x - Math.min(Math.max(x, c.x0), c.x1);
  const dz = z - Math.min(Math.max(z, c.z0), c.z1);
  return dx * dx + dz * dz < r * r;
}

const pisable = (o: { tipo: string }): boolean => tipoObjeto(o.tipo)?.pisable === true;

const noBloqueaPaso = (o: { tipo: string }): boolean =>
  pisable(o) || tipoObjeto(o.tipo)?.noBloqueaPaso === true;

// --- rejilla de paso ---

interface Base {
  limites: Caja;
  celda: number;
  nx: number;
  nz: number;
  /** 1 = bloqueada por el escenario (cajas ya infladas). */
  bloqueo: Uint8Array;
}

const basesPorEscenario = new WeakMap<Escenario, Map<string, Base>>();

function rasterizar(
  bloqueo: Uint8Array,
  b: Pick<Base, 'limites' | 'celda' | 'nx' | 'nz'>,
  c: Caja,
  infla: number,
): void {
  const i0 = Math.max(0, Math.floor((c.x0 - infla - b.limites.x0) / b.celda));
  const i1 = Math.min(b.nx - 1, Math.floor((c.x1 + infla - b.limites.x0) / b.celda));
  const j0 = Math.max(0, Math.floor((c.z0 - infla - b.limites.z0) / b.celda));
  const j1 = Math.min(b.nz - 1, Math.floor((c.z1 + infla - b.limites.z0) / b.celda));
  for (let j = j0; j <= j1; j++) {
    const zc = b.limites.z0 + (j + 0.5) * b.celda;
    if (zc <= c.z0 - infla || zc >= c.z1 + infla) continue;
    for (let i = i0; i <= i1; i++) {
      const xc = b.limites.x0 + (i + 0.5) * b.celda;
      if (xc > c.x0 - infla && xc < c.x1 + infla) bloqueo[j * b.nx + i] = 1;
    }
  }
}

function baseDe(escenario: Escenario, lim: LimitesSala): Base {
  let porClave = basesPorEscenario.get(escenario);
  if (!porClave) basesPorEscenario.set(escenario, (porClave = new Map()));
  const clave = `${lim.celdaPaso}|${lim.anchoPaso}`;
  let base = porClave.get(clave);
  if (!base) {
    const { cajas, limites } = escenario.colision(nivelDe(escenario));
    const celda = lim.celdaPaso;
    const nx = Math.ceil((limites.x1 - limites.x0) / celda);
    const nz = Math.ceil((limites.z1 - limites.z0) / celda);
    const bloqueo = new Uint8Array(nx * nz);
    const parcial = { limites, celda, nx, nz };
    for (const c of cajas) rasterizar(bloqueo, parcial, c, lim.anchoPaso / 2);
    base = { ...parcial, bloqueo };
    porClave.set(clave, base);
  }
  return base;
}

function rejillaCon(base: Base, objetos: readonly ObjetoColocado[], lim: LimitesSala): Uint8Array {
  const g = base.bloqueo.slice();
  for (const o of objetos) if (!noBloqueaPaso(o)) rasterizar(g, base, huella(o), lim.anchoPaso / 2);
  return g;
}

const indice = (b: Base, x: number, z: number): number => {
  const i = Math.floor((x - b.limites.x0) / b.celda);
  const j = Math.floor((z - b.limites.z0) / b.celda);
  return i < 0 || j < 0 || i >= b.nx || j >= b.nz ? -1 : j * b.nx + i;
};

/** Celda libre más cercana al punto, dentro de `caja` (o de toda la sala si no hay), o -1. */
function libreCercana(b: Base, g: Uint8Array, x: number, z: number, caja?: Caja): number {
  const c0 = indice(b, x, z);
  if (c0 >= 0 && g[c0] === 0) return c0;
  const i0 = caja ? Math.max(0, Math.floor((caja.x0 - b.limites.x0) / b.celda)) : 0;
  const i1 = caja ? Math.min(b.nx - 1, Math.floor((caja.x1 - b.limites.x0) / b.celda)) : b.nx - 1;
  const j0 = caja ? Math.max(0, Math.floor((caja.z0 - b.limites.z0) / b.celda)) : 0;
  const j1 = caja ? Math.min(b.nz - 1, Math.floor((caja.z1 - b.limites.z0) / b.celda)) : b.nz - 1;
  let mejor = -1;
  let dMejor = Infinity;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (g[j * b.nx + i] !== 0) continue;
      const dx = b.limites.x0 + (i + 0.5) * b.celda - x;
      const dz = b.limites.z0 + (j + 0.5) * b.celda - z;
      const d = dx * dx + dz * dz;
      if (d < dMejor) {
        dMejor = d;
        mejor = j * b.nx + i;
      }
    }
  }
  return mejor;
}

/** Relleno de 4 vecinos desde `inicio`; devuelve las celdas alcanzadas. */
function rellenar(b: Base, g: Uint8Array, inicio: number): Uint8Array {
  const visto = new Uint8Array(g.length);
  if (inicio < 0) return visto;
  const cola = new Int32Array(g.length);
  let cab = 0;
  let fin = 0;
  cola[fin++] = inicio;
  visto[inicio] = 1;
  while (cab < fin) {
    const c = cola[cab++]!;
    const i = c % b.nx;
    const vecinos = [i > 0 ? c - 1 : -1, i < b.nx - 1 ? c + 1 : -1, c - b.nx, c + b.nx];
    for (const v of vecinos) {
      if (v < 0 || v >= g.length || visto[v] || g[v]) continue;
      visto[v] = 1;
      cola[fin++] = v;
    }
  }
  return visto;
}

const centro = (z: ZonaEscenario): { x: number; z: number } => ({
  x: (z.x0 + z.x1) / 2,
  z: (z.z0 + z.z1) / 2,
});

/** Celda objetivo de cada zona sobre la rejilla `g`; las zonas sin celda libre se ignoran. */
function objetivos(escenario: Escenario, b: Base, g: Uint8Array): Map<string, number> {
  const out = new Map<string, number>();
  for (const zona of escenario.zonas) {
    const c = centro(zona);
    const celda = libreCercana(b, g, c.x, c.z, zona);
    if (celda >= 0) out.set(zona.id, celda);
  }
  return out;
}

function inicioDe(escenario: Escenario, b: Base, g: Uint8Array): number {
  const e = escenario.entradas[0];
  return e ? libreCercana(b, g, e.x, e.z) : -1;
}

/** Ids de las zonas a las que se llega andando desde la entrada con esos objetos puestos. */
export function zonasAlcanzables(
  escenario: Escenario,
  objetos: readonly ObjetoColocado[],
  limites: LimitesSala = LIMITES_SALA,
): Set<string> {
  const b = baseDe(escenario, limites);
  const g = rejillaCon(b, objetos, limites);
  const visto = rellenar(b, g, inicioDe(escenario, b, g));
  const out = new Set<string>();
  for (const [id, celda] of objetivos(escenario, b, g)) if (visto[celda]) out.add(id);
  return out;
}

function evaluarPaso(
  obj: ObjetoColocado,
  otros: readonly ObjetoColocado[],
  escenario: Escenario,
  lim: LimitesSala,
): string | null {
  const b = baseDe(escenario, lim);
  const antes = rejillaCon(b, otros, lim);
  const despues = antes.slice();
  rasterizar(despues, b, huella(obj), lim.anchoPaso / 2);
  const metas = objetivos(escenario, b, antes);
  const ini = inicioDe(escenario, b, antes);
  const vistoAntes = rellenar(b, antes, ini);
  const vistoDespues = rellenar(b, despues, ini);
  for (const [id, celda] of metas) {
    if (vistoAntes[celda] && !vistoDespues[celda]) {
      const zona = escenario.zonas.find((z) => z.id === id)!;
      return `Cierra el paso a ${zona.nombre}`;
    }
  }
  return null;
}

/** ¿Se puede poner `obj` aquí? Reglas en orden: fuera, choca, bloquea el paso. */
export function evaluarColocacion(
  obj: ObjetoColocado,
  ctx: ContextoColocacion,
): ResultadoColocacion {
  const { escenario } = ctx;
  const lim = ctx.limites ?? LIMITES_SALA;
  const y = nivelDe(escenario);
  const { cajas, limites } = escenario.colision(y);
  const h = huella(obj);

  if (h.x0 < limites.x0 || h.x1 > limites.x1 || h.z0 < limites.z0 || h.z1 > limites.z1) {
    return { estado: 'fuera', motivo: 'Fuera de la sala' };
  }
  if (pisable(obj)) return { estado: 'libre', motivo: null };

  if (cajas.some((c) => solapa(h, c))) return { estado: 'choca', motivo: 'Choca con un mueble' };
  const otros = ctx.objetos.filter((o) => o.id !== obj.id);
  for (const o of otros) {
    if (pisable(o) || !solapa(h, huella(o))) continue;
    return { estado: 'choca', motivo: `Choca con ${tipoObjeto(o.tipo)!.nombre}`, contra: o.id };
  }
  if (
    escenario.planta.lugares.some(
      (l) => Math.abs(l.y - y) < 0.5 && tocaCirculo(h, l.x, l.z, RADIO_PUESTO),
    )
  ) {
    return { estado: 'choca', motivo: 'Tapa un puesto' };
  }
  if (escenario.entradas.some((e) => tocaCirculo(h, e.x, e.z, RADIO_ENTRADA))) {
    return { estado: 'choca', motivo: 'Tapa la entrada' };
  }

  const cierre = noBloqueaPaso(obj) ? null : evaluarPaso(obj, otros, escenario, lim);
  return cierre ? { estado: 'bloquea', motivo: cierre } : { estado: 'libre', motivo: null };
}
