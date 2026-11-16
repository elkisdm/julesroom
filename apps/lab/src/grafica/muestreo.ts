/** Estadística pura de la página de medición: percentiles de una lista de tiempos de cuadro (ms). */
export interface ResumenCuadros {
  cuadros: number;
  fps: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  /** Fracción de cuadros que tardaron más de 1,5 refrescos (refresco = p10 de los tiempos). */
  perdidos: number;
}

export function percentil(ordenado: readonly number[], p: number): number {
  if (ordenado.length === 0) return 0;
  const i = Math.min(ordenado.length - 1, Math.max(0, Math.ceil((p / 100) * ordenado.length) - 1));
  return ordenado[i] ?? 0;
}

export function resumir(cuadrosMs: readonly number[]): ResumenCuadros {
  const orden = [...cuadrosMs].sort((a, b) => a - b);
  const total = cuadrosMs.reduce((a, b) => a + b, 0);
  const umbral = percentil(orden, 10) * 1.5;
  const perdidos = cuadrosMs.length
    ? cuadrosMs.filter((c) => c > umbral).length / cuadrosMs.length
    : 0;
  return {
    perdidos,
    cuadros: cuadrosMs.length,
    fps: total > 0 ? (cuadrosMs.length * 1000) / total : 0,
    p50: percentil(orden, 50),
    p95: percentil(orden, 95),
    p99: percentil(orden, 99),
    max: orden[orden.length - 1] ?? 0,
  };
}

/** Cuántas personas simuladas faltan para llegar a `total` ocupantes, dadas las ya definidas. */
export function simuladasPara(total: number, yaDefinidas: number): number {
  return Math.max(0, Math.round(total) - yaDefinidas);
}
