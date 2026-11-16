/**
 * Personalización de la sala (puro, sin three): lo que el dueño mueve, gira o quita del mobiliario de la
 * plantilla, y lo que el modo construir agrega al suelo.
 *
 * - `piezasMovibles(escenario)`: las piezas que se pueden mover (id estable de `planta.muebles`, nombre,
 *   tipo y huella). Quedan fijas: la arquitectura y lo empotrado (`TIPOS_FIJOS`), lo que sostiene un lugar
 *   de trabajo (la silla de un puesto o el mueble que el lugar mira: mesas de equipo, mesas por mercado,
 *   mesas altas con gente de pie) y lo que lleva una pantalla del escenario. Moverlas rompería la
 *   asignación de puestos (`render/layout.ts`), las rutas de los agentes o las pantallas.
 * - `aplicarAjustes(escenario, ajustes)`: un escenario NUEVO (el original no se toca) con las piezas
 *   movidas o quitadas y todo lo que depende de ellas rehecho: colisión, suelo pisable, asientos (se
 *   derivan de `planta.muebles` en `accionesDe`) e intereses atados a un mueble (`Interes.mueble`). Cada
 *   pieza se valida (`CHEQUEOS`) en el orden de la plantilla contra lo ya aceptado; la inválida queda en su
 *   sitio y se reporta en `errores` con un motivo legible.
 * - `conSueloExtra(escenario, solidos, superficies)`: suma sólidos y superficies al suelo (lo que coloca el
 *   modo construir) sin tocar el resto.
 *
 * Los escenarios nuevos quedan en cachés por identidad (`sueloDe`, `accionesDe`, el mundo del avatar): quien
 * llama debe memorizar el resultado y no rehacerlo en cada render.
 */
import { RADIO_AVATAR } from '../animacion/avatar';
import { ALTO_PLANO, ALTURA_AVATAR, GROSOR_MURO } from '../animacion/colision';
import { NODO_VISITA } from '../animacion/ruta';
import { cajaDe } from '../mansion/plano';
import { datosSueloDe, superficiesDeMuebles } from './suelo';
import type { Caja, Escenario, Interes, Mueble, PuntoXZ, Solido, Superficie } from './tipos';

/** Dónde queda una pieza (giro en múltiplos de 90°, como `rotation.y`), o `'quitado'`. */
export type AjusteMueble = { x: number; z: number; giro: number } | 'quitado';
/** Ajustes por id de mueble (`planta.muebles[].id`). */
export type AjustesMuebles = Record<string, AjusteMueble>;

export interface ErrorAjuste {
  id: string;
  /** Por qué no se aplicó, en español, para mostrarlo tal cual. */
  motivo: string;
}

export interface PiezaMovible {
  id: string;
  /** Nombre para el usuario: tipo y ambiente («Sofá · Descanso»). */
  nombre: string;
  tipo: string;
  /** Caja en planta donde está hoy. */
  huella: Caja;
}

/** Valores iniciales parametrizables. */
export const PARAMETROS_PERSONALIZACION = {
  /** Metros libres alrededor de cada entrada, además del cuerpo. */
  holguraEntrada: 0.8,
  /** Distancia mínima (m) de un lugar de trabajo de pie a un mueble (la misma de las plantillas). */
  holguraLugar: 0.3,
};

/** Tipos que son arquitectura o van empotrados: no se mueven. */
export const TIPOS_FIJOS: ReadonlySet<string> = new Set([
  'columna',
  'muro-led',
  'tarima',
  'atril',
  'gradas',
  'barra',
  'repisa',
  'encimera',
  'nevera',
  'isla',
  'credenza',
  'estanteria',
]);

const NOMBRE_TIPO: Readonly<Record<string, string>> = {
  sofa: 'Sofá',
  sillon: 'Sillón',
  silla: 'Silla',
  'mesa-baja': 'Mesa baja',
  'mesa-alta': 'Mesa alta',
  'mesa-reunion': 'Mesa de reunión',
  taburete: 'Taburete',
  pufs: 'Banco de pufs',
  jardinera: 'Jardinera',
  planta: 'Planta',
  bicicleta: 'Bicicleta',
};

