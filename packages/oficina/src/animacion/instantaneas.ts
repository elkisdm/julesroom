/**
 * Suavizado de personas remotas por interpolación de instantáneas (snapshot interpolation).
 *
 * Fuentes (investigacion-videojuegos.md):
 * - A6, Gambetta (entity interpolation): las entidades remotas se dibujan en el pasado, entre dos
 *   instantáneas ya recibidas, nunca en el presente ni esperando un reenvío.
 * - A6, Fiedler (snapshot interpolation): buffer de ≈3 intervalos de envío, Hermite cúbico con
 *   velocidades (a 10 Hz) y extrapolación acotada solo cuando falta la siguiente instantánea.
 *
 * Las posiciones llegan por LiveKit a ~10 actualizaciones/s: la tasa y el retardo son parámetros
 * (`ParametrosRed`), no constantes. `t` (de cada instantánea) y `tAhora` (de cada muestreo) están
 * en el mismo reloj, en segundos.
 *
 * REGLA DE ORO: `recibirInstantanea` y `muestrearRemoto` no asignan memoria; escriben en el buffer
 * y en la salida que reutiliza el llamador. Son deterministas.
 */

export interface ParametrosRed {
  /** Retardo de dibujo = retardoIntervalos × intervalo estimado entre instantáneas. */
  retardoIntervalos: number;
  /** Cotas del retardo (s). */
  retardoMin: number;
  retardoMax: number;
  /** Tope de extrapolación (s) sin instantánea posterior; la velocidad decae a 0 en ese lapso. */
  extrapolacionMax: number;
  /** Distancia (m) entre instantáneas consecutivas desde la que se trata como teletransporte. */
  saltoMax: number;
  /** Cuánto puede cambiar el retardo por segundo (s/s), para no sacudir la posición al adaptarse. */
  ajusteRetardo: number;
  /** Constante de tiempo (s) con que se disuelve el salto al volver los datos tras extrapolar. */
  suavizadoCorreccion: number;
}

export const PARAMETROS_RED: ParametrosRed = {
  retardoIntervalos: 3,
  retardoMin: 0.08,
  retardoMax: 0.5,
  extrapolacionMax: 0.25,
  saltoMax: 3,
  ajusteRetardo: 0.2,
  suavizadoCorreccion: 0.12,
};

export interface BufferRemoto {
  capacidad: number;
  t: Float64Array;
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  rumbo: Float64Array;
  /** Instantáneas guardadas (≤ capacidad). */
  n: number;
  /** Índice de la más reciente. */
  fin: number;
  /** Intervalo estimado entre instantáneas (s); 0 si aún no hay dos. */
  intervalo: number;
  /** Retardo de dibujo vigente (s); -1 antes del primer muestreo. */
  retardo: number;
  /** `tAhora` del último muestreo; NaN antes del primero. */
  tMuestreo: number;
  /** Instantáneas aceptadas hasta ahora (para saber si llegó una desde el último muestreo). */
  recibidas: number;
  /** Estado del muestreo anterior, para disolver el salto al terminar de extrapolar. */
  previo: {
    recibidas: number;
    extrapolando: boolean;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    /** Corrección acumulada (se suma a la posición cruda y decae a 0). */
    ox: number;
    oy: number;
    oz: number;
  };
}

export interface SalidaRemota {
  x: number;
  y: number;
  z: number;
  rumbo: number;
  velX: number;
  velZ: number;
  /** Rapidez horizontal (m/s). */
  velocidad: number;
  extrapolando: boolean;
}

/** Peso del promedio móvil exponencial del intervalo entre instantáneas. */
const ALFA_INTERVALO = 0.125;
/** Un hueco mayor (emisor en silencio) no contamina el intervalo estimado. */
const HUECO_MAX = 1;
/** Sobre esta rapidez horizontal (m/s) el rumbo se mezcla con la dirección del movimiento. */
const VEL_RUMBO = 0.2;
/** Rapidez a la que la mezcla con la dirección del movimiento llega a su peso máximo. */
const VEL_RUMBO_PLENO = 0.6;
const PESO_RUMBO_MAX = 0.5;
const DOS_PI = Math.PI * 2;

export function crearBufferRemoto(capacidad = 8): BufferRemoto {
  const c = Math.max(2, Math.floor(capacidad));
  return {
    capacidad: c,
    t: new Float64Array(c),
    x: new Float64Array(c),
    y: new Float64Array(c),
    z: new Float64Array(c),
    rumbo: new Float64Array(c),
    n: 0,
    fin: c - 1,
    intervalo: 0,
    retardo: -1,
    tMuestreo: Number.NaN,
    recibidas: 0,
    previo: {
      recibidas: 0,
      extrapolando: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      ox: 0,
      oy: 0,
      oz: 0,
    },
  };
}

