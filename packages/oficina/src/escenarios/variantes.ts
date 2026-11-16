/**
 * Variantes de un escenario (lógica pura, sin three): cuál se usa y cómo lee el dibujo su paleta.
 * El dibujo pide cada color o luz por clave con su valor de plantilla como respaldo, así una variante
 * solo declara lo que cambia.
 */
import { ESTILOS_CATALOGO } from './estilosCatalogo';
import type { PaletaVariante, VarianteEscenario } from './tipos';

export interface VarianteResuelta {
  variante: VarianteEscenario;
  /** `true` si el `id` pedido existe: entonces su hora manda sobre la fija del escenario. */
  explicita: boolean;
  /** Qué avisar (una sola vez) si el `id` pedido no existe; `null` si todo está bien. */
  aviso: string | null;
}

/** La variante `id`; sin `id`, o si no existe (con aviso), la primera. */
export function resolverVariante(
  variantes: readonly VarianteEscenario[],
  id: string | undefined,
): VarianteResuelta {
  const primera = variantes[0];
  if (!primera) throw new Error('Un escenario necesita al menos una variante');
  if (id === undefined) return { variante: primera, explicita: false, aviso: null };
  const elegida = variantes.find((v) => v.id === id) ?? ESTILOS_CATALOGO.find((v) => v.id === id);
  if (elegida) return { variante: elegida, explicita: true, aviso: null };
  return {
    variante: primera,
    explicita: false,
    aviso: `Variante «${id}» desconocida; se usa «${primera.id}». Válidas: ${variantes.map((v) => v.id).join(', ')}`,
  };
}

/** Color de un material: el de la variante o el de la plantilla. */
export function colorDe(paleta: PaletaVariante, clave: string, base: string): string {
  return paleta.materiales?.[clave] ?? base;
}

/** Brillo propio: el de la variante o el de la plantilla. */
export function emisivoDe(
  paleta: PaletaVariante,
  clave: string,
  base: { color: string; fuerza: number },
): { color: string; fuerza: number } {
  return paleta.emisivos?.[clave] ?? base;
}

/** Una luz del dibujo: color de la variante si lo trae e intensidad multiplicada. */
export function luzDe<T extends { color?: string; intensidad: number }>(
  paleta: PaletaVariante,
  clave: string,
  base: T,
): T {
  const v = paleta.luces?.[clave];
  if (!v) return base;
  return {
    ...base,
    color: v.color ?? base.color,
    intensidad: base.intensidad * (v.intensidad ?? 1),
  };
}

/**
 * Hora fija de la luz (Chile; `null` sigue el reloj) a la que llega `horaDeLuz` cuando no viene `horaChile`:
 * la de la variante si se pidió una válida, y si no la del escenario (la mansión sigue el reloj).
 */
export function horaFijaDeVariante(
  horaEscenario: number | null,
  r: VarianteResuelta,
): number | null {
  return r.explicita ? r.variante.paleta.hora : horaEscenario;
}