const EPS = 1e-6;
const NO_PERSONALIZABLE = 'Esta sala todavía no permite mover muebles.';

// --- geometría en planta ---

const solapan = (a: Caja, b: Caja) =>
  a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS;

function distanciaPunto(c: Caja, x: number, z: number): number {
  const dx = Math.max(c.x0 - x, 0, x - c.x1);
  const dz = Math.max(c.z0 - z, 0, z - c.z1);
  return Math.hypot(dx, dz);
}

function distanciaPuntoSegmento(x: number, z: number, s: Float64Array, o: number): number {
  const ax = s[o] as number;
  const az = s[o + 1] as number;
  const dx = (s[o + 2] as number) - ax;
  const dz = (s[o + 3] as number) - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

/** ¿El segmento `o` corta la caja? (recorte de Liang–Barsky) */
function cortaCaja(s: Float64Array, o: number, c: Caja): boolean {
  const ax = s[o] as number;
  const az = s[o + 1] as number;
  const dx = (s[o + 2] as number) - ax;
  const dz = (s[o + 3] as number) - az;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, ax - c.x0],
    [dx, c.x1 - ax],
    [-dz, az - c.z0],
    [dz, c.z1 - az],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** Distancia (m) del segmento `o` a la caja (0 si la corta). */
function distanciaSegmento(s: Float64Array, o: number, c: Caja): number {
  if (cortaCaja(s, o, c)) return 0;
  return Math.min(
    distanciaPunto(c, s[o] as number, s[o + 1] as number),
    distanciaPunto(c, s[o + 2] as number, s[o + 3] as number),
    distanciaPuntoSegmento(c.x0, c.z0, s, o),
    distanciaPuntoSegmento(c.x1, c.z0, s, o),
    distanciaPuntoSegmento(c.x0, c.z1, s, o),
    distanciaPuntoSegmento(c.x1, c.z1, s, o),
  );
}

const exacto = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v);

/**
 * (dx, dz) girado `giro` rad alrededor de y, como `rotation.y` de three (x' = x·cos + z·sen,
 * z' = −x·sen + z·cos). En los cuartos de vuelta, exacto.
 */
export function girarEnPlanta(dx: number, dz: number, giro: number): [number, number] {
  if (giro === 0) return [dx, dz];
  const c = exacto(Math.cos(giro));
  const s = exacto(Math.sin(giro));
  return [c * dx + s * dz, -s * dx + c * dz];
}

const esCuarto = (giro: number) =>
  Math.abs(giro / (Math.PI / 2) - Math.round(giro / (Math.PI / 2))) < 1e-6;

/** El punto `p` de la pieza `antes`, llevado a donde está la pieza `despues`. */
function reubicarPunto(p: PuntoXZ, antes: Mueble, despues: Mueble): PuntoXZ {
  const [dx, dz] = girarEnPlanta(p.x - antes.x, p.z - antes.z, despues.giro - antes.giro);
  return { x: despues.x + dx, z: despues.z + dz };
}

// --- qué se mueve ---

function nombreDe(e: Escenario, m: Mueble): string {
  const tipo =
    NOMBRE_TIPO[m.tipo] ?? m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1).replace(/-/g, ' ');
  const ambiente = e.planta.ambientes.find((a) => a.id === m.ambiente);
  return ambiente ? `${tipo} · ${ambiente.nombre}` : tipo;
}

const razonesFijas = new WeakMap<Escenario, Map<string, string | null>>();

/** Por qué la pieza no se mueve, o `null` si se mueve. */
function razonFija(e: Escenario, m: Mueble): string | null {
  let razones = razonesFijas.get(e);
  if (!razones) {
    razones = new Map();
    razonesFijas.set(e, razones);
  }
  let r = razones.get(m.id);
  if (r === undefined) {
    const caja = cajaDe(m);
    const conMargen = {
      x0: caja.x0 - 0.1,
      x1: caja.x1 + 0.1,
      z0: caja.z0 - 0.1,
      z1: caja.z1 + 0.1,
    };
    r = TIPOS_FIJOS.has(m.tipo)
      ? 'es parte de la arquitectura de la sala'
      : e.planta.lugares.some(
            (l) => l.silla === m.id || distanciaPunto(caja, l.mira.x, l.mira.z) === 0,
          )
        ? 'sostiene un lugar de trabajo'
        : e.pantallas.some((p) => distanciaPunto(conMargen, p.x, p.z) === 0)
          ? 'lleva una pantalla de la sala'
          : null;
    razones.set(m.id, r);
  }
  return r;
}

