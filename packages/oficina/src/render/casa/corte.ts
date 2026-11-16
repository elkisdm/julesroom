import { ESPESOR_LOSA, NIVEL_Y } from '../../mansion/plano';
import type { Ambiente, Nivel } from '../../mansion/plano';
import type { LadoCorte } from './arquitectura';

/**
 * Corte de casa de muñecas que se adapta al ángulo. Lógica pura:
 * - Un costado de la casa se oculta cuando la cámara está de ese lado (los muros y vuelos que
 *   quedarían entre ella y el interior), con histéresis para que no parpadee en el borde.
 * - Dentro de un ambiente se oculta además todo lo que queda sobre su cielo.
 * `CorteCasa.tsx` aplica estas reglas a las mallas que llevan `userData.ladoCorte` y
 * `userData.nivelCorte`.
 */

export const LADOS: readonly LadoCorte[] = ['norte', 'sur', 'este', 'oeste'];

/** Normal exterior de cada costado en planta (x, z). */
const NORMAL: Record<LadoCorte, readonly [number, number]> = {
  norte: [0, -1],
  sur: [0, 1],
  este: [1, 0],
  oeste: [-1, 0],
};

/**
 * Coseno del ángulo entre la normal del muro y la dirección hacia la cámara. Se oculta al
 * pasar `UMBRAL_OCULTAR` (a ~24° del frente de ese costado ya queda delante del interior) y
 * vuelve a mostrarse bajo `UMBRAL_MOSTRAR` (~17°): entre los dos mantiene lo que tenía.
 */
export const UMBRAL_OCULTAR = 0.4;
export const UMBRAL_MOSTRAR = 0.3;

export type LadosOcultos = Record<LadoCorte, boolean>;

export const sinLadosOcultos = (): LadosOcultos => ({
  norte: false,
  sur: false,
  este: false,
  oeste: false,
});

/**
 * Actualiza qué costados están ocultos según dónde está la cámara respecto de su punto de
 * mira en planta (`dx`, `dz`). Devuelve si algo cambió. Justo sobre el punto no hay dirección:
 * no cambia nada.
 */
export function actualizarLadosOcultos(oculto: LadosOcultos, dx: number, dz: number): boolean {
  const largo = Math.hypot(dx, dz);
  if (largo < 1e-6) return false;
  let cambio = false;
  for (const lado of LADOS) {
    const [nx, nz] = NORMAL[lado];
    const coseno = (nx * dx + nz * dz) / largo;
    const nuevo = oculto[lado] ? coseno > UMBRAL_MOSTRAR : coseno > UMBRAL_OCULTAR;
    if (nuevo !== oculto[lado]) {
      oculto[lado] = nuevo;
      cambio = true;
    }
  }
  return cambio;
}

/** Sin corte de altura: todo se ve. */
export const SIN_CORTE = 1000;
/** Holgura bajo el cielo del ambiente: los listones del cielo cuelgan 9 cm bajo la losa. */
const HOLGURA_CIELO = 0.1;

/**
 * Altura (m) desde la que se oculta todo cuando se entra a `ambiente`: su cielo, menos la
 * holgura de los listones. Sin ambiente, o en uno sin techo (la terraza), no hay corte.
 */
export function alturaDeCorte(ambiente: Pick<Ambiente, 'y' | 'alto'> | null): number {
  if (!ambiente || ambiente.alto <= 0) return SIN_CORTE;
  return ambiente.y + ambiente.alto - HOLGURA_CIELO;
}

/** Altura de una persona (m): hasta ahí sube el corte mientras ella sube una escalera. */
const ALTO_PERSONA = 1.9;
/** Holgura (m) sobre los pies: el corte nunca baja a ellos (la persona no se oculta a sí misma). */
const MARGEN_PIES = 0.1;
const NIVELES_POR_ALTURA = (Object.values(NIVEL_Y) as number[]).sort((a, b) => a - b);

/**
 * Corte para seguir a quien está con los pies en `y`: oculta lo que queda sobre el cielo de su piso
 * (como al entrar a un ambiente), para que ninguna losa le tape desde la cámara alta. En el último
 * nivel no hay nada encima. En una escalera, entre pisos, se queda en el cielo de ese piso hasta que
 * sus pies lo alcanzan (así la losa y los listones de arriba no le tapan el cuerpo mientras sube por su
 * hueco, p. ej. el caracol) y desde ahí sube con su cabeza. Nunca queda bajo sus pies.
 */
export function alturaDeCorteSeguir(y: number): number {
  const siguiente = NIVELES_POR_ALTURA.find((n) => n > y + 0.05);
  if (siguiente === undefined) return SIN_CORTE;
  const cielo = siguiente - ESPESOR_LOSA - HOLGURA_CIELO;
  // Con los pies casi a la altura del cielo (en el hueco de la losa), la cabeza ya lo pasó: el corte la acompaña.
  if (y + MARGEN_PIES >= cielo) return Math.max(cielo, y + ALTO_PERSONA);
  return cielo;
}

/** Media vida (s) con que el corte de seguir baja o sube de un piso al otro (valor inicial parametrizable). */
export const MEDIA_VIDA_CORTE = 0.2;

/**
 * Corte al seguir a quien tiene los pies en `y`, suavizado: `alturaDeCorteSeguir` salta de un piso al otro de
 * golpe (al pasar a medio camino de la escalera revelaría o taparía una planta entera en un cuadro), así que
 * desde `actual` SUBE hacia él con una media vida de `MEDIA_VIDA_CORTE`, sin quedar nunca bajo los pies
 * de la persona. Al BAJAR no se suaviza: la losa del piso que se deja arriba tiene que ocultarse en cuanto
 * la persona queda bajo ella (suavizado, asomaba ~0,25 s), y esconder lo de arriba no revela nada. Sin corte (`SIN_CORTE`, en el último nivel) de un lado o del otro cambia de golpe: no hay
 * nada que animar a una altura infinita. No asigna.
 */
export function corteSeguirSuave(actual: number, y: number, dt: number): number {
  const objetivo = alturaDeCorteSeguir(y);
  if (!(actual < SIN_CORTE) || objetivo >= SIN_CORTE || !(dt > 0)) return objetivo;
  if (objetivo < actual) return Math.max(objetivo, y + MARGEN_PIES);
  const siguiente =
    actual + (objetivo - actual) * (1 - Math.exp((-Math.LN2 * dt) / MEDIA_VIDA_CORTE));
  return Math.max(Math.abs(objetivo - siguiente) < 1e-3 ? objetivo : siguiente, y + MARGEN_PIES);
}

/** ¿Una malla de ese nivel queda sobre el corte? Compara con la base de su losa. */
export function nivelOculto(nivel: Nivel, corte: number): boolean {
  return NIVEL_Y[nivel] - ESPESOR_LOSA >= corte;
}

/** ¿Algo parado en `y` (los pies de una persona) queda sobre el corte? */
export function sobreElCorte(y: number, corte: number): boolean {
  return y >= corte;
}
