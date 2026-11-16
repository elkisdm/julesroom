/**
 * Sentarse y levantarse (avatar propio y personas simuladas): una máquina de estados pura, sin three.
 *
 *   libre → yendo → girando → sentándose → sentado → levantándose → libre
 *
 * - `yendo`: camina a la aproximación del asiento (lo conduce quien la usa: el avatar con su ruta).
 * - `girando`: gira en el sitio hasta el rumbo del asiento (`PARAMETROS_SENTARSE.velocidadGiro`).
 * - `sentandose`: baja con `curvaSentarse` (inclinación, rebote al apoyarse) y se desliza al asiento.
 * - `sentado`: queda en el asiento, mirando según su `yaw`.
 * - `levantandose`: `curvaLevantarse`; vuelve a la aproximación y queda `libre`.
 *
 * Quien la usa mueve el cuerpo mientras no esté `ocupado` (yendo / libre); en las demás fases la máquina
 * escribe `x`, `z` y `rumbo` del cuerpo (cualquier objeto con esos campos: `Locomocion`, `PersonaPresente`).
 * Para el dibujo, `altura` (0 = de pie, 1 = sentado, con su rebote) y `inclinacion` dan la pose.
 *
 * REGLA DE ORO: nada aquí asigna memoria después de `crearSentarse`.
 */
import type { AsientoAccion } from '../escenarios/tipos';
import { crearSalidaSentarse, curvaLevantarse, curvaSentarse } from './transicion';
import type { SalidaSentarse } from './transicion';

export type FaseSentarse =
  'libre' | 'yendo' | 'girando' | 'sentandose' | 'sentado' | 'levantandose';

/** Valores iniciales parametrizables. */
export const PARAMETROS_SENTARSE = {
  /** Rapidez (rad/s) del giro en el sitio hacia el rumbo del asiento. */
  velocidadGiro: 9,
  /** Error de rumbo (rad) con el que se da el giro por hecho. */
  toleranciaGiro: 0.05,
  /** Segundos de la transición de sentarse y de levantarse. */
  duracionSentarse: 0.8,
  duracionLevantarse: 0.55,
};

/**
 * Alturas del cuerpo (m), las de `render/casa/ambientes/asientos.ts` (una prueba comprueba que coinciden):
 * la pelvis de pie, y la pelvis sentada sobre el piso (la cara de todo asiento).
 */
export const PELVIS_DE_PIE = 0.62;
export const PELVIS_SENTADA = 0.45;

/** Lo que la máquina mueve del cuerpo. */
export interface CuerpoSentable {
  x: number;
  z: number;
  rumbo: number;
}

export interface Sentarse {
  fase: FaseSentarse;
  /** Id de la acción y asiento vigentes (`null` en `libre`). */
  id: string | null;
  asiento: AsientoAccion | null;
  /** Segundos en la fase (sentándose y levantándose). */
  t: number;
  /** Desde dónde se desliza al asiento al sentarse. */
  desdeX: number;
  desdeZ: number;
  /** Altura 0..1 (con el rebote al apoyarse), inclinación del torso, retroceso de la pelvis, impacto. */
  salida: SalidaSentarse;
}

export const crearSentarse = (): Sentarse => ({
  fase: 'libre',
  id: null,
  asiento: null,
  t: 0,
  desdeX: 0,
  desdeZ: 0,
  salida: crearSalidaSentarse(),
});

/** Sentarse y levantarse mueven al cuerpo ellos mismos (todo menos `libre` y `yendo`). */
export const ocupado = (s: Sentarse): boolean => s.fase !== 'libre' && s.fase !== 'yendo';

/** Postura que viaja en la presencia: sentada mientras baja o está en el asiento. */
export const posturaDe = (s: Sentarse): 'de-pie' | 'sentado' =>
  s.fase === 'sentandose' || s.fase === 'sentado' ? 'sentado' : 'de-pie';