/** Guarda una instantánea; devuelve false (y la ignora) si no es más nueva que la última. */
export function recibirInstantanea(
  b: BufferRemoto,
  t: number,
  x: number,
  y: number,
  z: number,
  rumbo: number,
): boolean {
  if (b.n > 0) {
    const dt = t - (b.t[b.fin] as number);
    if (!(dt > 0)) return false;
    const muestra = Math.min(dt, HUECO_MAX);
    b.intervalo =
      b.intervalo === 0 ? muestra : b.intervalo + ALFA_INTERVALO * (muestra - b.intervalo);
  }
  const i = (b.fin + 1) % b.capacidad;
  b.t[i] = t;
  b.x[i] = x;
  b.y[i] = y;
  b.z[i] = z;
  b.rumbo[i] = rumbo;
  b.fin = i;
  if (b.n < b.capacidad) b.n++;
  b.recibidas++;
  return true;
}

/** Índice del anillo de la instantánea `k` (0 = más reciente, 1 = la anterior…). */
function ix(b: BufferRemoto, k: number): number {
  return (b.fin - k + b.capacidad) % b.capacidad;
}

function envolver(a: number): number {
  return a - DOS_PI * Math.round(a / DOS_PI);
}

function esSalto(b: BufferRemoto, i: number, j: number, lim2: number): boolean {
  const dx = (b.x[j] as number) - (b.x[i] as number);
  const dy = (b.y[j] as number) - (b.y[i] as number);
  const dz = (b.z[j] as number) - (b.z[i] as number);
  return dx * dx + dy * dy + dz * dz > lim2;
}

/**
 * Velocidad de la instantánea `k` por diferencia hacia atrás (con la anterior). Solo depende de
 * datos más viejos, así que no cambia cuando llega una instantánea nueva: si cambiara, el tramo
 * que se está dibujando daría un salto. Tras un teletransporte, o sin anterior, vale 0.
 */
const vel = new Float64Array(6);
function velocidadEn(b: BufferRemoto, k: number, lim2: number, desde: number): void {
  vel[desde] = 0;
  vel[desde + 1] = 0;
  vel[desde + 2] = 0;
  if (k + 1 >= b.n) return;
  const i = ix(b, k);
  const a = ix(b, k + 1);
  if (esSalto(b, a, i, lim2)) return;
  const dt = (b.t[i] as number) - (b.t[a] as number);
  if (!(dt > 0)) return;
  vel[desde] = ((b.x[i] as number) - (b.x[a] as number)) / dt;
  vel[desde + 1] = ((b.y[i] as number) - (b.y[a] as number)) / dt;
  vel[desde + 2] = ((b.z[i] as number) - (b.z[a] as number)) / dt;
}

function objetivoRetardo(b: BufferRemoto, p: ParametrosRed): number {
  const r = p.retardoIntervalos * b.intervalo;
  return r < p.retardoMin ? p.retardoMin : r > p.retardoMax ? p.retardoMax : r;
}

/**
 * Escribe en `salida` la posición de la persona en `tAhora - retardo`. Sin instantáneas deja las
 * posiciones como estaban y la velocidad en 0.
 */
