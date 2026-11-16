import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { useAyudaJules } from './useAyudaJules';
import { PASOS } from './ayuda';
export function AyudaJules({
  ayuda,
  ancla,
}: {
  ayuda: ReturnType<typeof useAyudaJules>;
  ancla: RefObject<HTMLFormElement | null>;
}) {
  const [raiz, setRaiz] = useState<HTMLElement | null>(null);
  const [posicion, setPosicion] = useState({ left: 0, bottom: 0, width: 0 });
  useEffect(() => {
    const form = ancla.current;
    if (!form) return;
    setRaiz(form.closest<HTMLElement>('.cr'));
    const colocar = () => {
      const caja = form.getBoundingClientRect();
      const siguiente = { left: caja.left, bottom: innerHeight - caja.top + 8, width: caja.width };
      setPosicion((p) =>
        p.left === siguiente.left && p.bottom === siguiente.bottom && p.width === siguiente.width
          ? p
          : siguiente,
      );
    };
    colocar();
    const observador = new ResizeObserver(colocar);
    observador.observe(form);
    window.addEventListener('resize', colocar);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', colocar);
    };
  }, [ancla]);
  if (!ayuda.panel || !raiz || !posicion.width) return null;
  return createPortal(
    <section style={posicion} className="ak-sugerencias" aria-label="Ayuda de Jules">
      <div className="ak-ayuda-cabecera">
        <strong>
          {ayuda.recorrido
            ? `${ayuda.recorrido.paso + 1}/5 · ${PASOS[ayuda.recorrido.paso]!.titulo}`
            : 'Jules'}
        </strong>
        <button
          type="button"
          className="ak-jules-cerrar"
          aria-label="Ocultar ayuda de Jules"
          onClick={() => ayuda.setPanel(false)}
        >
          ✕
        </button>
      </div>
      <p role="status">{ayuda.respuesta.texto}</p>
      {ayuda.respuesta.detalle && <p className="ak-ayuda-detalle">{ayuda.respuesta.detalle}</p>}
      <div className="ak-ayuda-opciones">
        {ayuda.recorrido ? (
          <>
            <button
              type="button"
              className="cr-boton cr-boton--chico"
              onClick={(e) => {
                ayuda.avanzar('siguiente');
                e.currentTarget.blur();
              }}
            >
              Siguiente
            </button>
            <button type="button" className="cr-boton cr-boton--chico" onClick={ayuda.cancelar}>
              Terminar recorrido
            </button>
          </>
        ) : (
          ayuda.respuesta.opciones.map((o) => (
            <button
              type="button"
              className="cr-boton cr-boton--chico"
              key={o}
              onClick={(e) => {
                ayuda.preguntar(o);
                e.currentTarget.blur();
              }}
            >
              {o}
            </button>
          ))
        )}
      </div>
    </section>,
    raiz,
  );
}
