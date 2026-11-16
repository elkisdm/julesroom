/**
 * Coloca HTML sobre un punto de la escena (o la cabeza de alguien) y lo sigue cada cuadro, sin
 * renderizar React: mueve el elemento con `transform`. Si el punto queda detrás de la cámara se oculta.
 */
import { useEffect, useRef } from 'react';
import type { CSSProperties, MutableRefObject, ReactNode } from 'react';
import type { Proyector, PuntoPantalla } from '@oficina/motor';

type Punto3 = { x: number; y: number; z: number };

interface Props {
  proyector: MutableRefObject<Proyector | null>;
  /** Se lee cada cuadro: puede cambiar sin renderizar. */
  objetivo: () => Punto3 | string | null;
  ajustar?: (punto: PuntoPantalla, nodo: HTMLDivElement) => PuntoPantalla;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Ancla({ proyector, objetivo, ajustar, className, style, children }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const leer = useRef({ objetivo, ajustar });
  leer.current = { objetivo, ajustar };
  useEffect(() => {
    let id = 0;
    const paso = () => {
      const nodo = el.current;
      const p = proyector.current;
      const o = leer.current.objetivo();
      const proyectado = p && o !== null ? p(o) : null;
      const punto =
        proyectado && nodo && leer.current.ajustar
          ? leer.current.ajustar(proyectado, nodo)
          : proyectado;
      if (nodo) {
        if (punto?.visible) {
          nodo.style.transform = `translate(${punto.x.toFixed(1)}px, ${punto.y.toFixed(1)}px)`;
          nodo.style.visibility = 'visible';
        } else nodo.style.visibility = 'hidden';
      }
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [proyector]);
  return (
    <div
      ref={el}
      className={`cr-ancla ${className ?? ''}`}
      style={{ visibility: 'hidden', ...style }}
    >
      {children}
    </div>
  );
}
