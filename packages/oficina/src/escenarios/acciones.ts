/**
 * Acciones del avatar con el mundo (puro, sin three): lo que se puede hacer a mano con «E» o con un clic.
 *
 * - Se DERIVAN del escenario (`accionesDe`): un asiento por silla, sillón, taburete y plaza de sofá que no
 *   sea el puesto de un agente (`planta.lugares[].silla`), un «abrir» por cada `Interes`, y las
 *   `Escenario.acciones` propias (butacas del aula, una puerta…).
 * - `accionCercana` elige la que corresponde al avatar (sin asignar memoria): la que mira de frente y la
 *   más cercana. `accionBajoRayo` resuelve un clic sobre un asiento.
 * - Extender: un tipo nuevo (`'puerta'`, `'objeto'`) es una forma más en `Accion` (con su `AccionBase`) y
 *   su etiqueta en `ETIQUETA_ACCION`; la consulta solo lee la base.
 */
import { RADIO_AVATAR } from '../animacion/avatar';
import { crearMapaDeSuelo, puntoLibre } from '../animacion/colision';
import { PELVIS_SENTADA } from '../animacion/sentarse';
import { alturaEn, SIN_SUELO, sueloDe } from './suelo';
import type { Accion, AccionBase, AccionSentarse, Escenario, Mueble, TipoAccion } from './tipos';

/** Valores iniciales parametrizables. */
export const PARAMETROS_ACCIONES = {
  /** Ancho (m) de una plaza de sofá. */
  plaza: 0.85,
  /** Alcance (m) de un asiento. */
  radioSentarse: 1.3,
  /** Diferencia máxima (m) entre los pies del avatar y el piso de la acción para alcanzarla. */
  alturaMax: 1,
  /** Metros de ventaja de lo que el avatar mira de frente (el puntaje es distancia − peso · cos). */
  pesoMirada: 0.8,
  /** Metros que el avatar puede pasarse del alcance sin perder la acción que ya tenía (evita el parpadeo). */
  histeresis: 0.3,
  /** Desplazamiento desde la última elección que permite reconsiderar el objetivo (m). */
  umbralMovimiento: 0.25,
  /** Distancia máxima (m) del rayo de un clic al punto del asiento. */
  radioClic: 0.45,
  /** Distancia (m) del borde del mueble a la que se espera para sentarse (se prueban en orden). */
  holguraAproximacion: [0.55, 0.95],
};

/** Cómo se llama cada tipo en el aviso «E · sentarse». */
export const ETIQUETA_ACCION: Readonly<Record<TipoAccion, string>> = {
  sentarse: 'sentarse',
  abrir: 'abrir',
  hablar: 'hablar',
};

interface Sentable {
  nombre: string;
  /** Altura de la pelvis sobre el piso (m); `'alto'`: el alto del mueble (taburetes). */
  pelvis: number | 'alto';
  /** Una plaza por mueble, o una por cada `plaza` de ancho (sofás). */
  plazas: 'una' | 'ancho';
}

/** Tipos de mueble en los que se sienta. Las alturas siguen a `render/casa/ambientes/asientos.ts`. */
export const SENTABLES: Readonly<Record<string, Sentable>> = {
  silla: { nombre: 'Silla', pelvis: PELVIS_SENTADA, plazas: 'una' },
  'silla-malla': { nombre: 'Silla', pelvis: PELVIS_SENTADA, plazas: 'una' },
  'silla-madera': { nombre: 'Silla', pelvis: PELVIS_SENTADA, plazas: 'una' },
  sillon: { nombre: 'Sillón', pelvis: PELVIS_SENTADA, plazas: 'una' },
  'sillon-cuero': { nombre: 'Sillón', pelvis: PELVIS_SENTADA, plazas: 'una' },
  sofa: { nombre: 'Sofá', pelvis: PELVIS_SENTADA, plazas: 'ancho' },
  'sofa-modular': { nombre: 'Sofá', pelvis: PELVIS_SENTADA, plazas: 'ancho' },
  taburete: { nombre: 'Taburete', pelvis: 'alto', plazas: 'una' },
};