/** Las piezas del mobiliario que el dueño puede mover o quitar (vacío si el escenario no es personalizable). */
export function piezasMovibles(e: Escenario): PiezaMovible[] {
  if (!e.personalizable) return [];
  return e.planta.muebles
    .filter((m) => razonFija(e, m) === null)
    .map((m) => ({ id: m.id, nombre: nombreDe(e, m), tipo: m.tipo, huella: cajaDe(m) }));
}

// --- lo que no se puede tapar ---

interface Contexto {
  e: Escenario;
  limites: Caja;
  muros: Caja[];
  /** Tramos de ruta (x0, z0, x1, z1) de cada agente a cada pausa y de cada visita, sin repetir. */
  tramos: Float64Array;
  /** Lugar de cada tramo, para el motivo. */
  deTramo: string[];
}

const contextos = new WeakMap<Escenario, Contexto>();

function contextoDe(e: Escenario): Contexto {
  let ctx = contextos.get(e);
  if (ctx) return ctx;
  const y = e.entradas[0]?.y ?? e.planta.niveles[0] ?? 0;
  const h = GROSOR_MURO / 2;
  const vistos = new Set<string>();
  const tramos: number[] = [];
  const deTramo: string[] = [];
  const agregar = (lugar: string, a: PuntoXZ, b: PuntoXZ) => {
    const k = `${a.x.toFixed(6)},${a.z.toFixed(6)},${b.x.toFixed(6)},${b.z.toFixed(6)}`;
    if (a.x === b.x && a.z === b.z) return;
    if (vistos.has(k)) return;
    vistos.add(k);
    tramos.push(a.x, a.z, b.x, b.z);
    deTramo.push(lugar);
  };
  const { lugares, cafe } = e.planta;
  for (const l of lugares) {
    for (const pausa of cafe) {
      const nodos = e.rutas.crearRuta(l, pausa, false);
      for (let i = 0; i + 1 < nodos.length; i++) agregar(l.id, nodos[i]!, nodos[i + 1]!);
    }
    const pausa = cafe[0];
    if (!pausa) continue;
    for (const otro of lugares) {
      if (otro === l || otro.ambiente !== l.ambiente) continue;
      const nodos = e.rutas.crearRuta(l, pausa, false);
      e.rutas.escribirVisita(nodos, otro);
      for (let i = NODO_VISITA - 2; i < NODO_VISITA; i++) agregar(l.id, nodos[i]!, nodos[i + 1]!);
    }
  }
  ctx = {
    e,
    limites: e.suelo?.limites ?? e.colision(y).limites,
    muros: e.planta.muros.map((m) =>
      m.eje === 'x'
        ? { x0: m.pos - h, x1: m.pos + h, z0: m.desde, z1: m.hasta }
        : { x0: m.desde, x1: m.hasta, z0: m.pos - h, z1: m.pos + h },
    ),
    tramos: new Float64Array(tramos),
    deTramo,
  };
  contextos.set(e, ctx);
  return ctx;
}

/** Estado vigente de las piezas mientras se validan (`null`: quitada). */
type Estado = Map<string, Mueble | null>;

interface Prueba {
  ctx: Contexto;
  /** La pieza en su nueva posición y su caja. */
  pieza: Mueble;
  caja: Caja;
  estado: Estado;
  /** Dónde estaba en la plantilla. */
  original: Mueble;
}

type Chequeo = (p: Prueba) => string | null;

/** Dónde queda hoy un interés: si va atado a una pieza movida, con ella. */
function puntoDeInteres(i: Interes, estado: Estado, porId: Map<string, Mueble>): PuntoXZ {
  const original = i.mueble ? porId.get(i.mueble) : undefined;
  const ahora = i.mueble ? estado.get(i.mueble) : undefined;
  return original && ahora ? reubicarPunto(i, original, ahora) : i;
}

