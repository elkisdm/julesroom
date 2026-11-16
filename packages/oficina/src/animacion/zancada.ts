/**
 * Marcha sin patinar. La fase avanza por DISTANCIA recorrida (rueda de zancada) y cada pierna
 * se resuelve con una cinemática inversa de dos huesos en el plano sagital:
 * - en apoyo el pie recorre el suelo en LÍNEA RECTA hacia atrás a la velocidad del cuerpo
 *   (respecto del suelo queda quieto);
 * - en balanceo el pie vuelve hacia delante con un arco, y la rodilla se flexiona sola;
 * - la pelvis sube y baja (rebote natural de dos picos por ciclo) lo justo para que el pie de
 *   apoyo toque el suelo con la pierna casi estirada.
 *
 * Fuente (investigacion-videojuegos.md, A1.2): marcha por distancia (Distance Matching de
 * Unreal): fase += velocidad·dt / longitudZancada; a velocidad 0 la fase se congela y la
 * amplitud es proporcional a la velocidad. La cinemática inversa y el perfil de apoyo son
 * adaptación propia. Esta marcha reemplaza a la senoidal de `marcha.ts` (que sigue existiendo).
 *
 * Convenios (los de `Pose`): cadera y rodilla giran en x; cadera negativa = pierna hacia
 * delante; rodilla ≥ 0 flexiona; hombro negativo = brazo hacia delante. `pelvisY` es un
 * desplazamiento (≤ 0) respecto de la altura de reposo de la pelvis (muslo + pantorrilla).
 *
 * Las funciones por persona y por cuadro no asignan memoria: escriben en `SalidaZancada`.
 */

/** Valores iniciales parametrizables. */
export const PARAMETROS_ZANCADA = {
  /** Largo del muslo (m). */
  muslo: 0.32,
  /** Largo de la pantorrilla (m). La suma es la altura de la pelvis en reposo. */
  pantorrilla: 0.3,
  /**
   * Fracción del ciclo que cada pie pasa apoyado (> 0,5 = doble apoyo). Con 0,5 el balanceo es más
   * lento y la marcha más suave (con 0,6 el balanceo es brusco a más de 1 m/s).
   */
  apoyoFraccion: 0.5,
  /** Longitud de zancada (m por ciclo completo) a velocidad ~0 antes de escalar por amplitud. */
  longitudBase: 0.45,
  /** Cuánto crece la longitud de zancada por cada m/s. */
  longitudPorVelocidad: 0.3,
  /** Escala de velocidad (m/s) con que la amplitud sube de 0 a 1 (1 − exp(−v/escala)). */
  velocidadAmplitud: 0.15,
  /** Altura del paso (m) sobre el suelo, a velocidad ~0 y lo que suma hasta `velocidadReferencia`. */
  alturaPasoBase: 0.02,
  alturaPasoPorVelocidad: 0.03,
  /** Velocidad de paseo (m/s) usada de referencia. */
  velocidadReferencia: 1.15,
  /** Cuánto se acorta la pierna en pleno apoyo (fracción del largo; rodilla ligeramente flexionada). */
  flexionPelvis: 0.015,
  /** Margen del alcance máximo de la pierna en el momento de mayor extensión. */
  margenAlcance: 0.95,
  /** Hombro objetivo = −ganancia · cadera del mismo lado (contrafase). */
  gananciaBrazo: 0.8,
};

export interface SalidaZancada {
  /** Rotación en x de la cadera de cada pierna (negativa = pierna hacia delante). */
  cadera: [number, number];
  /** Flexión de rodilla de cada pierna (≥ 0). */
  rodilla: [number, number];
  /** Desplazamiento vertical de la pelvis respecto de la altura de reposo (m, ≤ 0). */
  pelvisY: number;
  /** Hombro objetivo de cada brazo (negativo = hacia delante). */
  brazo: [number, number];
  /** Pierna en apoyo principal (la más cercana a su apoyo medio): 0 o 1. */
  apoyo: 0 | 1;
}

export const crearSalidaZancada = (): SalidaZancada => ({
  cadera: [0, 0],
  rodilla: [0, 0],
  pelvisY: 0,
  brazo: [0, 0],
  apoyo: 0,
});

const P = PARAMETROS_ZANCADA;

/** Amplitud 0..1: 0 en reposo, → 1 al paso. */
const amplitud = (velocidad: number) => 1 - Math.exp(-Math.max(0, velocidad) / P.velocidadAmplitud);

/**
 * Longitud de zancada (m por ciclo completo, dos pasos). Crece con la velocidad y vale 0 en
 * reposo (la amplitud tiende a 0 sin saltos).
 */
export function longitudZancada(velocidad: number): number {
  const v = Math.max(0, velocidad);
  return (P.longitudBase + P.longitudPorVelocidad * v) * amplitud(v);
}