/** Las plazas de un mueble: centros (x, z) a lo largo de su ancho local. */
function plazasDe(m: Mueble, def: Sentable): { x: number; z: number }[] {
  const n =
    def.plazas === 'ancho' ? Math.max(1, Math.floor(m.ancho / PARAMETROS_ACCIONES.plaza)) : 1;
  const derX = Math.cos(m.giro);
  const derZ = -Math.sin(m.giro);
  const plazas: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const d = (i - (n - 1) / 2) * (m.ancho / n);
    plazas.push({ x: m.x + derX * d, z: m.z + derZ * d });
  }
  return plazas;
}

/**
 * Derivadas de los muebles: un asiento por plaza, con su aproximación (el primer punto libre de delante,
 * de los costados y de atrás). Los muebles sin acceso libre no dan acción.
 */
function sentarDeMuebles(e: Escenario): AccionSentarse[] {
  const suelo = sueloDe(e);
  const mapa = crearMapaDeSuelo(suelo);
  const ocupados = new Set(e.planta.lugares.flatMap((l) => (l.silla ? [l.silla] : [])));
  const acciones: AccionSentarse[] = [];
  for (const m of e.planta.muebles) {
    const def = SENTABLES[m.tipo];
    if (!def || ocupados.has(m.id)) continue;
    const piso = (e.planta.ambientes.find((a) => a.id === m.ambiente)?.y ?? 0) + m.y;
    const pelvis = piso + (def.pelvis === 'alto' ? m.alto + 0.01 : def.pelvis);
    const fx = Math.sin(m.giro);
    const fz = Math.cos(m.giro);
    const dx = Math.cos(m.giro);
    const dz = -Math.sin(m.giro);
    const plazas = plazasDe(m, def);
    plazas.forEach((p, i) => {
      const [cerca = 0.55, lejos = 0.95] = PARAMETROS_ACCIONES.holguraAproximacion;
      const delante = m.fondo / 2;
      const lado = m.ancho / (2 * plazas.length);
      const candidatos: [number, number][] = [
        [p.x + fx * (delante + cerca), p.z + fz * (delante + cerca)],
        [p.x + fx * (delante + lejos), p.z + fz * (delante + lejos)],
        [p.x + dx * (lado + cerca), p.z + dz * (lado + cerca)],
        [p.x - dx * (lado + cerca), p.z - dz * (lado + cerca)],
        [p.x - fx * (delante + cerca), p.z - fz * (delante + cerca)],
      ];
      for (const [ax, az] of candidatos) {
        const ay = alturaEn(suelo, ax, az, piso);
        if (ay === SIN_SUELO || !puntoLibre(mapa, ax, az, RADIO_AVATAR, ay)) continue;
        acciones.push({
          id: plazas.length > 1 ? `sentarse:${m.id}:${i + 1}` : `sentarse:${m.id}`,
          tipo: 'sentarse',
          nombre: def.nombre,
          x: p.x,
          z: p.z,
          y: pelvis - PELVIS_SENTADA,
          radio: PARAMETROS_ACCIONES.radioSentarse,
          asiento: {
            x: p.x,
            z: p.z,
            y: pelvis,
            yaw: m.giro,
            aproximacion: { x: ax, y: ay, z: az },
          },
        });
        return;
      }
    });
  }
  return acciones;
}

const cache = new WeakMap<Escenario, readonly Accion[]>();

/** Todas las acciones del escenario: asientos de sus muebles, «abrir» de sus intereses y las propias. */
export function accionesDe(e: Escenario): readonly Accion[] {
  let lista = cache.get(e);
  if (!lista) {
    lista = [
      ...sentarDeMuebles(e),
      ...e.intereses.map((i): Accion => ({
        id: `abrir:${i.id}`,
        tipo: 'abrir',
        nombre: i.nombre,
        x: i.x,
        z: i.z,
        radio: i.radio,
        interes: i.id,
        panel: i.panel,
      })),
      ...(e.acciones ?? []),
    ];
    cache.set(e, lista);
  }
  return lista;
}

/**
 * La acción a mano del avatar con los pies en (x, z, y) mirando a `rumbo`: dentro del `radio` de la
 * acción (y a una altura alcanzable si la acción la indica), la de menor `distancia − peso · cos(ángulo)`:
 * lo que se mira de frente y lo más cerca. `actual` (la que ya tenía) conserva su ventaja `histeresis`.
 * `excluir`: ids que no se ofrecen (asientos ocupados por otra persona). Sin asignar memoria.
 */
