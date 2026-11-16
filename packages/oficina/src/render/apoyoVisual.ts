/**
 * Altura de los pies para lo que se pinta en el piso bajo una persona (marca verde del avatar propio y
 * sombras de contacto): sigue la superficie bajo ella, no `y = 0` ni la raíz del rig (que sentada baja
 * hasta el asiento). Lógica pura sobre el suelo con alturas; no asigna.
 */
import { SIN_SUELO, superficieBajo } from '../escenarios/suelo';
import type { Suelo } from '../escenarios/suelo';

/** Holgura bajo el asiento: la superficie del piso queda por debajo, no la del propio asiento. */
const BAJO_ASIENTO = 0.2;

/**
 * Dónde pintar la marca del avatar propio: de pie y sentado, el apoyo (`ySuelo`; sentado la raíz baja
 * al asiento, el piso no); en el aire, la cara que hay bajo él (tarima, mueble, peldaño) para que la
 * marca avise dónde aterriza, y el apoyo del despegue si no hay ninguna.
 */
export function alturaPies(
  a: { enSuelo: boolean; estado: string; x: number; z: number; y: number; ySuelo: number },
  suelo: Suelo | null,
): number {
  if (a.enSuelo || a.estado === 'sentado' || !suelo) return a.ySuelo;
  const h = superficieBajo(suelo, a.x, a.z, a.y);
  return h === SIN_SUELO ? a.ySuelo : h;
}

/**
 * Piso bajo una persona sentada a partir de la altura de su asiento (`y` que entrega la presencia);
 * `respaldo` si el suelo no tiene nada por debajo.
 */
export function alturaBajoAsiento(
  suelo: Suelo,
  x: number,
  z: number,
  yAsiento: number,
  respaldo: number,
): number {
  const h = superficieBajo(suelo, x, z, yAsiento - BAJO_ASIENTO);
  return h === SIN_SUELO ? respaldo : h;
}
