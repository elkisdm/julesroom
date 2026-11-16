export const PARAMETROS_NAVEGACION_CATALOGO = { maxRecientes: 8 };
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
/** Combina búsqueda, categoría y recientes; conserva el orden de uso en recientes. */
export function filtrarCatalogo<T extends { id: string; nombre: string; categoria: string }>(
  lista: readonly T[],
  busqueda: string,
  categoria: string,
  recientes: readonly string[] = [],
): T[] {
  const texto = normalizar(busqueda);
  const base =
    categoria === 'recientes'
      ? recientes.map((id) => lista.find((t) => t.id === id)).filter((t): t is T => !!t)
      : lista;
  return base.filter(
    (t) =>
      (!categoria || categoria === 'recientes' || t.categoria === categoria) &&
      normalizar(t.nombre).includes(texto),
  );
}
/** El último elegido queda primero y nunca aparece repetido. */
export function recordarReciente(
  anteriores: readonly string[],
  id: string,
  tope = PARAMETROS_NAVEGACION_CATALOGO.maxRecientes,
): string[] {
  return [id, ...anteriores.filter((a) => a !== id)].slice(0, tope);
}
