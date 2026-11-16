/**
 * Medidor de tiempos por cuadro: anillo de `Float64Array` preasignado. `registrar` no asigna;
 * `estadisticas` ordena una copia (asigna) y se llama poco (p. ej. una vez por segundo).
 *
 * Fuente: investigacion-videojuegos.md, A7 (Unreal Animation Budget Allocator: se mide el costo
 * de animación por cuadro para decidir cuánto reducir).
 */

export interface Medidor {
  datos: Float64Array;
  /** Posición donde se escribe la próxima muestra. */
  siguiente: number;
  /** Muestras válidas (≤ capacidad). */
  n: number;
}

export interface EstadisticasMedidor {
  media: number;
  p50: number;
  p95: number;
  max: number;
  n: number;
}

export function crearMedidor(capacidad = 600): Medidor {
  return { datos: new Float64Array(Math.max(1, Math.floor(capacidad))), siguiente: 0, n: 0 };
}

/** Anota una muestra en ms; los valores no finitos se ignoran. No asigna. */
export function registrar(m: Medidor, ms: number): void {
  if (!Number.isFinite(ms)) return;
  m.datos[m.siguiente] = ms;
  m.siguiente = (m.siguiente + 1) % m.datos.length;
  if (m.n < m.datos.length) m.n++;
}

/** Percentil `q` (0..1) por interpolación lineal sobre un arreglo ordenado. */
function percentil(ordenado: Float64Array, q: number): number {
  const pos = q * (ordenado.length - 1);
  const i = Math.floor(pos);
  const a = ordenado[i]!;
  const b = ordenado[Math.min(i + 1, ordenado.length - 1)]!;
  return a + (b - a) * (pos - i);
}

/** Escribe media, p50, p95, máximo y n en `salida`. Asigna una copia: llamar poco. */
export function estadisticas(m: Medidor, salida: EstadisticasMedidor): void {
  salida.n = m.n;
  if (m.n === 0) {
    salida.media = 0;
    salida.p50 = 0;
    salida.p95 = 0;
    salida.max = 0;
    return;
  }
  const copia = m.datos.slice(0, m.n);
  // Antes de llenarse el anillo, las muestras ocupan [0, n); después, todo el arreglo.
  copia.sort();
  let suma = 0;
  for (let i = 0; i < copia.length; i++) suma += copia[i]!;
  salida.media = suma / copia.length;
  salida.p50 = percentil(copia, 0.5);
  salida.p95 = percentil(copia, 0.95);
  salida.max = copia[copia.length - 1]!;
}

/**
 * Medidores globales del bucle de animación (agentes y personas remotas): los llena `Personas` y
 * los lee la página de movimiento del laboratorio para reportar ms por cuadro.
 */
export const medidoresAnimacion = { agentes: crearMedidor(), remotas: crearMedidor() };
