import { variantesConCatalogo } from '@oficina/motor';
/**
 * Funciones puras para elegir la variante visual de una sala (paleta de colores y luz).
 * `Escenario.variantes` las define; `Oficina` acepta `variante?: string` (id).
 */
import type { Escenario, SalaGuardada } from '@oficina/motor';

/** Devuelve una sala nueva con la variante elegida en su mundo. */
export function elegirVariante(sala: SalaGuardada, varianteId: string): SalaGuardada {
  return { ...sala, mundo: { ...sala.mundo, variante: varianteId } };
}

/**
 * Id de la variante activa: la guardada en el mundo si existe en el escenario, o la primera
 * (por defecto). Nunca devuelve un id inválido.
 */
export function varianteActiva(escenario: Escenario, varianteId: string | undefined): string {
  if (
    varianteId &&
    variantesConCatalogo(escenario.variantes ?? []).some((v) => v.id === varianteId)
  )
    return varianteId;
  return escenario.variantes?.[0]?.id ?? '';
}

/** Indica si el escenario tiene más de una variante (si tiene una o ninguna, la pestaña no se muestra). */
export function tieneVariantes(escenario: Escenario | undefined | null): boolean {
  return (escenario?.variantes?.length ?? 0) > 1;
}
