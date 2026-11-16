import type { ReactNode } from 'react';

/**
 * Marco de un panel: a la derecha en escritorio, hoja inferior en móvil. No es modal: la escena sigue
 * viva a su lado. «Fijar» evita que se cierre al alejarse el avatar.
 */
export function Hoja({
  titulo,
  bajada,
  acciones,
  fijado,
  alFijar,
  alCerrar,
  children,
}: {
  titulo: string;
  bajada?: string;
  acciones?: ReactNode;
  fijado: boolean;
  alFijar: (fijado: boolean) => void;
  alCerrar: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <header className="pn-cabecera">
        <div className="pn-titulos">
          <h2>{titulo}</h2>
          {bajada && <p>{bajada}</p>}
        </div>
        {acciones}
        <button
          type="button"
          className="pn-icono"
          aria-pressed={fijado}
          title={fijado ? 'Soltar panel' : 'Fijar panel'}
          aria-label={fijado ? 'Soltar panel' : 'Fijar panel'}
          onClick={() => alFijar(!fijado)}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path
              d="M7 3h6l-1 5 3 3v1H5v-1l3-3-1-5Zm3 9v5"
              fill={fijado ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="pn-icono"
          title="Cerrar (Esc)"
          aria-label="Cerrar panel"
          onClick={alCerrar}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="pn-cuerpo">{children}</div>
    </>
  );
}

export function BarraAvance({ porcentaje, etiqueta }: { porcentaje: number; etiqueta: string }) {
  return (
    <div
      className="pn-barra"
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentaje}
    >
      <span style={{ width: `${porcentaje}%` }} />
    </div>
  );
}
