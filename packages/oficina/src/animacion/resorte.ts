/**
 * Resortes y suavizado independientes de la tasa de cuadros. Ninguna función asigna memoria:
 * escriben in situ en el `Resorte` que el llamador reutiliza.
 *
 * Fuentes (investigacion-videojuegos.md, sección A2):
 * - A2.1 Daniel Holden, «Spring-It-On» (theorangeduck.com/page/spring-roll-call): resorte
 *   críticamente amortiguado exacto con vida media, y `damper_exact` (suavizado exponencial).
 * - A2.2 Ryan Juckett, «Damped Springs» (ryanjuckett.com/damped-springs): forma cerrada con
 *   coeficientes, caso subamortiguado (rebote) y crítico.
 * - A2.3 Suavizado exponencial lerp(a, b, 1 − exp(−λ·dt)).
 */

export interface Resorte {
  x: number;
  v: number;
}

export const crearResorte = (x = 0): Resorte => ({ x, v: 0 });

const LN2 = 0.69314718056;
const EPS = 1e-5;

/** Envuelve un ángulo al rango [−π, π). */
export function envolverAngulo(angulo: number): number {
  return ((((angulo + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

/**
 * Resorte críticamente amortiguado exacto (Holden). `mediaVida` es el tiempo en que la
 * velocidad de acercamiento decae a la mitad; con v = 0 inicial la distancia restante
 * es 0,25·(1 + 2·ln 2) ≈ 0,6 (definición de la fuente, no 0,5; para 0,5 exacto usa `suavizarExp`). `vMeta` es la velocidad del objetivo. In situ.
 */
export function resorteCritico(
  r: Resorte,
  meta: number,
  vMeta: number,
  mediaVida: number,
  dt: number,
): void {
  const d = (4 * LN2) / (mediaVida + EPS);
  const y = d / 2;
  const c = meta + (4 * vMeta) / d;
  const j0 = r.x - c;
  const j1 = r.v + j0 * y;
  const eydt = Math.exp(-y * dt);
  r.x = eydt * (j0 + j1 * dt) + c;
  r.v = eydt * (r.v - j1 * y * dt);
}

/**
 * Resorte subamortiguado (Juckett): `razonAmortiguacion` < 1 rebasa el objetivo y se asienta;
 * con ≥ 1 (o frecuencia ≈ 0) usa los coeficientes del caso crítico. In situ.
 */
export function resorteSub(
  r: Resorte,
  meta: number,
  frecuenciaAngular: number,
  razonAmortiguacion: number,
  dt: number,
): void {
  const w = Math.max(0, frecuenciaAngular);
  const zeta = Math.max(0, razonAmortiguacion);
  const pos = r.x - meta;
  const vel = r.v;
  let pp: number;
  let pv: number;
  let vp: number;
  let vv: number;
  if (zeta >= 1 || w < 1e-6) {
    const expTerm = Math.exp(-w * dt);
    const timeExp = dt * expTerm;
    const timeExpFreq = timeExp * w;
    pp = timeExpFreq + expTerm;
    pv = timeExp;
    vp = -w * timeExpFreq;
    vv = -timeExpFreq + expTerm;
  } else {
    const omegaZeta = w * zeta;
    const alpha = w * Math.sqrt(1 - zeta * zeta);
    const expTerm = Math.exp(-omegaZeta * dt);
    const cosTerm = Math.cos(alpha * dt);
    const sinTerm = Math.sin(alpha * dt);
    const invAlpha = 1 / alpha;
    const expSin = expTerm * sinTerm;
    const expCos = expTerm * cosTerm;
    const expOmegaZetaSinOverAlpha = expTerm * omegaZeta * sinTerm * invAlpha;
    pp = expCos + expOmegaZetaSinOverAlpha;
    pv = expSin * invAlpha;
    vp = -expSin * alpha - omegaZeta * expOmegaZetaSinOverAlpha;
    vv = expCos - expOmegaZetaSinOverAlpha;
  }
  r.x = pp * pos + pv * vel + meta;
  r.v = vp * pos + vv * vel;
}

/** Suavizado exponencial de un valor: tras `mediaVida` segundos queda exactamente a la mitad. */
export function suavizarExp(actual: number, meta: number, mediaVida: number, dt: number): number {
  return actual + (meta - actual) * (1 - Math.exp((-LN2 * dt) / (mediaVida + EPS)));
}

/** Como `suavizarExp` pero para ángulos: toma el camino corto. */
export function suavizarAnguloExp(
  actual: number,
  meta: number,
  mediaVida: number,
  dt: number,
): number {
  return actual + envolverAngulo(meta - actual) * (1 - Math.exp((-LN2 * dt) / (mediaVida + EPS)));
}
