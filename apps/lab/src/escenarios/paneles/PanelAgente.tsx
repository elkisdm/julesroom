import type { AgenteSala } from './agentes';
import { BarraAvance, Hoja } from './Hoja';
import { TAREAS, progresoTarea } from './tareas';
import type { EstadoAgente, Tarea } from './tareas';
import type { PropsHoja } from './tipos';

/** El puesto de un agente: qué hace, en qué está y su último resultado. El dueño le da tareas de la lista. */
export function PanelAgente({
  agente,
  estado,
  ahora,
  alAsignar,
  ...hoja
}: {
  agente: AgenteSala;
  estado: EstadoAgente;
  ahora: number;
  alAsignar: (t: Tarea) => void;
} & PropsHoja) {
  const tarea = estado.tarea;
  return (
    <Hoja
      titulo={agente.titulo}
      bajada={`Agente de análisis · ${agente.rol}`}
      acciones={<span className="pn-estado">{tarea ? 'Trabajando' : 'Disponible'}</span>}
      {...hoja}
    >
      <section className="pn-tarjeta" aria-label="Ahora">
        {tarea ? (
          <>
            <p className="pn-meta">Tarea en curso</p>
            <p className="pn-destacado">{tarea.texto}</p>
            <BarraAvance etiqueta="Avance de la tarea" porcentaje={Math.round(progresoTarea(tarea, ahora) * 100)} />
          </>
        ) : (
          <>
            <p className="pn-meta">Último resultado</p>
            <p className="pn-destacado">{estado.ultimo}</p>
          </>
        )}
      </section>
      <section aria-label="Darle una tarea">
        <h3 className="pn-subtitulo">Darle una tarea</h3>
        <ul className="pn-tareas">
          {TAREAS[agente.depto]().map((t) => (
            <li key={t.id}>
              <button type="button" className="pn-boton" disabled={tarea !== null} onClick={() => alAsignar(t)}>
                {t.texto}
              </button>
            </li>
          ))}
        </ul>
        {tarea && <p className="pn-meta">Espera a que termine para darle otra.</p>}
      </section>
      <p className="pn-meta">{estado.hechas === 0 ? 'Sin tareas terminadas hoy.' : `Tareas terminadas hoy: ${estado.hechas}.`}</p>
    </Hoja>
  );
}
