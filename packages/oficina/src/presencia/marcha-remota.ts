import { frecuenciaPaso } from '../animacion/marcha';

/** Velocidad (m/s) a la que la marcha se aplica completa; la misma que usa el animador. */
export const VELOCIDAD_PASEO = 1.2;
const LARGO_PIERNA = 0.6;
/** Más que esto en un cuadro es un salto (reconexión, teletransporte): no se camina. */
const SALTO_MAXIMO = 3;

export interface MarchaRemota {
  x: number;
  z: number;
  /** 0..1: cuánto de la marcha se aplica (rampa al empezar y al terminar de caminar). */
  marcha: number;
  /** Fase del ciclo de paso (rad). */
  fase: number;
}

export const crearMarchaRemota = (x: number, z: number): MarchaRemota => ({
  x,
  z,
  marcha: 0,
  fase: 0,
});

/**
 * Deduce de cuánto se movió la persona entre cuadros si camina y a qué ritmo mueve las piernas.
 * Escribe en `m`; no crea objetos (se llama por persona y por cuadro).
 */
export function avanzarMarchaRemota(m: MarchaRemota, x: number, z: number, dt: number): void {
  const paso = Math.hypot(x - m.x, z - m.z);
  m.x = x;
  m.z = z;
  if (dt <= 0) return;
  const velocidad = paso > SALTO_MAXIMO ? 0 : paso / dt;
  const objetivo = Math.min(1, velocidad / VELOCIDAD_PASEO);
  m.marcha += (objetivo - m.marcha) * Math.min(1, dt * 8);
  if (m.marcha > 0.03) {
    m.fase += frecuenciaPaso(Math.max(velocidad, 0.3), LARGO_PIERNA) * dt;
    if (m.fase > Math.PI * 2) m.fase -= Math.PI * 2;
  }
}
