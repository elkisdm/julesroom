import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** Controles propios del laboratorio: ningún control nativo del navegador salvo el campo de texto. */

export function Boton({
  children,
  onClick,
  tono = 'normal',
  activo = false,
  disabled = false,
  etiqueta,
}: {
  children: ReactNode;
  onClick: () => void;
  tono?: 'normal' | 'primario' | 'peligro';
  activo?: boolean;
  disabled?: boolean;
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      className={`boton boton-${tono}${activo ? ' activo' : ''}`}
      aria-pressed={activo || undefined}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Campo({
  valor,
  onCambio,
  etiqueta,
  invalido = false,
}: {
  valor: string;
  onCambio: (v: string) => void;
  etiqueta: string;
  invalido?: boolean;
}) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        type="text"
        value={valor}
        aria-invalid={invalido || undefined}
        onChange={(e) => onCambio(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

export interface Opcion {
  id: string;
  nombre: string;
}

/** Lista desplegable propia (no usa `<select>`): botón + lista de opciones con teclado básico. */
export function Desplegable({
  etiqueta,
  opciones,
  valor,
  onElegir,
}: {
  etiqueta: string;
  opciones: readonly Opcion[];
  valor: string;
  onElegir: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useId();
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);
  const actual = opciones.find((o) => o.id === valor);
  return (
    <div className="campo" ref={raiz}>
      <span className="etiqueta">{etiqueta}</span>
      <button
        type="button"
        className="desplegable"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? lista : undefined}
        onClick={() => setAbierto((a) => !a)}
        onKeyDown={(e) => e.key === 'Escape' && setAbierto(false)}
      >
        <span>{actual?.nombre ?? valor}</span>
        <span aria-hidden="true" className="flecha" />
      </button>
      {abierto && (
        <ul id={lista} role="listbox" aria-label={etiqueta} className="lista-opciones">
          {opciones.map((o) => (
            <li key={o.id} role="option" aria-selected={o.id === valor}>
              <button
                type="button"
                className={o.id === valor ? 'elegida' : ''}
                onClick={() => {
                  onElegir(o.id);
                  setAbierto(false);
                }}
              >
                {o.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Fila de muestras de color. */
export function Muestras({
  etiqueta,
  colores,
  valor,
  onElegir,
}: {
  etiqueta: string;
  colores: readonly string[];
  valor: string;
  onElegir: (c: string) => void;
}) {
  return (
    <div className="campo">
      <span className="etiqueta">{etiqueta}</span>
      <div className="muestras" role="group" aria-label={etiqueta}>
        {colores.map((c) => (
          <button
            key={c}
            type="button"
            className={`muestra${c === valor ? ' elegida' : ''}`}
            style={{ background: c }}
            aria-label={`${etiqueta} ${c}`}
            aria-pressed={c === valor}
            onClick={() => onElegir(c)}
          />
        ))}
      </div>
    </div>
  );
}

/** Grupo de fichas que se activan o desactivan (accesorios, paquetes). */
export function Fichas({
  etiqueta,
  opciones,
  activas,
  onAlternar,
}: {
  etiqueta: string;
  opciones: readonly Opcion[];
  activas: readonly string[];
  onAlternar: (id: string) => void;
}) {
  return (
    <div className="campo">
      <span className="etiqueta">{etiqueta}</span>
      <div className="fichas" role="group" aria-label={etiqueta}>
        {opciones.map((o) => (
          <Boton key={o.id} activo={activas.includes(o.id)} onClick={() => onAlternar(o.id)}>
            {o.nombre}
          </Boton>
        ))}
      </div>
    </div>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="seccion">
      <h2>{titulo}</h2>
      {children}
    </section>
  );
}
