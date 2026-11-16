import { aplicarConjunto } from '@oficina/motor';
import type { Atuendo } from '@oficina/motor';
import { seleccionar } from './estadoPersonaje';
import type { Categoria } from './estadoPersonaje';
/** La clave describe el modelo dibujado, no la selección anterior que originó la muestra. */
export function claveMiniatura(cat: Categoria, id: string, a: Atuendo): string {
  const base = cat.id === 'acc' ? { ...a, acc: [] } : a;
  return `${cat.id}:${id}:${JSON.stringify(seleccionar(base, cat, id))}`;
}
export function claveConjunto(id: string, a: Atuendo): string {
  return `conjunto:${id}:${JSON.stringify(aplicarConjunto(a, id))}`;
}