const dentroDeLaSala: Chequeo = ({ ctx, caja }) =>
  caja.x0 < ctx.limites.x0 - EPS ||
  caja.x1 > ctx.limites.x1 + EPS ||
  caja.z0 < ctx.limites.z0 - EPS ||
  caja.z1 > ctx.limites.z1 + EPS
    ? 'Queda fuera de la sala.'
    : null;

const sinMuros: Chequeo = ({ ctx, caja }) =>
  ctx.muros.some((m) => solapan(caja, m)) ? 'Choca con un muro o tabique.' : null;

const sinOtrosMuebles: Chequeo = ({ ctx, pieza, caja, estado }) => {
  for (const otro of estado.values()) {
    if (!otro || otro.id === pieza.id) continue;
    const alturas = pieza.y < otro.y + otro.alto - EPS && otro.y < pieza.y + pieza.alto - EPS;
    if (alturas && solapan(caja, cajaDe(otro)))
      return `Queda encima de ${nombreDe(ctx.e, otro).toLowerCase()}.`;
  }
  return null;
};

const entradasLibres: Chequeo = ({ ctx, caja }) =>
  ctx.e.entradas.some(
    (t) =>
      distanciaPunto(caja, t.x, t.z) < RADIO_AVATAR + PARAMETROS_PERSONALIZACION.holguraEntrada,
  )
    ? 'Tapa una entrada de la sala.'
    : null;

const lugaresLibres: Chequeo = ({ ctx, caja }) => {
  for (const l of ctx.e.planta.lugares) {
    const d = distanciaPunto(caja, l.x, l.z);
    if (d === 0 || (!l.asiento && d <= PARAMETROS_PERSONALIZACION.holguraLugar))
      return `Ocupa un lugar de trabajo (${l.id}).`;
    if (distanciaPunto(caja, l.salida.x, l.salida.z) < RADIO_AVATAR)
      return `Tapa la salida de un lugar de trabajo (${l.id}).`;
  }
  return null;
};

const cafeLibre: Chequeo = ({ ctx, caja }) =>
  ctx.e.planta.cafe.some((c) => distanciaPunto(caja, c.x, c.z) < RADIO_AVATAR)
    ? 'Tapa un punto de pausa del café.'
    : null;

const rutasLibres: Chequeo = ({ ctx, caja }) => {
  const r = RADIO_AVATAR;
  const t = ctx.tramos;
  for (let i = 0; i < ctx.deTramo.length; i++) {
    const o = i * 4;
    // Descarte rápido: la caja del tramo, inflada por el cuerpo, no toca la de la pieza.
    if (
      Math.max(t[o] as number, t[o + 2] as number) < caja.x0 - r ||
      Math.min(t[o] as number, t[o + 2] as number) > caja.x1 + r ||
      Math.max(t[o + 1] as number, t[o + 3] as number) < caja.z0 - r ||
      Math.min(t[o + 1] as number, t[o + 3] as number) > caja.z1 + r
    )
      continue;
    if (distanciaSegmento(t, o, caja) < r - EPS)
      return `Corta el camino de las personas (desde ${ctx.deTramo[i]}).`;
  }
  return null;
};

const paseoLibre: Chequeo = ({ ctx, caja }) => {
  const p = ctx.e.paseo;
  const r = RADIO_AVATAR;
  return solapan(caja, { x0: p.x0 - r, x1: p.x1 + r, z0: p.z0 - r, z1: p.z1 + r })
    ? 'Corta el paseo de las personas.'
    : null;
};

const reunionesLibres: Chequeo = ({ ctx, caja }) => {
  for (const u of ctx.e.reuniones) {
    // El círculo donde se paran (radio `u.radio`) no puede pasar por la pieza, con el cuerpo de holgura.
    const cerca = distanciaPunto(caja, u.x, u.z);
    const lejos = Math.max(
      ...[
        [caja.x0, caja.z0],
        [caja.x1, caja.z0],
        [caja.x0, caja.z1],
        [caja.x1, caja.z1],
      ].map(([x, z]) => Math.hypot(x! - u.x, z! - u.z)),
    );
    if (cerca - RADIO_AVATAR <= u.radio && u.radio <= lejos + RADIO_AVATAR)
      return 'Ocupa un punto de reunión de las personas.';
  }
  return null;
};

