import type { Azar } from '../azar';
import { PERFIL_NEUTRO } from './personalidad';
import type { PerfilIdle } from './personalidad';
import type { VarianteIdle } from './idle';

/**
 * Vida en reposo: lo que hace que una persona quieta se vea viva sin que dos vecinos se
 * muevan a la vez. Cada persona tiene un temperamento derivado de la semilla de su identidad
 * (frecuencias propias y continuas) y una respiración asimétrica, un cambio de peso por
 * resorte, una deriva de cabeza de senos inconmensurables, un parpadeo con reloj propio y
 * gestos ocasionales.
 *
 * Fuente: investigación del equipo sobre técnicas de videojuegos,
 * A3 («juice»: anticipación y resortes subamortiguados, Jonasson y Purho, GDC 2012; solo la
 * existencia de la charla está verificada) y A4 (parpadeo de 2–6 s y ~120 ms, micro-movimiento
 * de reposo con ruido suave: criterio de animación, no verificado en una cita). Resortes: A2.
 *
 * Regla de oro: `avanzarVida` corre por persona y por cuadro y NO asigna memoria; escribe en
 * `v` y en `salida`, que reutiliza el llamador. El azar se inyecta.
 */

const DOS_PI = Math.PI * 2;
const DT_MAX = 0.1;

/** Gestos posibles (índice = `gestoVariante`); reusan las claves de `PerfilIdle.pesos`. */
export const GESTOS_VIDA = [
  'rascarse_cabeza',
  'estirarse', // estirar el cuello
  'telefono', // mirar el reloj o el teléfono
  'mirar_alrededor',
  'tamborilear',
  'estirar_espalda',
] as const satisfies readonly VarianteIdle[];

/** Rasgos estables de una persona, todos derivados de su semilla. */
export interface Temperamento {
  /** Respiraciones por segundo (0,20–0,32). */
  frecRespiracion: number;
  /** Fracción de la escala de respiración que usa (0,6–1). */
  ampRespiracion: number;
  faseRespiracion: number;
  /** Segundos medios entre cambios de peso (6–14). */
  periodoPeso: number;
  /** Desplazamiento lateral máximo de la cadera (m). */
  ampPeso: number;
  /** Rapidez de los microgestos (0,6–1,4). */
  nerviosismo: number;
  /** Intervalo medio entre parpadeos (2,8–4,8 s). */
  intervaloParpadeo: number;
  /** Multiplica la frecuencia de gestos (0,5–1,5). */
  propensionGestos: number;
  /** Frecuencia base de la deriva de cabeza (Hz), distinta por eje. */
  derivaYaw: number;
  derivaPitch: number;
  derivaRoll: number;
}

/** Ajustes que `avanzarVida` escribe cada cuadro; el rig los suma a la pose. */
export interface AjusteVida {
  /** Escala de respiración 0..1 (sube en ~40 % del ciclo y baja en ~60 %). */
  respiracion: number;
  /** Desplazamiento lateral de la cadera (m); positivo = el peso va al pie derecho. */
  pesoCadera: number;
  /** Ladeo de la pelvis (rad), acompaña al peso. */
  alabeoPelvis: number;
  /** Contracurva de la columna (rad). */
  alabeoColumna: number;
  /** Flexión relajada de la rodilla del pie libre (rad); la del pie de apoyo queda en 0. */
  rodillaIzq: number;
  rodillaDer: number;
  cabezaYaw: number;
  cabezaPitch: number;
  cabezaRoll: number;
  /** true mientras el párpado está cerrado. */
  parpadeo: boolean;
  /** Índice en `GESTOS_VIDA`, o -1 si no hay gesto. */
  gestoVariante: number;
  /** 0..1 dentro del gesto (0 si no hay). */
  gestoProgreso: number;
}

export interface Vida {
  temperamento: Temperamento;
  semilla: number;
  /** Pesos de sorteo de cada gesto, en el orden de `GESTOS_VIDA`. */
  pesosGesto: Float64Array;
  faseRespiracion: number;
  /** Posición normalizada del peso (−1..1) y su velocidad. */
  peso: number;
  pesoVel: number;
  lado: number;
  esperaPeso: number;
  esperaParpadeo: number;
  restoParpadeo: number;
  /** Cuenta atrás hasta el segundo parpadeo de un doble; < 0 si no hay. */
  dobleParpadeo: number;
  esperaGesto: number;
  gestoActual: number;
  gestoT: number;
  gestoDur: number;
}

