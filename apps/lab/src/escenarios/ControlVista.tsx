import { Selector } from './Selector';
import type { Vista } from './vista';

interface Props {
  vista: Vista;
  zonas: readonly { id: string; nombre: string }[];
  alCambiar: (vista: Vista) => void;
}

/** Control segmentado «General · Seguirme · Zonas ▾». Atajos de teclado: G y F (los pone la página). */
export function ControlVista({ vista, zonas, alCambiar }: Props) {
  const zonaActual = typeof vista === 'object' ? vista.zona : null;
  const nombreZona = zonas.find((z) => z.id === zonaActual)?.nombre;
  return (
    <div className="vista" role="group" aria-label="Vista de cámara">
      <button
        type="button"
        className="vista-seg"
        aria-pressed={vista === 'general'}
        aria-keyshortcuts="G"
        onClick={() => alCambiar('general')}
      >
        General
      </button>
      <button
        type="button"
        className="vista-seg"
        aria-pressed={vista === 'seguir'}
        aria-keyshortcuts="F"
        onClick={() => alCambiar('seguir')}
      >
        Seguirme
      </button>
      {zonas.length > 0 && (
        <Selector
          etiqueta="Zona"
          className="vista-zonas"
          opciones={zonas.map((z) => ({ valor: z.id, etiqueta: z.nombre }))}
          valor={zonaActual}
          texto={nombreZona ?? 'Zonas'}
          marcado={zonaActual !== null}
          alCambiar={(id) => alCambiar({ zona: id })}
        />
      )}
    </div>
  );
}