const interesesLibres: Chequeo = ({ ctx, pieza, caja, estado, original }) => {
  const porId = new Map(ctx.e.planta.muebles.map((m) => [m.id, m]));
  for (const i of ctx.e.intereses) {
    if (i.mueble === pieza.id) {
      // Va con la pieza: su punto nuevo tiene que quedar accesible.
      const p = reubicarPunto(i, original, pieza);
      const tapado =
        distanciaPunto(
          {
            x0: ctx.limites.x0 + RADIO_AVATAR,
            x1: ctx.limites.x1 - RADIO_AVATAR,
            z0: ctx.limites.z0 + RADIO_AVATAR,
            z1: ctx.limites.z1 - RADIO_AVATAR,
          },
          p.x,
          p.z,
        ) > 0 ||
        ctx.muros.some((m) => distanciaPunto(m, p.x, p.z) < RADIO_AVATAR) ||
        [...estado.values()].some(
          (m) =>
            m !== null && m.id !== pieza.id && distanciaPunto(cajaDe(m), p.x, p.z) < RADIO_AVATAR,
        );
      if (tapado) return `Deja «${i.nombre}» sin acceso.`;
      continue;
    }
    const p = puntoDeInteres(i, estado, porId);
    if (distanciaPunto(caja, p.x, p.z) < RADIO_AVATAR) return `Tapa el acceso a «${i.nombre}».`;
  }
  return null;
};

/** Lo que se revisa de cada pieza movida, en orden: el primer motivo es el que se reporta. */
const CHEQUEOS: readonly Chequeo[] = [
  dentroDeLaSala,
  sinMuros,
  sinOtrosMuebles,
  entradasLibres,
  lugaresLibres,
  cafeLibre,
  rutasLibres,
  paseoLibre,
  reunionesLibres,
  interesesLibres,
];

// --- el escenario resultante ---

/** ¿Bloquea la colisión de un nivel? (lo mismo que usan las plantillas de un nivel) */
const bloquea = (m: Mueble) => m.alto > ALTO_PLANO && m.y < ALTURA_AVATAR;

function construir(e: Escenario, estado: Estado, cambiados: ReadonlySet<string>): Escenario {
  const porId = new Map(e.planta.muebles.map((m) => [m.id, m]));
  const muebles: Mueble[] = [];
  for (const m of e.planta.muebles) {
    const ahora = estado.get(m.id);
    if (ahora) muebles.push(ahora);
  }
  const movidos = [...cambiados].flatMap((id) => {
    const m = estado.get(id);
    return m ? [m] : [];
  });

  const colisiones = new Map<number, { cajas: Caja[]; limites: Caja }>();
  const colision = (y: number) => {
    let c = colisiones.get(y);
    if (!c) {
      const base = e.colision(y);
      const cajas = [...base.cajas];
      for (const id of cambiados) {
        const antes = cajaDe(porId.get(id)!);
        const k = cajas.findIndex(
          (q) => q.x0 === antes.x0 && q.x1 === antes.x1 && q.z0 === antes.z0 && q.z1 === antes.z1,
        );
        if (k >= 0) cajas.splice(k, 1);
      }
      for (const m of movidos) if (bloquea(m)) cajas.push(cajaDe(m));
      c = { cajas, limites: base.limites };
      colisiones.set(y, c);
    }
    return c;
  };

  let suelo = e.suelo;
  if (suelo) {
    const yPiso = (m: Mueble) => e.planta.ambientes.find((a) => a.id === m.ambiente)?.y ?? 0;
    const nuevos = superficiesDeMuebles(movidos, yPiso);
    suelo = {
      ...suelo,
      superficies: [
        ...suelo.superficies.filter((s) => !cambiados.has(s.id)),
        ...nuevos.superficies,
      ],
      solidos: [
        ...suelo.solidos.filter((s) => !(s.tipo === 'mueble' && cambiados.has(s.id))),
        ...nuevos.solidos,
      ],
    };
  }

  const intereses = e.intereses.flatMap((i): Interes[] => {
    if (!i.mueble || !cambiados.has(i.mueble)) return [i];
    const ahora = estado.get(i.mueble);
    if (!ahora) return [];
    return [{ ...i, ...reubicarPunto(i, porId.get(i.mueble)!, ahora) }];
  });

  return { ...e, planta: { ...e.planta, muebles }, colision, suelo, intereses };
}

