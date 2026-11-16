/**
 * Locomoción con peso: el cuerpo acelera y frena con curvas suaves, gira con límite de
 * velocidad angular, se inclina como un cuerpo real y camina sin patinar (la fase avanza por
 * distancia, ver `zancada.ts`). Dos modos que escriben in situ en `Locomocion`: `irHacia`
 * (a un punto, con llegada tipo Reynolds) y `conducir` (por mando: dirección y magnitud).
 *
 * Fuentes (investigacion-videojuegos.md): A1.2 marcha por distancia; A2.2 resorte
 * subamortiguado de Juckett para la inclinación y el alabeo (rebase al frenar); A2.3 suavizado
 * exponencial 1 − exp(−λ·dt) para el giro. La llegada (velocidad objetivo = √(2·frenado·distancia))
 * es la «arrival» clásica de Reynolds.
 *
 * Convenios: rumbo = atan2(x, z) (hacia delante = (sen rumbo, cos rumbo)); giro > 0 aumenta el
 * rumbo; `inclinacion` > 0 = hacia delante; `alabeo` con el signo del giro (hacia la curva).
 * Ninguna función asigna memoria. Con dt ≤ 0 no cambia nada.
 */

import { avanzarFaseCaminata } from './caminata';
import { OPCIONES } from './opciones';
import { type Resorte, crearResorte, envolverAngulo, resorteSub } from './resorte';
import { type Salto, avanzarSalto, crearSalto, enElAire, PARAMETROS_SALTO } from './salto';
import { avanzarFase } from './zancada';

export interface Locomocion {
  x: number;
  z: number;
  /** Rumbo (rad) en (−π, π]. */
  rumbo: number;
  /** Velocidad hacia delante (m/s, ≥ 0). */
  velocidad: number;
  /** Velocidad angular de giro del cuadro (rad/s). */
  giro: number;
  /** Fase de la marcha en ciclos [0, 1), avanza por distancia. */
  fase: number;
  /** Inclinación del cuerpo (rad), > 0 hacia delante. */
  inclinacion: Resorte;
  /** Inclinación lateral (rad), con el signo del giro. */
  alabeo: Resorte;
  /** Aceleración longitudinal del cuadro (m/s²). */
  aceleracionLong: number;
  /** Aceleración lateral (centrípeta, velocidad·giro, m/s²). */
  aceleracionLat: number;
  /** Contador que sube en cada pisada (un pie toca el suelo). */
  ultimaPisada: number;
  /** Segundos transcurridos en la anticipación del arranque. */
  espera: number;
  /** Pide correr (Shift, doble clic, ruta larga): la velocidad objetivo pasa a `velCorrer`. */
  correr: boolean;
  /** Salto en curso (con `OPCIONES.caminataPoses`). */
  salto: Salto;
  /** Velocidad máxima (m/s) que impone el terreno (escalera, tarima); `Infinity` en llano. La fija quien conoce el suelo. */
  topeVelocidad: number;
}

export const crearLocomocion = (x: number, z: number, rumbo: number): Locomocion => ({
  x,
  z,
  rumbo,
  velocidad: 0,
  giro: 0,
  fase: 0,
  inclinacion: crearResorte(),
  alabeo: crearResorte(),
  aceleracionLong: 0,
  aceleracionLat: 0,
  ultimaPisada: 0,
  espera: 0,
  correr: false,
  salto: crearSalto(),
  topeVelocidad: Number.POSITIVE_INFINITY,
});

/** Valores iniciales parametrizables. */
export interface ParametrosLocomocion {
  /** Velocidad máxima caminando (m/s). */
  velMax: number;
  /** Velocidad corriendo (m/s). */
  velCorrer: number;
  /** Aceleración (m/s²). */
  aceleracion: number;
  /** Frenado (m/s²). */
  frenado: number;
  /** Frenado desde la carrera (m/s²); el avatar propio puede frenar más fuerte que los autónomos. */
  frenadoCorrer: number;
  /** Velocidad angular máxima de giro (rad/s). */
  giroMax: number;
  /** Radio (m) dentro del cual se da por llegado el destino de `irHacia`. */
  radioLlegada: number;
  /** Segundos de contra-inclinación antes de arrancar desde parado. */
  anticipacion: number;
  /** Rapidez (1/s) con que el rumbo se acerca al deseado antes de topar con `giroMax`. */
  rapidezGiro: number;
  /** Si el rumbo difiere más de este ángulo (rad) del deseado, se avanza despacio. */
  anguloGiroCerrado: number;
  /** Fracción de `velMax` a la que se avanza mientras el giro es cerrado. */
  fraccionGiroCerrado: number;
  /** Inclinación hacia delante (rad) por m/s² de aceleración. */
  inclinacionPorAceleracion: number;
  /** Inclinación hacia delante (rad) por m/s de velocidad. */
  inclinacionPorVelocidad: number;
  /** Contra-inclinación hacia atrás (rad) durante la anticipación. */
  inclinacionAnticipacion: number;
  /** Alabeo (rad) por m/s² de aceleración lateral. */
  alabeoPorAceleracion: number;
  /**
   * Tope (rad) del alabeo. Mucho menor que el de la inclinación: un cambio de dirección en seco da una
   * aceleración lateral enorme durante unos cuadros y, sin este tope, el cuerpo entero se tumbaba ~20°.
   */
  alabeoMax: number;
  /** Razón de amortiguación del resorte del alabeo (≥ 1 = sin rebote al cruzar de un lado a otro). */
  amortiguacionAlabeo: number;
  /**
   * Tope (rad) de la inclinación hacia delante y hacia atrás. Con el arranque y el frenado rápidos del
   * avatar, un tope alto doblaba la cintura ~17° en cada cambio de dirección.
   */
  inclinacionMax: number;
  /** Frecuencia angular (rad/s) y razón de amortiguación de los resortes del cuerpo. */
  frecuenciaResorte: number;
  amortiguacionResorte: number;
}

