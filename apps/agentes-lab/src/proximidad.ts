/** Cercanía entre el avatar y las posiciones del mundo que entrega el motor. */
import type { Proyector } from '@oficina/motor';

/** Solo la firma de proyección que necesitan los anclajes HTML. */
export type Proyectar = (objetivo: Parameters<Proyector>[0]) => ReturnType<Proyector>;

export interface PlanoXZ {
  x: number;
  z: number;
}

/** Valores iniciales parametrizables. Distancias en metros. */
export const PARAMETROS_PROXIMIDAD = {
  /** Alcance de la acción hablar. */
  radioEntra: 3.2,
  /** Una conversación abierta por cercanía se cierra pasada esta distancia. */
  radioSale: 4.6,
  /** Cada cuánto se evalúa la cercanía (ms). */
  intervaloMs: 100,
} as const;

export const distancia = (a: PlanoXZ, b: PlanoXZ): number => Math.hypot(a.x - b.x, a.z - b.z);
