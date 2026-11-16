/**
 * Almacén de la conversación fuera de React: así llegar un trozo de texto solo vuelve a pintar lo que lo
 * lee (la burbuja) y no toda la sala. Cada componente se suscribe con un selector.
 */
import { useSyncExternalStore } from 'react';
import { estadoInicial, reducir } from './estadoConversacion';
import type { Accion, EstadoConversacion } from './estadoConversacion';

export interface Almacen {
  leer(): EstadoConversacion;
  despachar(a: Accion): void;
  suscribir(oyente: () => void): () => void;
}

export function crearAlmacen(inicial: EstadoConversacion = estadoInicial): Almacen {
  let estado = inicial;
  const oyentes = new Set<() => void>();
  return {
    leer: () => estado,
    despachar(a) {
      const nuevo = reducir(estado, a);
      if (nuevo === estado) return;
      estado = nuevo;
      oyentes.forEach((f) => f());
    },
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => void oyentes.delete(oyente);
    },
  };
}

/** Lee un valor del almacén; el selector debe devolver un valor estable (primitivo o parte del estado). */
export function useAlmacen<T>(almacen: Almacen, selector: (e: EstadoConversacion) => T): T {
  return useSyncExternalStore(almacen.suscribir, () => selector(almacen.leer()));
}