export function muestrearRemoto(
  b: BufferRemoto,
  tAhora: number,
  p: ParametrosRed,
  salida: SalidaRemota,
): void {
  salida.extrapolando = false;
  salida.velX = 0;
  salida.velZ = 0;
  salida.velocidad = 0;
  if (b.n === 0) return;

  // El retardo se adapta al intervalo, pero con pendiente limitada: cambiarlo de golpe movería
  // el instante de dibujo hacia atrás o adelante y se vería como un salto.
  const objetivo = objetivoRetardo(b, p);
  let dtCuadro = tAhora - b.tMuestreo;
  if (!(dtCuadro > 0)) dtCuadro = 0;
  else if (dtCuadro > 0.1) dtCuadro = 0.1;
  if (b.retardo < 0) {
    b.retardo = objetivo;
  } else {
    const paso = p.ajusteRetardo * dtCuadro;
    const d = objetivo - b.retardo;
    b.retardo += d > paso ? paso : d < -paso ? -paso : d;
  }
  const tr = tAhora - b.retardo;
  const lim2 = p.saltoMax * p.saltoMax;

  const iN = b.fin;
  const tN = b.t[iN] as number;
  let vx = 0;
  let vy = 0;
  let vz = 0;

  if (tr >= tN) {
    // Sin instantánea posterior: extrapola con la última velocidad, que decae a 0 sin rebote.
    // Desplazamiento: v·(e − e²/2E); velocidad: v·(1 − e/E), con e acotado a E.
    let ex = 0;
    let ey = 0;
    let ez = 0;
    if (b.n > 1 && p.extrapolacionMax > 0) {
      velocidadEn(b, 0, lim2, 0);
      const emax = p.extrapolacionMax;
      const e = tr - tN < emax ? tr - tN : emax;
      const d = e - (e * e) / (2 * emax);
      const f = 1 - e / emax;
      ex = (vel[0] as number) * d;
      ey = (vel[1] as number) * d;
      ez = (vel[2] as number) * d;
      vx = (vel[0] as number) * f;
      vy = (vel[1] as number) * f;
      vz = (vel[2] as number) * f;
    }
    salida.x = (b.x[iN] as number) + ex;
    salida.y = (b.y[iN] as number) + ey;
    salida.z = (b.z[iN] as number) + ez;
    salida.rumbo = b.rumbo[iN] as number;
    salida.extrapolando = tr > tN;
  } else {
    const iV = ix(b, b.n - 1);
    if (tr <= (b.t[iV] as number)) {
      // Más atrás de lo que guarda el buffer: se queda en la instantánea más vieja.
      salida.x = b.x[iV] as number;
      salida.y = b.y[iV] as number;
      salida.z = b.z[iV] as number;
      salida.rumbo = b.rumbo[iV] as number;
    } else {
      let k = 1;
      while (k < b.n - 1 && (b.t[ix(b, k)] as number) > tr) k++;
      const ia = ix(b, k);
      const ib = ix(b, k - 1);
      const ta = b.t[ia] as number;
      const h = (b.t[ib] as number) - ta;
      const u = (tr - ta) / h;
      if (esSalto(b, ia, ib, lim2)) {
        // Teletransporte: se queda en el origen hasta el instante del destino; nunca pasa por el medio.
        salida.x = b.x[ia] as number;
        salida.y = b.y[ia] as number;
        salida.z = b.z[ia] as number;
        salida.rumbo = b.rumbo[ia] as number;
      } else {
        velocidadEn(b, k, lim2, 0);
        velocidadEn(b, k - 1, lim2, 3);
        const u2 = u * u;
        const u3 = u2 * u;
        const h00 = 2 * u3 - 3 * u2 + 1;
        const h10 = u3 - 2 * u2 + u;
        const h01 = -2 * u3 + 3 * u2;
        const h11 = u3 - u2;
        const d00 = 6 * u2 - 6 * u;
        const d10 = 3 * u2 - 4 * u + 1;
        const d11 = 3 * u2 - 2 * u;
        const xa = b.x[ia] as number;
        const xb = b.x[ib] as number;
        const ya = b.y[ia] as number;
        const yb = b.y[ib] as number;
        const za = b.z[ia] as number;
        const zb = b.z[ib] as number;
        salida.x =
          h00 * xa + h10 * h * (vel[0] as number) + h01 * xb + h11 * h * (vel[3] as number);
        salida.y =
          h00 * ya + h10 * h * (vel[1] as number) + h01 * yb + h11 * h * (vel[4] as number);
        salida.z =
          h00 * za + h10 * h * (vel[2] as number) + h01 * zb + h11 * h * (vel[5] as number);
        vy = (d00 * (ya - yb) + d10 * h * (vel[1] as number) + d11 * h * (vel[4] as number)) / h;
        vx = (d00 * (xa - xb) + d10 * h * (vel[0] as number) + d11 * h * (vel[3] as number)) / h;
        vz = (d00 * (za - zb) + d10 * h * (vel[2] as number) + d11 * h * (vel[5] as number)) / h;
        const ra = b.rumbo[ia] as number;
        salida.rumbo = ra + envolver((b.rumbo[ib] as number) - ra) * u;
      }
    }
  }

  // Al llegar datos tras extrapolar (o si cambia la base de la extrapolación) la posición cruda
  // salta; se disuelve con una corrección que decae, salvo si es un teletransporte.
  const pr = b.previo;
  if (
    !Number.isNaN(b.tMuestreo) &&
    pr.extrapolando &&
    (!salida.extrapolando || pr.recibidas !== b.recibidas)
  ) {
    const ex = pr.x + pr.vx * dtCuadro - salida.x;
    const ey = pr.y + pr.vy * dtCuadro - salida.y;
    const ez = pr.z + pr.vz * dtCuadro - salida.z;
    if (ex * ex + ey * ey + ez * ez <= lim2) {
      pr.ox = ex;
      pr.oy = ey;
      pr.oz = ez;
    } else {
      pr.ox = 0;
      pr.oy = 0;
      pr.oz = 0;
    }
  } else if (p.suavizadoCorreccion > 0) {
    const f = Math.exp(-dtCuadro / p.suavizadoCorreccion);
    pr.ox *= f;
    pr.oy *= f;
    pr.oz *= f;
  } else {
    pr.ox = 0;
    pr.oy = 0;
    pr.oz = 0;
  }
  salida.x += pr.ox;
  salida.y += pr.oy;
  salida.z += pr.oz;
  pr.recibidas = b.recibidas;
  pr.extrapolando = salida.extrapolando;
  pr.x = salida.x;
  pr.y = salida.y;
  pr.z = salida.z;
  pr.vx = vx;
  pr.vy = vy;
  pr.vz = vz;

  salida.velX = vx;
  salida.velZ = vz;
  const v = Math.sqrt(vx * vx + vz * vz);
  salida.velocidad = v;
  if (v > VEL_RUMBO) {
    // El rumbo recibido puede ir rezagado: se acerca a la dirección real del movimiento.
    const w = PESO_RUMBO_MAX * Math.min(1, (v - VEL_RUMBO) / (VEL_RUMBO_PLENO - VEL_RUMBO));
    const dir = Math.atan2(vx, vz);
    salida.rumbo += envolver(dir - salida.rumbo) * w;
  }
  salida.rumbo = envolver(salida.rumbo);
  b.tMuestreo = tAhora;
}
