import { LIMITE_YAW } from '../animacion/mirada';
import { envolverAngulo } from '../animacion/resorte';
import type { EstadoCuerpo } from './cuerpo';

/** Orienta el cuello hacia lo que está a mano; `aplicarCuerpo` conserva su suavizado habitual. */
export function orientarMiradaAccion(
  cuerpo: EstadoCuerpo,
  objetivo?: { x: number; z: number } | null,
): void {
  cuerpo.salidaInteres.peso = objetivo ? 1 : 0;
  if (!objetivo) return;
  const yaw = envolverAngulo(
    Math.atan2(objetivo.x - cuerpo.loc.x, objetivo.z - cuerpo.loc.z) - cuerpo.loc.rumbo,
  );
  cuerpo.objetivoYaw = Math.max(-LIMITE_YAW, Math.min(LIMITE_YAW, yaw));
  cuerpo.objetivoPitch = 0;
}
