import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Proyector } from '@oficina/motor';
import { Ancla } from '../Ancla';
import { encuadrarBurbuja } from '../envivo/encuadre';
import type { useJules } from './useJules';
import type { Orden } from './control';
import './jules.css';
export const ORDENES: { texto: string; orden: Orden }[] = [
  { texto: 'Sígueme', orden: 'seguir' },
  { texto: 'Quédate aquí', orden: 'esperar' },
  { texto: 'Ven', orden: 'venir' },
  { texto: 'Vuelve a tu puesto', orden: 'puesto' },
];
export function Jules({
  jules,
  proyector,
  burbuja,
  alAyuda,
  alOrden,
}: {
  jules: ReturnType<typeof useJules>;
  proyector: MutableRefObject<Proyector | null>;
  burbuja: string;
  alAyuda: () => void;
  alOrden: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (jules.menu)
      panel.current
        ?.querySelector<HTMLButtonElement>('.ak-jules-menu button')
        ?.focus({ preventScroll: true });
  }, [jules.menu]);
  return (
    <Ancla
      proyector={proyector}
      objetivo={() =>
        jules.control.current.disponible
          ? { ...jules.control.current.posicion, y: jules.control.current.posicion.y + 2.6 }
          : null
      }
      ajustar={(p, nodo) => {
        const caja = nodo.firstElementChild?.getBoundingClientRect();
        return caja
          ? { ...p, ...encuadrarBurbuja(p, caja.width, caja.height, innerWidth, innerHeight) }
          : p;
      }}
      className="ak-jules-ancla"
    >
      <div className="ak-jules" ref={panel}>
        <button
          className="ak-jules-nombre"
          type="button"
          aria-expanded={jules.menu}
          aria-label="Hablar con Jules"
          onClick={() => jules.setMenu(!jules.menu)}
        >
          <strong>Jules</strong>
          <small>
            {jules.estado}
            {jules.cerca ? ' · E' : ''}
          </small>
        </button>
        {burbuja && !jules.menu && (
          <button type="button" className="ak-jules-burbuja" onClick={alAyuda}>
            {burbuja}
          </button>
        )}
        {jules.menu && (
          <div
            className="ak-jules-menu"
            role="group"
            aria-label="Órdenes para Jules"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                jules.setMenu(false);
              }
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const botones = Array.from(e.currentTarget.querySelectorAll('button'));
                const i = botones.indexOf(document.activeElement as HTMLButtonElement);
                botones[
                  (i + (e.key === 'ArrowDown' ? 1 : botones.length - 1)) % botones.length
                ]?.focus();
              }
            }}
          >
            {ORDENES.map(({ texto, orden }) => (
              <button
                className="cr-boton cr-boton--chico"
                type="button"
                key={orden}
                onClick={() => {
                  alOrden();
                  jules.ejecutar(orden);
                  jules.setMenu(false);
                  (document.activeElement as HTMLElement)?.blur();
                }}
              >
                {texto}
              </button>
            ))}
            <button
              type="button"
              className="cr-boton cr-boton--chico"
              onClick={() => {
                alAyuda();
                jules.setMenu(false);
              }}
            >
              ¿Qué puedo hacer?
            </button>
            <small>J · Llamar a Jules</small>
            <button className="ak-jules-cerrar" type="button" onClick={() => jules.setMenu(false)}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </Ancla>
  );
}
