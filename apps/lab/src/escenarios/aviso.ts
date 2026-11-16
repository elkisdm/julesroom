/** Texto del aviso de acción («E · sentarse», «E · abrir Mesa Cripto»). Lógica pura. */
import { ETIQUETA_ACCION } from '@oficina/motor';
import type { Accion } from '@oficina/motor';

/**
 * Verbo y, si la acción abre algo, el nombre de lo que abre; `null` si no hay acción. Sentado manda: lo único
 * que se puede hacer es levantarse (nunca «sentarse», aunque la acción cercana llegue con retraso). Con el panel
 * de esa acción ya `abierto`, la misma E lo cierra: el verbo es «cerrar».
 */
export function textoAviso(
  accion: Accion | null,
  sentado = false,
  abierto = false,
): { verbo: string; objeto: string | null } | null {
  if (sentado) return { verbo: 'levantarse', objeto: null };
  if (!accion) return null;
  return {
    verbo: accion.tipo === 'abrir' && abierto ? 'cerrar' : ETIQUETA_ACCION[accion.tipo],
    objeto: accion.tipo !== 'sentarse' ? accion.nombre : null,
  };
}