/** Hash de 32 bits (finalizador de MurmurHash3). */
function mezclar(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Identidad (texto) → semilla estable de 32 bits sin signo (FNV-1a + mezcla). */
export function semillaDe(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return mezclar(h >>> 0);
}

/** Número estable en [0, 1) para el rasgo `k` de una semilla. */
export function unidadDe(semilla: number, k: number): number {
  return mezclar((semilla ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0) / 4294967296;
}

export function derivarTemperamento(semilla: number): Temperamento {
  const u = (k: number) => unidadDe(semilla, k);
  return {
    frecRespiracion: 0.2 + 0.12 * u(0),
    ampRespiracion: 0.6 + 0.4 * u(1),
    faseRespiracion: u(2),
    periodoPeso: 6 + 8 * u(3),
    ampPeso: 0.014 + 0.01 * u(4),
    nerviosismo: 0.6 + 0.8 * u(5),
    intervaloParpadeo: 2.8 + 2 * u(6),
    propensionGestos: 0.5 + u(7),
    derivaYaw: 0.06 + 0.06 * u(8),
    derivaPitch: 0.05 + 0.06 * u(9),
    derivaRoll: 0.04 + 0.05 * u(10),
  };
}

export function crearAjusteVida(): AjusteVida {
  return {
    respiracion: 0,
    pesoCadera: 0,
    alabeoPelvis: 0,
    alabeoColumna: 0,
    rodillaIzq: 0,
    rodillaDer: 0,
    cabezaYaw: 0,
    cabezaPitch: 0,
    cabezaRoll: 0,
    parpadeo: false,
    gestoVariante: -1,
    gestoProgreso: 0,
  };
}

/** Estado de vida de una persona. Los pesos de gesto salen del perfil de su rol. */
export function crearVida(semilla: number, perfil: PerfilIdle = PERFIL_NEUTRO): Vida {
  const temperamento = derivarTemperamento(semilla);
  const pesosGesto = new Float64Array(GESTOS_VIDA.length);
  for (let i = 0; i < GESTOS_VIDA.length; i++) {
    pesosGesto[i] = Math.max(0, perfil.pesos[GESTOS_VIDA[i] as VarianteIdle] ?? 0);
  }
  const lado = unidadDe(semilla, 11) < 0.5 ? -1 : 1;
  return {
    temperamento,
    semilla,
    pesosGesto,
    faseRespiracion: temperamento.faseRespiracion,
    peso: lado,
    pesoVel: 0,
    lado,
    esperaPeso: temperamento.periodoPeso * (0.3 + 0.7 * unidadDe(semilla, 12)),
    esperaParpadeo: 0.5 + 3 * unidadDe(semilla, 13),
    restoParpadeo: 0,
    dobleParpadeo: -1,
    esperaGesto: (6 + 20 * unidadDe(semilla, 14)) / temperamento.propensionGestos,
    gestoActual: -1,
    gestoT: 0,
    gestoDur: 1,
  };
}

const FRACCION_INHALAR = 0.4;
const DURACION_PARPADEO = 0.12;
const OMEGA_PESO = 5.5;
const ZETA_PESO = 0.85;
const PHI = 1.6180339887;
const E = 2.7182818285;

/**
 * Avanza la vida de una persona `dt` segundos (se acota a 0..0,1) y escribe `salida`.
 * `t` es el reloj global (s); `quieto` indica que está parada o sentada sin hacer otra cosa
 * (solo entonces cambia de pie y hace gestos).
 */
export function avanzarVida(
  v: Vida,
  dt: number,
  quieto: boolean,
  t: number,
  azar: Azar,
  salida: AjusteVida,
): void {
  const d = dt > 0 ? Math.min(dt, DT_MAX) : 0;
  const tm = v.temperamento;

  // Respiración: fase con frecuencia que ondula despacio; inhalar corto, exhalar largo.
  v.faseRespiracion +=
    d * tm.frecRespiracion * (1 + 0.08 * Math.sin(DOS_PI * 0.037 * t + v.semilla));
  v.faseRespiracion -= Math.floor(v.faseRespiracion);
  const p = v.faseRespiracion;
  const onda =
    p < FRACCION_INHALAR
      ? 0.5 - 0.5 * Math.cos((Math.PI * p) / FRACCION_INHALAR)
      : 0.5 + 0.5 * Math.cos((Math.PI * (p - FRACCION_INHALAR)) / (1 - FRACCION_INHALAR));
  salida.respiracion = onda * tm.ampRespiracion;

  // Cambio de peso: resorte hacia un pie; solo cambia de pie cuando está quieto.
  if (quieto) {
    v.esperaPeso -= d;
    if (v.esperaPeso <= 0) {
      v.lado = -v.lado;
      v.esperaPeso = tm.periodoPeso * (0.7 + 0.6 * azar());
    }
  }
  const objetivo = quieto ? v.lado : 0;
  v.pesoVel +=
    (OMEGA_PESO * OMEGA_PESO * (objetivo - v.peso) - 2 * ZETA_PESO * OMEGA_PESO * v.pesoVel) * d;
  v.peso += v.pesoVel * d;
  salida.pesoCadera = v.peso * tm.ampPeso;
  salida.alabeoPelvis = v.peso * 0.05;
  salida.alabeoColumna = -v.peso * 0.03;
  salida.rodillaIzq = 0.12 * Math.max(0, v.peso);
  salida.rodillaDer = 0.12 * Math.max(0, -v.peso);

  // Deriva de cabeza: senos de frecuencias inconmensurables propias de cada persona.
  const k = tm.nerviosismo;
  const w = DOS_PI * t;
  const fy = tm.derivaYaw * k;
  const fp = tm.derivaPitch * k;
  const fr = tm.derivaRoll * k;
  const s = v.semilla;
  salida.cabezaYaw =
    0.05 * Math.sin(w * fy + s) +
    0.03 * Math.sin(w * fy * PHI + s * 2.1) +
    0.015 * Math.sin(w * fy * E + s * 3.7);
  salida.cabezaPitch =
    0.03 * Math.sin(w * fp * 1.4142 + s * 1.3) +
    0.02 * Math.sin(w * fp * 2.236 + s * 2.9) +
    0.01 * Math.sin(w * fp * 3.1416 + s * 4.1);
  salida.cabezaRoll =
    0.02 * Math.sin(w * fr * 1.7321 + s * 0.7) +
    0.012 * Math.sin(w * fr * 2.6458 + s * 1.9) +
    0.006 * Math.sin(w * fr * 3.3166 + s * 5.3);

  // Parpadeo con reloj propio: intervalo de 2 a 6 s y doble parpadeo ocasional.
  v.esperaParpadeo -= d;
  if (v.esperaParpadeo <= 0) {
    v.restoParpadeo = DURACION_PARPADEO;
    const intervalo = tm.intervaloParpadeo * (0.6 + 0.8 * azar());
    v.esperaParpadeo = Math.min(6, Math.max(2, intervalo));
    v.dobleParpadeo = azar() < 0.15 ? 0.22 : -1;
  } else if (v.dobleParpadeo > 0) {
    v.dobleParpadeo -= d;
    if (v.dobleParpadeo <= 0) {
      v.restoParpadeo = DURACION_PARPADEO;
      v.dobleParpadeo = -1;
    }
  }
  v.restoParpadeo -= d;
  salida.parpadeo = v.restoParpadeo > 0;

  // Gestos ocasionales: solo quieto; ponderados por el perfil de la persona.
  if (!quieto) {
    v.gestoActual = -1;
    v.gestoT = 0;
  } else if (v.gestoActual >= 0) {
    v.gestoT += d;
    if (v.gestoT >= v.gestoDur) {
      v.gestoActual = -1;
      v.gestoT = 0;
      v.esperaGesto = (10 + 25 * azar()) / tm.propensionGestos;
    }
  } else {
    v.esperaGesto -= d;
    if (v.esperaGesto <= 0) {
      let total = 0;
      for (let i = 0; i < v.pesosGesto.length; i++) total += v.pesosGesto[i] as number;
      if (total > 0) {
        let resto = azar() * total;
        let elegido = 0;
        for (let i = 0; i < v.pesosGesto.length; i++) {
          const pg = v.pesosGesto[i] as number;
          if (pg <= 0) continue;
          elegido = i;
          if (resto < pg) break;
          resto -= pg;
        }
        v.gestoActual = elegido;
        v.gestoT = 0;
        v.gestoDur = (1.6 + 1.6 * azar()) / (0.8 + 0.4 * k);
      } else {
        v.esperaGesto = 30;
      }
    }
  }
  salida.gestoVariante = v.gestoActual;
  salida.gestoProgreso = v.gestoActual >= 0 ? Math.min(1, v.gestoT / v.gestoDur) : 0;
}
