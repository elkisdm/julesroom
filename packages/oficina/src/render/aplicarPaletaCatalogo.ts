import type { Material, MeshStandardMaterial } from 'three';
import type { PaletaVariante } from '../escenarios/tipos';
/** Ajusta únicamente claves declaradas; la ausencia de estilo conserva íntegro el recurso original. */
export function aplicarPaletaCatalogo(
  materiales: Record<string, Material>,
  paleta: PaletaVariante,
): void {
  if (!paleta.acabados) return;
  for (const [clave, material] of Object.entries(materiales)) {
    const m = material as MeshStandardMaterial;
    const color = paleta.materiales?.[clave];
    if (color && m.color) m.color.set(color);
    const rugosidad = paleta.acabados?.[clave];
    if (rugosidad !== undefined && 'roughness' in m) m.roughness = rugosidad;
  }
}
