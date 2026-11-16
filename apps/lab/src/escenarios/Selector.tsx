import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export interface OpcionSelector {
  valor: string;
  etiqueta: string;
  descripcion?: string;
}

interface Props {
  /** Nombre accesible del control (qué se elige). */
  etiqueta: string;
  opciones: readonly OpcionSelector[];
  valor: string | null;
  alCambiar: (valor: string) => void;
  /** Texto del botón; por defecto, la etiqueta de la opción elegida. */
  texto?: string;
  /** Pinta el botón como seleccionado (cuando forma parte de un segmentado). */
  marcado?: boolean;
  className?: string;
}

/**
 * Selector propio (no `<select>` nativo): botón que abre una lista `listbox`. Teclado: ↑ ↓ Inicio Fin
 * mueven, Enter o Espacio eligen, Esc cierra y devuelve el foco, Tab cierra. Un clic fuera cierra.
 */
export function Selector({ etiqueta, opciones, valor, alCambiar, texto, marcado, className }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const id = useId();
  const elegida = opciones.find((o) => o.valor === valor);

  const abrir = () => {
    const i = opciones.findIndex((o) => o.valor === valor);
    setActiva(i >= 0 ? i : 0);
    setAbierto(true);
  };
  const cerrar = (devolverFoco: boolean) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  };

  useEffect(() => {
    if (abierto) lista.current?.focus();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);

  const elegir = (i: number) => {
    const o = opciones[i];
    if (o) alCambiar(o.valor);
    cerrar(true);
  };

  const alTeclearBoton = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      abrir();
    }
  };

  const alTeclearLista = (e: KeyboardEvent) => {
    const n = opciones.length;
    if (e.key === 'ArrowDown') setActiva((a) => (a + 1) % n);
    else if (e.key === 'ArrowUp') setActiva((a) => (a - 1 + n) % n);
    else if (e.key === 'Home') setActiva(0);
    else if (e.key === 'End') setActiva(n - 1);
    else if (e.key === 'Enter' || e.key === ' ') elegir(activa);
    else if (e.key === 'Escape') cerrar(true);
    else if (e.key === 'Tab') return cerrar(false);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={raiz} className={`sel ${className ?? ''}`}>
      <button
        ref={boton}
        type="button"
        className="sel-boton"
        data-marcado={marcado || undefined}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? `${id}-lista` : undefined}
        aria-label={`${etiqueta}: ${elegida?.etiqueta ?? texto ?? ''}`}
        onClick={() => (abierto ? cerrar(false) : abrir())}
        onKeyDown={alTeclearBoton}
      >
        <span className="sel-texto">{texto ?? elegida?.etiqueta}</span>
        <span className="sel-flecha" aria-hidden="true" />
      </button>
      {abierto && (
        <ul
          ref={lista}
          id={`${id}-lista`}
          className="sel-lista"
          role="listbox"
          tabIndex={-1}
          aria-label={etiqueta}
          aria-activedescendant={`${id}-o${activa}`}
          onKeyDown={alTeclearLista}
        >
          {opciones.map((o, i) => (
            <li
              key={o.valor}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={o.valor === valor}
              data-activa={i === activa || undefined}
              className="sel-opcion"
              onPointerEnter={() => setActiva(i)}
              onClick={() => elegir(i)}
            >
              <span>{o.etiqueta}</span>
              {o.descripcion && <small>{o.descripcion}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
