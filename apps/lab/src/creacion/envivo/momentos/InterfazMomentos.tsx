import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

/** R3F usa otro reconciliador: la interfaz vive en una raíz DOM propia, fuera de WebGL. */
export function InterfazMomentos({ children }: { children: ReactNode }) {
  const root = useRef<Root | null>(null);
  useLayoutEffect(() => {
    const contenedor = document.querySelector('.cr');
    if (!contenedor) return;
    const nodo = document.createElement('div');
    contenedor.append(nodo);
    const propia = createRoot(nodo);
    root.current = propia;
    return () => {
      root.current = null;
      nodo.remove();
      // El desmontaje del Canvas puede estar dentro de un commit de React.
      queueMicrotask(() => propia.unmount());
    };
  }, []);
  useEffect(() => {
    root.current?.render(children);
  }, [children]);
  return null;
}