/**
 * Avanza la fase (en ciclos, [0, 1)) por distancia: v·dt / longitudZancada. Con v = 0 o dt = 0
 * la fase no cambia.
 */
export function avanzarFase(fase: number, velocidad: number, dt: number): number {
  if (velocidad <= 1e-6 || dt <= 0) return fase;
  const siguiente = fase + (velocidad * dt) / longitudZancada(velocidad);
  return siguiente - Math.floor(siguiente);
}

/**
 * Resuelve una pierna: `u` es su fase local (0 = el pie toca el suelo), `paso` el desplazamiento
 * total del pie en apoyo (m) y `h` la altura de la pelvis sobre el suelo. Escribe en `salida`.
 */
function resolverPierna(
  u: number,
  paso: number,
  alturaPaso: number,
  h: number,
  salida: SalidaZancada,
  indice: 0 | 1,
): void {
  const { muslo, pantorrilla, apoyoFraccion } = P;
  let fx: number;
  let dz = h;
  if (u < apoyoFraccion) {
    fx = paso * (0.5 - u / apoyoFraccion);
  } else {
    const s = (u - apoyoFraccion) / (1 - apoyoFraccion);
    // Hermite con la misma velocidad del pie que en apoyo (−paso/β por ciclo) al despegar y al
    // aterrizar: el pie toca el suelo sin velocidad respecto de él y no hay quiebre al despegar.
    const m = (1 - apoyoFraccion) / apoyoFraccion;
    const e = s * (s * (1 + m) * (3 - 2 * s) - m);
    fx = paso * (e - 0.5);
    const sn = Math.sin(Math.PI * s);
    dz = h - alturaPaso * sn * sn;
  }
  const largo = muslo + pantorrilla;
  const maximo = largo;
  const r2 = fx * fx + dz * dz;
  if (r2 > maximo * maximo) {
    const k = maximo / Math.sqrt(r2);
    fx *= k;
    dz *= k;
  }
  const alcance2 = fx * fx + dz * dz;
  const cosRodilla =
    (alcance2 - muslo * muslo - pantorrilla * pantorrilla) / (2 * muslo * pantorrilla);
  const flexion = Math.acos(Math.max(-1, Math.min(1, cosRodilla)));
  const desvio = Math.atan2(
    pantorrilla * Math.sin(flexion),
    muslo + pantorrilla * Math.cos(flexion),
  );
  salida.cadera[indice] = -(Math.atan2(fx, dz) + desvio);
  salida.rodilla[indice] = flexion;
}

/**
 * Pose de piernas, pelvis y brazos para una fase (ciclos) y una velocidad (m/s). Escribe en
 * `salida` y la devuelve; la pierna 1 va medio ciclo detrás de la 0.
 */
export function calcularZancada(
  fase: number,
  velocidad: number,
  salida: SalidaZancada,
): SalidaZancada {
  const { muslo, pantorrilla, apoyoFraccion } = P;
  const largo = muslo + pantorrilla;
  const g = amplitud(velocidad);
  const paso = apoyoFraccion * longitudZancada(velocidad);
  const g2 = g * g; // la flexión de rodilla crece como √(acortamiento): g² la hace lineal en g
  const alturaPaso =
    g2 *
    (P.alturaPasoBase +
      P.alturaPasoPorVelocidad * Math.min(1, Math.max(0, velocidad) / P.velocidadReferencia));

  // Altura de la pelvis: más baja en el doble apoyo. `hMin` es la altura al despegar y al
  // aterrizar: la que permite alcanzar el suelo con el pie al extremo de la zancada (pierna
  // casi estirada, nunca más).
  const f = fase - Math.floor(fase);
  const hMax = largo * (1 - P.flexionPelvis * g2);
  const alcance = largo * (1 - (1 - P.margenAlcance) * g2);
  const hMin = Math.min(hMax, Math.sqrt(alcance * alcance - 0.25 * paso * paso));
  const pesoExtremo = 0.5 * (1 - Math.cos(2 * Math.PI * apoyoFraccion));
  const rebote = (hMax - hMin) / pesoExtremo;
  const h = hMax - rebote * 0.5 * (1 - Math.cos(4 * Math.PI * (f - apoyoFraccion / 2)));

  const u1 = f + 0.5 >= 1 ? f - 0.5 : f + 0.5;
  resolverPierna(f, paso, alturaPaso, h, salida, 0);
  resolverPierna(u1, paso, alturaPaso, h, salida, 1);

  let w = f - apoyoFraccion / 2;
  w -= Math.round(w);
  salida.apoyo = Math.abs(w) < 0.25 ? 0 : 1;
  salida.pelvisY = h - largo;
  salida.brazo[0] = -P.gananciaBrazo * salida.cadera[0];
  salida.brazo[1] = -P.gananciaBrazo * salida.cadera[1];
  return salida;
}
