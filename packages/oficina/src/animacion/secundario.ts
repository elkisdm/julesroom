/**
 * Movimiento secundario barato: la cabeza, los brazos y el torso siguen con retraso la
 * aceleración del cuerpo (resortes subamortiguados con frecuencia propia por pieza) y la escala
 * se aplasta y estira con rebote en las pisadas y al sentarse, conservando el volumen.
 *
 * Fuente (investigacion-videojuegos.md, A2.2): resorte subamortiguado de Ryan Juckett
 * («Damped Springs»), implementado en `resorte.ts`. Los valores son iniciales y parametrizables.
 *
 * Convenios: `cabezaPitch` > 0 = mira hacia arriba (la cabeza se queda atrás al acelerar);
 * brazo > 0 = hombro hacia atrás (como `Pose`); `cabezaRoll` y `torsoRoll` con el signo de la
 * curva (el torso hacia dentro, la cabeza hacia fuera). `escalaY` en 1 = reposo y `escalaXZ` es
 * la salida que conserva el volumen (1/√escalaY).
 *
 * Ninguna función asigna memoria: escriben en el `Secundario` que el llamador reutiliza.
 */

import { type Resorte, crearResorte, resorteSub } from './resorte';

export interface Secundario {
  cabezaPitch: Resorte;
  cabezaRoll: Resorte;
  brazo: [Resorte, Resorte];
  torsoRoll: Resorte;
  /** Aplastar y estirar: 1 = reposo. */
  escalaY: Resorte;
  /** Salida: escala en x y z que conserva el volumen. */
  escalaXZ: number;
}

export interface EntradasSecundario {
  /** Aceleración longitudinal del cuerpo (m/s²). */
  aceleracionLong: number;
  /** Aceleración lateral (m/s²), con el signo del giro. */
  aceleracionLat: number;
  /** Velocidad angular de giro (rad/s). */
  giro: number;
  /** Velocidad del cuerpo (m/s). */
  velocidad: number;
}

/** Valores iniciales parametrizables. */
export const PARAMETROS_SECUNDARIO = {
  /** Frecuencias angulares (rad/s) de cada pieza: distintas para que no se muevan al unísono. */
  frecuenciaCabezaPitch: 13,
  frecuenciaCabezaRoll: 11,
  frecuenciaBrazo0: 10,
  frecuenciaBrazo1: 12,
  frecuenciaTorso: 9,
  /** Razón de amortiguación de las piezas con retraso (< 1: rebasan un poco). */
  amortiguacion: 0.4,
  /** Rad por m/s² de aceleración. */
  gananciaCabezaPitch: 0.05,
  gananciaCabezaRoll: 0.04,
  gananciaBrazoLong: 0.12,
  gananciaBrazoLat: 0.05,
  /** Rad por rad/s de giro, a partir de `velocidadTorso`. */
  gananciaTorsoGiro: 0.04,
  /** Velocidad (m/s) a partir de la cual el torso se inclina del todo al girar. */
  velocidadTorso: 1,
  /** Tope (rad) de los ángulos objetivo. */
  limiteAngulo: 0.4,
  /** Resorte de la escala: rebote que se apaga en < 0,4 s. */
  frecuenciaEscala: 20,
  amortiguacionEscala: 0.5,
  /** Velocidad inicial (1/s) que aplasta la escala por unidad de intensidad. */
  impulsoPisada: 1.2,
  impulsoSentarse: 3,
  /** Límites de `escalaY`. */
  escalaMin: 0.7,
  escalaMax: 1.3,
};

const P = PARAMETROS_SECUNDARIO;

export const crearSecundario = (): Secundario => ({
  cabezaPitch: crearResorte(),
  cabezaRoll: crearResorte(),
  brazo: [crearResorte(), crearResorte()],
  torsoRoll: crearResorte(),
  escalaY: crearResorte(1),
  escalaXZ: 1,
});

const limitar = (valor: number, limite: number) => Math.max(-limite, Math.min(limite, valor));

/** Avanza todas las piezas `dt` segundos hacia lo que piden las `entradas`. In situ. */
export function avanzarSecundario(s: Secundario, e: EntradasSecundario, dt: number): void {
  const z = P.amortiguacion;
  const tope = P.limiteAngulo;
  resorteSub(
    s.cabezaPitch,
    limitar(P.gananciaCabezaPitch * e.aceleracionLong, tope),
    P.frecuenciaCabezaPitch,
    z,
    dt,
  );
  resorteSub(
    s.cabezaRoll,
    limitar(-P.gananciaCabezaRoll * e.aceleracionLat, tope),
    P.frecuenciaCabezaRoll,
    z,
    dt,
  );
  const lateral = P.gananciaBrazoLat * e.aceleracionLat;
  resorteSub(
    s.brazo[0],
    limitar(P.gananciaBrazoLong * e.aceleracionLong + lateral, tope),
    P.frecuenciaBrazo0,
    z,
    dt,
  );
  resorteSub(
    s.brazo[1],
    limitar(P.gananciaBrazoLong * e.aceleracionLong - lateral, tope),
    P.frecuenciaBrazo1,
    z,
    dt,
  );
  resorteSub(
    s.torsoRoll,
    limitar(
      P.gananciaTorsoGiro * e.giro * Math.min(1, Math.max(0, e.velocidad) / P.velocidadTorso),
      tope,
    ),
    P.frecuenciaTorso,
    z,
    dt,
  );

  resorteSub(s.escalaY, 1, P.frecuenciaEscala, P.amortiguacionEscala, dt);
  if (s.escalaY.x < P.escalaMin) s.escalaY.x = P.escalaMin;
  else if (s.escalaY.x > P.escalaMax) s.escalaY.x = P.escalaMax;
  s.escalaXZ = 1 / Math.sqrt(s.escalaY.x);
}

/** Aplasta y estira un poco al pisar (`intensidad` ~0..1). In situ. */
export function impulsoPisada(s: Secundario, intensidad: number): void {
  s.escalaY.v -= P.impulsoPisada * intensidad;
}

/** Aplasta y estira más al sentarse (`intensidad` ~0..1). In situ. */
export function impulsoSentarse(s: Secundario, intensidad: number): void {
  s.escalaY.v -= P.impulsoSentarse * intensidad;
}