const DOS_PI = Math.PI * 2;
const normalizar = (a: number): number => {
  const r = a % DOS_PI;
  return r > Math.PI ? r - DOS_PI : r <= -Math.PI ? r + DOS_PI : r;
};

/** Empieza a ir a sentarse. Solo desde `libre`; devuelve si lo aceptó. */
export function pedirSentarse(s: Sentarse, id: string, asiento: AsientoAccion): boolean {
  if (s.fase !== 'libre') return false;
  s.fase = 'yendo';
  s.id = id;
  s.asiento = asiento;
  s.t = 0;
  return true;
}

/** Llegó a la aproximación: empieza a girar hacia el asiento. */
export function llegar(s: Sentarse): void {
  if (s.fase !== 'yendo') return;
  s.fase = 'girando';
  s.t = 0;
}

/**
 * Cualquier mando de movimiento. Yendo o girando: se cancela (libre). Sentándose o sentado: se levanta; si
 * ya se estaba sentando, la transición empieza desde donde iba.
 */
export function levantar(s: Sentarse): void {
  if (s.fase === 'yendo' || s.fase === 'girando') {
    s.fase = 'libre';
    s.id = null;
    s.asiento = null;
    return;
  }
  if (s.fase === 'sentandose') {
    // La curva de levantarse es la inversa de la de sentarse: continúa por el mismo punto.
    const p = Math.min(1, s.t / PARAMETROS_SENTARSE.duracionSentarse);
    s.t = (1 - p) * PARAMETROS_SENTARSE.duracionLevantarse;
    s.fase = 'levantandose';
  } else if (s.fase === 'sentado') {
    s.fase = 'levantandose';
    s.t = 0;
  }
}

/** Un paso de `dt` segundos. Escribe `x`, `z`, `rumbo` de `c` salvo en `libre` y `yendo`. No asigna. */
export function avanzarSentarse(s: Sentarse, c: CuerpoSentable, dt: number): void {
  const a = s.asiento;
  if (!a || s.fase === 'libre' || s.fase === 'yendo') return;
  const P = PARAMETROS_SENTARSE;
  const o = s.salida;

  if (s.fase === 'girando') {
    const falta = normalizar(a.yaw - c.rumbo);
    const paso = P.velocidadGiro * dt;
    if (Math.abs(falta) <= Math.max(paso, P.toleranciaGiro)) {
      c.rumbo = a.yaw;
      s.fase = 'sentandose';
      s.t = 0;
      s.desdeX = c.x;
      s.desdeZ = c.z;
    } else {
      c.rumbo = normalizar(c.rumbo + Math.sign(falta) * paso);
    }
    return;
  }

  c.rumbo = a.yaw;
  if (s.fase === 'sentandose') {
    s.t += dt;
    const p = s.t / P.duracionSentarse;
    curvaSentarse(p, o);
    const u = Math.min(1, o.altura);
    c.x = s.desdeX + (a.x - s.desdeX) * u;
    c.z = s.desdeZ + (a.z - s.desdeZ) * u;
    if (p >= 1) s.fase = 'sentado';
  } else if (s.fase === 'sentado') {
    o.altura = 1;
    o.inclinacionTorso = 0;
    o.pelvisAtras = 1;
    o.impacto = 0;
    c.x = a.x;
    c.z = a.z;
  } else {
    s.t += dt;
    const p = s.t / P.duracionLevantarse;
    curvaLevantarse(p, o);
    const u = Math.min(1, o.altura);
    c.x = a.aproximacion.x + (a.x - a.aproximacion.x) * u;
    c.z = a.aproximacion.z + (a.z - a.aproximacion.z) * u;
    if (p >= 1) {
      c.x = a.aproximacion.x;
      c.z = a.aproximacion.z;
      s.fase = 'libre';
      s.id = null;
      s.asiento = null;
      o.altura = 0;
      o.inclinacionTorso = 0;
      o.pelvisAtras = 0;
      o.impacto = 0;
    }
  }
}
