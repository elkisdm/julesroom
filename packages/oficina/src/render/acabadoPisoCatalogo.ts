import type { Texture } from 'three';
import type { PaletaVariante } from '../escenarios/tipos';
/** Un piso nuevo usa su paleta, sin multiplicarla por el color horneado del mundo original. */
export function acabadoPisoCatalogo(
  paleta: PaletaVariante,
  map: Texture,
  color: string,
  roughness: number,
) {
  const piso = paleta.materiales?.piso;
  return piso
    ? { map: null, color: piso, roughness: paleta.acabados?.piso ?? roughness }
    : { map, color, roughness };
}
