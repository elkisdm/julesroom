import { useRef, useState } from 'react';
import { Ancla } from '../../Ancla';
import { COLORES_D2 } from '@oficina/motor';
import { resultadoVotos, VOTO } from './votacion';
import { useVotacion } from './useVotacion';
import type { PropsGrupo } from './useGrupo';
export function Votacion({ props, invitado }: { props: PropsGrupo; invitado: boolean }) {
  const v = useVotacion(props);
  const [pregunta, setPregunta] = useState('');
  const [opciones, setOpciones] = useState(['', '']);
  const panel = useRef<HTMLDetailsElement>(null);
  const p = v.votacion;
  const ganadores = p?.cerrada ? resultadoVotos(p.conteos) : [];
  return (
    <>
      {!invitado && (
        <details ref={panel} className="d2-panel-voto">
          <summary>Votar con los pies</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void v.lanzar(pregunta, opciones).then((ok) => {
                if (ok && panel.current) panel.current.open = false;
              });
            }}
          >
            <label htmlFor="d2-pregunta">Tu pregunta</label>
            <input
              id="d2-pregunta"
              value={pregunta}
              maxLength={VOTO.maxTexto}
              required
              onChange={(e) => setPregunta(e.target.value)}
              placeholder="¿Qué quieres explorar?"
            />
            {opciones.map((o, i) => (
              <label key={i} htmlFor={`d2-opcion-${i}`}>
                Opción {i + 1}
                <input
                  id={`d2-opcion-${i}`}
                  value={o}
                  maxLength={VOTO.maxRotulo}
                  required
                  onChange={(e) =>
                    setOpciones(opciones.map((x, k) => (k === i ? e.target.value : x)))
                  }
                />
              </label>
            ))}
            <div className="d2-acciones">
              {opciones.length < 4 && (
                <button
                  type="button"
                  className="cr-boton cr-boton--chico"
                  onClick={() => setOpciones([...opciones, ''])}
                >
                  Añadir opción
                </button>
              )}
              {opciones.length > 2 && (
                <button
                  type="button"
                  className="cr-boton cr-boton--chico"
                  onClick={() => setOpciones(opciones.slice(0, -1))}
                >
                  Quitar última
                </button>
              )}
            </div>
            <button
              className="cr-boton cr-boton--prim cr-boton--chico"
              type="submit"
              disabled={Boolean(p && !p.cerrada)}
            >
              Lanzar pregunta
            </button>
            {p && !p.cerrada && (
              <button
                className="cr-boton cr-boton--chico"
                type="button"
                onClick={() => void v.cerrar()}
              >
                Cerrar votación
              </button>
            )}
            {v.error && <p role="alert">{v.error}</p>}
          </form>
        </details>
      )}
      {p && (
        <>
          <div className="d2-pregunta" role="status">
            <strong>{p.pregunta}</strong>
            <span>
              {p.cerrada
                ? ganadores.length === 0
                  ? 'Sin votos'
                  : ganadores.length > 1
                    ? 'Empate'
                    : `Ganó: ${p.opciones[ganadores[0]!]!.rotulo}`
                : 'Camina a una zona para votar'}
            </span>
            {!invitado && !p.cerrada && (
              <button className="cr-boton cr-boton--chico" onClick={() => void v.cerrar()}>
                Cerrar votación
              </button>
            )}
          </div>
          {p.opciones.map((z, i) => (
            <Ancla
              key={`${p.id}-${i}`}
              proyector={props.proyector}
              objetivo={() => ({ ...z, y: z.y + 0.15 })}
              className="d2-zona"
            >
              <div
                data-d2-zona={i}
                data-x={z.x}
                data-z={z.z}
                style={{ borderColor: COLORES_D2[i] }}
                className={p.cerrada && ganadores.includes(i) ? 'd2-zona-ganadora' : undefined}
              >
                <strong>
                  {p.cerrada && ganadores.includes(i) ? '✓ ' : ''}
                  {z.rotulo}
                </strong>
                <span>
                  {p.conteos[i]} {p.conteos[i] === 1 ? 'persona' : 'personas'}
                </span>
              </div>
            </Ancla>
          ))}
        </>
      )}
    </>
  );
}