/**
 * Aplica los ajustes del dueño a una plantilla: devuelve un escenario nuevo (sin mutar el original; el
 * mismo si nada cambia) y los errores de las piezas que quedaron en su sitio. Ver la cabecera del módulo.
 */
export function aplicarAjustes(
  e: Escenario,
  ajustes: Readonly<AjustesMuebles>,
): { escenario: Escenario; errores: ErrorAjuste[] } {
  const ids = Object.keys(ajustes);
  if (ids.length === 0) return { escenario: e, errores: [] };
  if (!e.personalizable)
    return { escenario: e, errores: ids.map((id) => ({ id, motivo: NO_PERSONALIZABLE })) };

  const porId = new Map(e.planta.muebles.map((m) => [m.id, m]));
  const errores: ErrorAjuste[] = ids
    .filter((id) => !porId.has(id))
    .sort()
    .map((id) => ({ id, motivo: 'No existe una pieza con ese id en esta sala.' }));
  const estado: Estado = new Map(porId);
  const cambiados = new Set<string>();
  const ctx = contextoDe(e);

  for (const original of e.planta.muebles) {
    const a = ajustes[original.id];
    if (a === undefined) continue;
    const fija = razonFija(e, original);
    if (fija) {
      errores.push({ id: original.id, motivo: `Esta pieza no se puede mover: ${fija}.` });
      continue;
    }
    if (a === 'quitado') {
      estado.set(original.id, null);
      cambiados.add(original.id);
      continue;
    }
    if (![a.x, a.z, a.giro].every(Number.isFinite)) {
      errores.push({ id: original.id, motivo: 'La posición o el giro no son números válidos.' });
      continue;
    }
    if (!esCuarto(a.giro)) {
      errores.push({ id: original.id, motivo: 'El giro debe ser múltiplo de 90°.' });
      continue;
    }
    if (a.x === original.x && a.z === original.z && a.giro === original.giro) continue;
    const ambiente = e.planta.ambientes.find(
      (u) => a.x >= u.x0 && a.x <= u.x1 && a.z >= u.z0 && a.z <= u.z1,
    );
    const pieza: Mueble = {
      ...original,
      x: a.x,
      z: a.z,
      giro: a.giro,
      ambiente: ambiente?.id ?? original.ambiente,
    };
    const prueba: Prueba = { ctx, pieza, caja: cajaDe(pieza), estado, original };
    let motivo: string | null = null;
    for (const chequeo of CHEQUEOS) {
      motivo = chequeo(prueba);
      if (motivo) break;
    }
    if (motivo) {
      errores.push({ id: original.id, motivo });
      continue;
    }
    estado.set(original.id, pieza);
    cambiados.add(original.id);
  }

  if (cambiados.size === 0) return { escenario: e, errores };
  return { escenario: construir(e, estado, cambiados), errores };
}

/**
 * El escenario con sólidos y superficies extra en su suelo (lo que coloca el modo construir: una tarima, un
 * mueble propio). Sin extras devuelve el mismo escenario. Sin `suelo` propio parte de uno plano desde su
 * colisión (como `sueloDe`).
 */
export function conSueloExtra(
  e: Escenario,
  solidos: readonly Solido[] = [],
  superficies: readonly Superficie[] = [],
): Escenario {
  if (solidos.length === 0 && superficies.length === 0) return e;
  const base = datosSueloDe(e);
  return {
    ...e,
    suelo: {
      ...base,
      solidos: [...base.solidos, ...solidos],
      superficies: [...base.superficies, ...superficies],
    },
  };
}
