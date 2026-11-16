import { unidadDe } from './vida';

/**
 * A quién mira una persona: quien habla gana, luego quien pasa cerca y luego quien se detiene
 * cerca. Con histéresis (no cambia de objetivo antes de 1,2 s), latencia de reacción propia de
 * cada persona (0,15–0,5 s, derivada de su semilla, para que no giren todos a la vez) y una
 * mirada que vuelve al frente tras 2–4 s si quien se mira no habla.
 *
 * Fuente: investigación del equipo sobre técnicas de videojuegos,
 * A4: la mirada y las reacciones son criterio de animación, sin cita verificada; los tiempos
 * son valores iniciales a calibrar a ojo.
 *
 * Regla de oro: `elegirInteres` corre por persona y por cuadro y NO asigna memoria. Los
 * candidatos van en arreglos tipados que reutiliza el llamador; el resultado se escribe en
 * `salida`. Es determinista (sin azar: todo sale de la semilla y del id del candidato).
 */

/** Distancia (m) bajo la cual alguien que pasa o se detiene llama la atención. */
export const RADIO_CERCA = 3;
/** Distancia (m) bajo la cual se atiende a quien habla. */
export const RADIO_HABLA = 8;
/** Velocidad (m/s) sobre la que se considera que alguien se mueve. */
export const VELOCIDAD_MOVIENDO = 0.3;
/** Segundos mínimos entre cambios de objetivo. */
export const HISTERESIS = 1.2;
const MEDIA_VIDA_SUBE = 0.25;
const MEDIA_VIDA_BAJA = 0.4;
const DT_MAX = 0.1;

/** Otras personas, en arreglos tipados preasignados (`habla`: 0 o 1). */
export interface Candidatos {
  x: Float32Array;
  z: Float32Array;
  velocidad: Float32Array;
  habla: Uint8Array;
  /** Identidad numérica estable: el índice puede cambiar entre cuadros, el id no. */
  id: Int32Array;
}

/** Quién mira: su posición en el plano y su id (para no mirarse a sí mismo). */
export interface PosicionYo {
  x: number;
  z: number;
  id: number;
}

export interface SalidaInteres {
  /** Índice en `Candidatos` del objetivo, o -1 si mira al frente. */
  objetivoIndice: number;
  /** 0..1: cuánto se aplica la mirada; sube y baja suave. */
  peso: number;
}

export interface Interes {
  /** Segundos de reacción propios de la persona (0,15–0,5). */
  latencia: number;
  semilla: number;
  objetivoId: number;
  desde: number;
  ultimoCambio: number;
  candidatoId: number;
  candidatoDesde: number;
  /** Quien ya se miró y no habla no vuelve a llamar la atención hasta que se aleje o hable. */
  ignoradoId: number;
  peso: number;
}

export function crearCandidatos(capacidad: number): Candidatos {
  return {
    x: new Float32Array(capacidad),
    z: new Float32Array(capacidad),
    velocidad: new Float32Array(capacidad),
    habla: new Uint8Array(capacidad),
    id: new Int32Array(capacidad),
  };
}

export function crearSalidaInteres(): SalidaInteres {
  return { objetivoIndice: -1, peso: 0 };
}

/** Estado de interés de una persona; `semilla` viene de `semillaDe(id)`. */
export function crearInteres(semilla = 0): Interes {
  return {
    latencia: 0.15 + 0.35 * unidadDe(semilla, 20),
    semilla,
    objetivoId: -1,
    desde: 0,
    ultimoCambio: -1e9,
    candidatoId: -1,
    candidatoDesde: 0,
    ignoradoId: -1,
    peso: 0,
  };
}

/** 3 = habla, 2 = pasa cerca, 1 = parado cerca, 0 = no interesa. */
function nivel(habla: number, d2: number, velocidad: number): number {
  if (habla !== 0 && d2 < RADIO_HABLA * RADIO_HABLA) return 3;
  if (d2 < RADIO_CERCA * RADIO_CERCA) return velocidad > VELOCIDAD_MOVIENDO ? 2 : 1;
  return 0;
}

export function elegirInteres(
  e: Interes,
  c: Candidatos,
  n: number,
  yo: PosicionYo,
  t: number,
  dt: number,
  salida: SalidaInteres,
): void {
  const d = dt > 0 ? Math.min(dt, DT_MAX) : 0;

  // Dónde está hoy quien se mira (el índice puede haber cambiado) y qué tanto interesa.
  let indice = -1;
  let nivelActual = 0;
  if (e.objetivoId >= 0) {
    for (let i = 0; i < n; i++) {
      if (c.id[i] !== e.objetivoId) continue;
      const dx = (c.x[i] as number) - yo.x;
      const dz = (c.z[i] as number) - yo.z;
      indice = i;
      nivelActual = nivel(c.habla[i] as number, dx * dx + dz * dz, c.velocidad[i] as number);
      break;
    }
    if (indice < 0 || nivelActual === 0) {
      e.objetivoId = -1;
      indice = -1;
    } else if (nivelActual < 3) {
      // Mirada que vuelve al frente tras 2–4 s (propia de la persona y del objetivo).
      const duracion =
        2 + 2 * unidadDe((e.semilla + Math.imul(e.objetivoId, 0x9e3779b1)) >>> 0, 21);
      if (t - e.desde >= duracion) {
        e.ignoradoId = e.objetivoId;
        e.objetivoId = -1;
        e.ultimoCambio = t;
        indice = -1;
      }
    }
  }

  // El mejor candidato: mayor nivel, y a igual nivel el más cercano.
  let mejorNivel = 0;
  let mejorD2 = Infinity;
  let mejorIndice = -1;
  let ignoradoVisible = false;
  for (let i = 0; i < n; i++) {
    const id = c.id[i] as number;
    if (id === yo.id) continue;
    const dx = (c.x[i] as number) - yo.x;
    const dz = (c.z[i] as number) - yo.z;
    const d2 = dx * dx + dz * dz;
    const habla = c.habla[i] as number;
    const nv = nivel(habla, d2, c.velocidad[i] as number);
    if (id === e.ignoradoId) {
      if (nv === 0) continue;
      ignoradoVisible = true;
      if (nv < 3) continue;
    }
    if (nv > mejorNivel || (nv === mejorNivel && nv > 0 && d2 < mejorD2)) {
      mejorNivel = nv;
      mejorD2 = d2;
      mejorIndice = i;
    }
  }
  if (!ignoradoVisible) e.ignoradoId = -1;

  const mejorId = mejorIndice >= 0 ? (c.id[mejorIndice] as number) : -1;
  if (mejorId >= 0 && mejorId !== e.objetivoId && (e.objetivoId < 0 || mejorNivel > nivelActual)) {
    if (e.candidatoId !== mejorId) {
      e.candidatoId = mejorId;
      e.candidatoDesde = t;
    }
    if (t - e.ultimoCambio >= HISTERESIS && t - e.candidatoDesde >= e.latencia) {
      e.objetivoId = mejorId;
      e.desde = t;
      e.ultimoCambio = t;
      e.candidatoId = -1;
      indice = mejorIndice;
    }
  } else {
    e.candidatoId = -1;
  }

  const objetivoPeso = e.objetivoId >= 0 ? 1 : 0;
  const mediaVida = objetivoPeso > e.peso ? MEDIA_VIDA_SUBE : MEDIA_VIDA_BAJA;
  e.peso += (objetivoPeso - e.peso) * (1 - Math.exp((-d * Math.LN2) / mediaVida));

  salida.objetivoIndice = e.objetivoId >= 0 ? indice : -1;
  salida.peso = e.peso;
}
