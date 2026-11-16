import type { PaletaVariante } from '../escenarios/tipos';
import type { PaletaLuz } from './casa/luz';

/** La paleta de luz de la hora, con la dirección del sol de la variante si trae una. */
export function paletaConVariante(base: PaletaLuz, variante: PaletaVariante): PaletaLuz {
  const d = variante.sol;
  if (!d) return base;
  const l = Math.hypot(d.x, d.y, d.z);
  if (l === 0) return base;
  return {
    ...base,
    sol: { ...base.sol, direccion: { x: d.x / l, y: d.y / l, z: d.z / l } },
  };
}
