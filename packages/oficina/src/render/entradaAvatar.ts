import type { Mando } from '../animacion/avatar';
import { PARAMETROS_AVATAR } from '../animacion/avatar';

/** Valores iniciales de la palanca normalizada (0..1 del radio). */
export const PARAMETROS_PALANCA = {
  zonaMuerta: 0.12,
  exponente: 1.4,
  limiteCaminar: 0.65,
};

/** Marca breve sobre el punto elegido; no queda encendida si la ruta fue cancelada. */
export const PARAMETROS_DESTINO = {
  duracion: 1.2,
  opacidad: 0.9,
  radioInterior: 0.22,
  radioExterior: 0.3,
  segmentos: 32,
  altura: 0.035,
  expansion: 0.35,
  color: '#8bc6e9',
};

/** Opacidad de la marca de clic; cualquier entrada manual la oculta. */
export function opacidadMarcaDestino(m: Mando, segundos: number): number {
  if (!m.destino || m.adelante !== 0 || m.lateral !== 0) return 0;
  const t = Math.max(0, segundos) / PARAMETROS_DESTINO.duracion;
  return t >= 1 ? 0 : PARAMETROS_DESTINO.opacidad * (1 - t * t);
}

/** Escribe una palanca sin asignaciones: centro estable, paso corto y carrera continua al fondo. */
export function escribirPalanca(x: number, y: number, m: Mando): void {
  const radio = Math.hypot(x, y);
  const p = PARAMETROS_PALANCA;
  if (radio <= p.zonaMuerta) {
    m.adelante = m.lateral = 0;
    m.correr = false;
    return;
  }
  const r = (Math.min(1, radio) - p.zonaMuerta) / (1 - p.zonaMuerta);
  const carrera = Math.max(0, (r - p.limiteCaminar) / (1 - p.limiteCaminar));
  const velocidad =
    r <= p.limiteCaminar
      ? PARAMETROS_AVATAR.velMax * Math.pow(r / p.limiteCaminar, p.exponente)
      : PARAMETROS_AVATAR.velMax +
        (PARAMETROS_AVATAR.velCorrer - PARAMETROS_AVATAR.velMax) *
          carrera *
          carrera *
          (3 - 2 * carrera);
  m.correr = velocidad > PARAMETROS_AVATAR.velMax;
  const magnitud = velocidad / (m.correr ? PARAMETROS_AVATAR.velCorrer : PARAMETROS_AVATAR.velMax);
  m.lateral = (x / radio) * magnitud;
  m.adelante = (-y / radio) * magnitud;
}

/** Teclas de movimiento pulsadas ahora (WASD y flechas, por posición física de la tecla). */
export interface Teclas {
  arriba: boolean;
  abajo: boolean;
  izquierda: boolean;
  derecha: boolean;
  /** Shift: correr. */
  correr: boolean;
}

export const crearTeclas = (): Teclas => ({
  arriba: false,
  abajo: false,
  izquierda: false,
  derecha: false,
  correr: false,
});

/** Dos clics al piso dentro de este tiempo (ms) y distancia (px) son un doble clic: ir corriendo. */
export const DOBLE_CLIC = { ms: 320, px: 12 };

/** ¿El clic (t, x, y) completa un doble clic con el anterior? */
export const esDobleClic = (
  anterior: { t: number; x: number; y: number } | null,
  t: number,
  x: number,
  y: number,
): boolean =>
  anterior !== null &&
  t - anterior.t <= DOBLE_CLIC.ms &&
  Math.hypot(x - anterior.x, y - anterior.y) <= DOBLE_CLIC.px;

/** Píxeles de arrastre a partir de los cuales el gesto es una órbita y no un clic «ir allí». */
export const UMBRAL_ARRASTRE_AVATAR = 5;

const TECLA_DE_CODIGO: Readonly<Record<string, keyof Teclas>> = {
  KeyW: 'arriba',
  ArrowUp: 'arriba',
  KeyS: 'abajo',
  ArrowDown: 'abajo',
  KeyA: 'izquierda',
  ArrowLeft: 'izquierda',
  KeyD: 'derecha',
  ArrowRight: 'derecha',
  ShiftLeft: 'correr',
  ShiftRight: 'correr',
};

/** La tecla de movimiento a la que corresponde `KeyboardEvent.code`, o `null` si no es de movimiento. */
export const teclaDeMovimiento = (code: string): keyof Teclas | null =>
  TECLA_DE_CODIGO[code] ?? null;

/** Anota una pulsación o suelta. Devuelve `false` si `code` no es de movimiento. */
export function registrarTecla(t: Teclas, code: string, abajo: boolean): boolean {
  const tecla = teclaDeMovimiento(code);
  if (tecla === null) return false;
  t[tecla] = abajo;
  return true;
}

/** Escribe los ejes del mando (−1..1) con las teclas pulsadas; arriba/derecha son positivos. */
export function escribirEjes(t: Teclas, m: Mando): void {
  m.adelante = (t.arriba ? 1 : 0) - (t.abajo ? 1 : 0);
  m.lateral = (t.derecha ? 1 : 0) - (t.izquierda ? 1 : 0);
  m.correr = t.correr;
}

/** Suelta todo (al perder el foco la ventana no llega el `keyup`). */
export function soltarTeclas(t: Teclas): void {
  t.arriba = t.abajo = t.izquierda = t.derecha = t.correr = false;
}

/** ¿Soltar a (x1, y1) tras pulsar en (x0, y0) es un clic y no un arrastre? */
export const esClic = (x0: number, y0: number, x1: number, y1: number): boolean =>
  Math.hypot(x1 - x0, y1 - y0) <= UMBRAL_ARRASTRE_AVATAR;

/** ¿El foco está en algo donde se escribe? Ahí las teclas no mueven al avatar. */
export function enCampoDeTexto(
  el: { tagName?: string; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!el) return false;
  const tag = el.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/**
 * Punto donde el rayo (origen, dirección) cruza el plano horizontal `y = altura`, o `null` si
 * apunta hacia arriba o es paralelo. Escribe en `salida`.
 */
export function puntoEnPlano(
  origenY: number,
  dirY: number,
  origenX: number,
  origenZ: number,
  dirX: number,
  dirZ: number,
  altura: number,
  salida: { x: number; z: number },
): boolean {
  if (Math.abs(dirY) < 1e-9) return false;
  const t = (altura - origenY) / dirY;
  if (t <= 0) return false;
  salida.x = origenX + dirX * t;
  salida.z = origenZ + dirZ * t;
  return true;
}