export function accionCercana<A extends AccionBase>(
  acciones: readonly A[],
  x: number,
  z: number,
  y: number,
  rumbo: number,
  actual: A | null = null,
  excluir?: ReadonlySet<string>,
): A | null {
  const P = PARAMETROS_ACCIONES;
  const mx = Math.sin(rumbo);
  const mz = Math.cos(rumbo);
  let mejor: A | null = null;
  let mejorPuntaje = Infinity;
  for (let i = 0; i < acciones.length; i++) {
    const a = acciones[i] as A;
    if (excluir && excluir.has(a.id)) continue;
    const dx = a.x - x;
    const dz = a.z - z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > a.radio + (a === actual ? P.histeresis : 0)) continue;
    if (a.y !== undefined && Math.abs(a.y - y) > P.alturaMax) continue;
    const cos = d > 1e-6 ? (mx * dx + mz * dz) / d : 1;
    const puntaje = d - P.pesoMirada * (cos > 0 ? cos : 0) - (a === actual ? P.histeresis : 0);
    if (puntaje < mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = a;
    }
  }
  return mejor;
}

export interface SeleccionAccion {
  accion: Accion | null;
  x: number;
  z: number;
  y: number;
  disponibles: Set<string>;
}

/** Memoria por avatar: girar quieto no cambia la acción seleccionada. */
export const crearSeleccionAccion = (): SeleccionAccion => ({
  accion: null,
  x: 0,
  z: 0,
  y: 0,
  disponibles: new Set(),
});

/** Conserva la elección hasta desplazarse; ocupación, altura y retirada la invalidan al instante. */
export function seleccionarAccion(
  s: SeleccionAccion,
  acciones: readonly Accion[],
  x: number,
  z: number,
  y: number,
  rumbo: number,
  excluir?: ReadonlySet<string>,
): Accion | null {
  const vigente = s.accion && acciones.find((a) => a.id === s.accion?.id);
  const P = PARAMETROS_ACCIONES;
  let nuevaDisponible = false;
  for (const a of acciones) {
    const disponible =
      !excluir?.has(a.id) &&
      Math.hypot(a.x - x, a.z - z) <= a.radio &&
      (a.y === undefined || Math.abs(a.y - y) <= P.alturaMax);
    if (disponible) {
      if (!s.disponibles.has(a.id)) nuevaDisponible = true;
      s.disponibles.add(a.id);
    } else s.disponibles.delete(a.id);
  }
  if (
    !nuevaDisponible &&
    vigente &&
    !excluir?.has(vigente.id) &&
    Math.hypot(x - s.x, z - s.z, y - s.y) < P.umbralMovimiento &&
    Math.hypot(vigente.x - x, vigente.z - z) <= vigente.radio + P.histeresis &&
    (vigente.y === undefined || Math.abs(vigente.y - y) <= P.alturaMax)
  )
    return (s.accion = vigente);
  s.accion = accionCercana(acciones, x, z, y, rumbo, vigente ?? null, excluir);
  s.x = x;
  s.z = z;
  s.y = y;
  return s.accion;
}

/**
 * El asiento que toca un rayo (origen `o`, dirección `d`): el más cercano al origen cuyo punto queda a
 * menos de `radio` del rayo. Para sentarse con un clic sobre la silla o el sofá. Sin asignar memoria.
 */
export function accionBajoRayo(
  acciones: readonly Accion[],
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  radio: number = PARAMETROS_ACCIONES.radioClic,
): AccionSentarse | null {
  const largo = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!(largo > 0)) return null;
  const ux = dx / largo;
  const uy = dy / largo;
  const uz = dz / largo;
  let mejor: AccionSentarse | null = null;
  let mejorT = Infinity;
  for (let i = 0; i < acciones.length; i++) {
    const a = acciones[i] as Accion;
    if (a.tipo !== 'sentarse') continue;
    const wx = a.asiento.x - ox;
    const wy = a.asiento.y - oy;
    const wz = a.asiento.z - oz;
    const t = wx * ux + wy * uy + wz * uz;
    if (t < 0 || t >= mejorT) continue;
    if (wx * wx + wy * wy + wz * wz - t * t < radio * radio) {
      mejor = a;
      mejorT = t;
    }
  }
  return mejor;
}
