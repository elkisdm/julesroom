import type { VarianteEscenario } from '@oficina/motor';
import { useNavegacionOpciones } from './useNavegacionOpciones';
import { estiloMundo } from './mundos';
import './muestras-estilo.css';

/** Una misma muestra en la selección de mundo y en el editor de la sala. */
export function MuestrasEstilo({
  variantes,
  activa,
  alElegir,
}: {
  variantes: readonly VarianteEscenario[];
  activa?: string;
  alElegir: (id: string) => void;
}) {
  const grupo = useNavegacionOpciones<HTMLDivElement>();
  return (
    <div className="cr-muestras-estilo" ref={grupo} role="group" aria-label="Estilo de la sala">
      {variantes.map((v) => (
        <button
          key={v.id}
          className="cr-mundos-muestra"
          aria-label={v.nombre}
          aria-pressed={v.id === activa}
          title={v.nombre}
          onClick={() => alElegir(v.id)}
        >
          {estiloMundo(variantes, v.id).colores.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
          {v.id === activa && <em aria-hidden="true">✓</em>}
        </button>
      ))}
    </div>
  );
}
