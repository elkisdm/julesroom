import { useEffect, useRef } from 'react';
import type { Proyectar } from './proximidad';

/** «conversando con <nombre>» sobre la cabeza de un agente (no el contenido), anclada con el proyector. */
export function Marca({
  agenteId,
  nombre,
  proyector,
}: {
  agenteId: string;
  nombre: string;
  proyector: { current: Proyectar | null };
}) {
  const nodo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = nodo.current;
    if (!el) return;
    let raf = 0;
    let previo = '';
    const bucle = () => {
      raf = requestAnimationFrame(bucle);
      const c = proyector.current?.(agenteId);
      const dentro =
        c &&
        c.visible &&
        c.x > 0 &&
        c.y > 40 &&
        c.x < window.innerWidth &&
        c.y < window.innerHeight;
      if (!c || !dentro) {
        if (previo !== 'oculta') {
          el.style.visibility = 'hidden';
          previo = 'oculta';
        }
        return;
      }
      const t = `translate3d(${Math.round(c.x)}px, ${Math.round(c.y - 52)}px, 0) translate(-50%, -100%)`;
      if (t !== previo) {
        el.style.transform = t;
        el.style.visibility = 'visible';
        previo = t;
      }
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, [agenteId, proyector]);
  return (
    <div ref={nodo} className="marca" style={{ visibility: 'hidden' }}>
      conversando con {nombre}
    </div>
  );
}