export const PARAMETROS_LOCOMOCION: ParametrosLocomocion = {
  velMax: 2.3,
  velCorrer: 4.8,
  aceleracion: 22,
  frenado: 26,
  frenadoCorrer: 16,
  giroMax: 16,
  radioLlegada: 0.15,
  anticipacion: 0.025,
  rapidezGiro: 22,
  anguloGiroCerrado: (110 * Math.PI) / 180,
  fraccionGiroCerrado: 0.3,
  inclinacionPorAceleracion: 0.006,
  inclinacionPorVelocidad: 0.01,
  inclinacionAnticipacion: 0.08,
  alabeoPorAceleracion: 0.012,
  alabeoMax: 0.07,
  amortiguacionAlabeo: 1,
  inclinacionMax: 0.12,
  frecuenciaResorte: 14,
  amortiguacionResorte: 0.45,
};

/** Por debajo de esta velocidad (m/s) se considera parado. */
const UMBRAL_PARADO = 0.02;
/** `irHacia` frena para detenerse a esta fracción de `radioLlegada` del destino. */
const FRACCION_RADIO_PARADA = 0.5;

const limitar = (valor: number, limite: number) => Math.max(-limite, Math.min(limite, valor));

/** Un paso común a los dos modos. `girar` indica si hay un rumbo deseado. */
function avanzar(
  l: Locomocion,
  girar: boolean,
  rumboDeseado: number,
  velocidadDeseada: number,
  p: ParametrosLocomocion,
  dt: number,
): void {
  if (dt <= 0) return;
  if (velocidadDeseada > l.topeVelocidad) velocidadDeseada = l.topeVelocidad;

  let mitadGiro = 0;
  // Giro: acercamiento exponencial con tope de velocidad angular, por el camino corto.
  if (girar) {
    const diferencia = envolverAngulo(rumboDeseado - l.rumbo);
    if (Math.abs(diferencia) > p.anguloGiroCerrado) {
      velocidadDeseada = Math.min(velocidadDeseada, p.fraccionGiroCerrado * p.velMax);
    }
    const paso = limitar(diferencia * (1 - Math.exp(-p.rapidezGiro * dt)), p.giroMax * dt);
    l.rumbo = envolverAngulo(l.rumbo + paso);
    l.giro = paso / dt;
    mitadGiro = paso / 2;
  } else {
    l.giro = 0;
  }

  // Anticipación: desde parado, una breve contra-inclinación antes de moverse.
  const parado = l.velocidad < UMBRAL_PARADO;
  let anticipando = false;
  let dtMovimiento = dt; // parte del cuadro en la que el cuerpo ya se mueve
  if (velocidadDeseada > 0 && parado && p.anticipacion > 0) {
    const restante = p.anticipacion - l.espera;
    if (restante > 0) {
      if (dt <= restante) {
        l.espera += dt;
        anticipando = true;
        velocidadDeseada = 0;
      } else {
        l.espera = p.anticipacion;
        dtMovimiento = dt - restante;
      }
    }
  } else if (velocidadDeseada <= 0 && parado) {
    l.espera = 0;
  }

  // Velocidad limitada por aceleración o frenado (rampa continua). Desde la carrera frena con menos
  // fuerza (un pequeño derrape); en el aire solo queda el control en el aire.
  const anterior = l.velocidad;
  const aire = OPCIONES.caminataPoses && enElAire(l.salto) ? PARAMETROS_SALTO.controlAire : 1;
  const frenado = anterior > p.velMax * 1.15 ? p.frenadoCorrer : p.frenado;
  l.velocidad =
    velocidadDeseada > anterior
      ? Math.min(velocidadDeseada, anterior + aire * p.aceleracion * dtMovimiento)
      : Math.max(velocidadDeseada, anterior - aire * frenado * dtMovimiento);
  l.aceleracionLong = (l.velocidad - anterior) / dt;
  l.aceleracionLat = l.velocidad * l.giro;

  // Posición con la velocidad y el rumbo medios del cuadro (exacta en una rampa lineal).
  const distancia = 0.5 * (anterior + l.velocidad) * dtMovimiento;
  const rumboMedio = l.rumbo - mitadGiro;
  l.x += Math.sin(rumboMedio) * distancia;
  l.z += Math.cos(rumboMedio) * distancia;

  // Fase por distancia y pisadas: un pie toca el suelo en la fase 0 y otro en la 0,5.
  const faseAnterior = l.fase;
  if (OPCIONES.caminataPoses) {
    avanzarSalto(l.salto, PARAMETROS_SALTO, dt);
    // En el aire las piernas no «caminan»: la fase queda quieta hasta volver a tocar el suelo.
    if (!enElAire(l.salto))
      l.fase = avanzarFaseCaminata(l.fase, (anterior + l.velocidad) / 2, dtMovimiento);
  } else {
    l.fase = avanzarFase(l.fase, (anterior + l.velocidad) / 2, dtMovimiento);
  }
  l.ultimaPisada +=
    (l.fase < faseAnterior ? 2 : 0) + Math.floor(2 * l.fase) - Math.floor(2 * faseAnterior);

  // Cuerpo: resortes subamortiguados hacia la inclinación y el alabeo objetivo.
  const inclinacionDeseada = anticipando
    ? -p.inclinacionAnticipacion
    : limitar(
        p.inclinacionPorAceleracion * l.aceleracionLong + p.inclinacionPorVelocidad * l.velocidad,
        p.inclinacionMax,
      );
  resorteSub(l.inclinacion, inclinacionDeseada, p.frecuenciaResorte, p.amortiguacionResorte, dt);
  resorteSub(l.alabeo, alabeoDeseado(l, p), p.frecuenciaResorte, p.amortiguacionAlabeo, dt);
}

/** Alabeo (rad) al que tiende el cuerpo en la curva de este cuadro: proporcional y con tope propio. */
export function alabeoDeseado(l: Locomocion, p: ParametrosLocomocion): number {
  return limitar(p.alabeoPorAceleracion * l.aceleracionLat, p.alabeoMax);
}

/**
 * Camina hacia (x, z) y se detiene sin pasarse: la velocidad objetivo es
 * min(velMax, √(2·frenado·distancia)), con el frenado terminando a medio `radioLlegada`.
 * Devuelve `true` cuando llegó (dentro de `radioLlegada` y parado). In situ.
 */
export function irHacia(
  l: Locomocion,
  x: number,
  z: number,
  p: ParametrosLocomocion,
  dt: number,
): boolean {
  const dx = x - l.x;
  const dz = z - l.z;
  const distancia = Math.hypot(dx, dz);
  if (distancia <= p.radioLlegada && l.velocidad < UMBRAL_PARADO) {
    avanzar(l, false, 0, 0, p, dt);
    return true;
  }
  const radioParada = p.radioLlegada * FRACCION_RADIO_PARADA;
  // La distancia restante al final del cuadro (se avanza ~v·dt): evita que un dt grande frene tarde.
  const restante = Math.max(0, distancia - radioParada - l.velocidad * dt);
  const tope = l.correr ? p.velCorrer : p.velMax;
  const frenado = l.velocidad > p.velMax * 1.15 ? p.frenadoCorrer : p.frenado;
  const velocidad = Math.min(tope, Math.sqrt(2 * frenado * restante));
  avanzar(l, distancia > radioParada, Math.atan2(dx, dz), velocidad, p, dt);
  return false;
}

/**
 * Modo mando: `dirX`, `dirZ` es la dirección deseada (no hace falta normalizarla) y `magnitud`
 * (0..1) la fracción de `velMax`. Con magnitud ~0 frena y conserva el rumbo. In situ.
 */
export function conducir(
  l: Locomocion,
  dirX: number,
  dirZ: number,
  magnitud: number,
  p: ParametrosLocomocion,
  dt: number,
): void {
  const m = limitar(magnitud - 0.5, 0.5) + 0.5; // limita a 0..1
  if (m < 0.01 || Math.hypot(dirX, dirZ) < 1e-9) {
    avanzar(l, false, 0, 0, p, dt);
    return;
  }
  avanzar(l, true, Math.atan2(dirX, dirZ), m * (l.correr ? p.velCorrer : p.velMax), p, dt);
}
