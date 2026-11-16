import { useGrabacion } from './useGrabacion';
import { Votacion } from './PanelVotacion';
import { useEffect, useRef, useState } from 'react';
import { useReacciones } from './useReacciones';
import { REACCIONES } from './reacciones';
import { D2, teclaD2 } from './modelo';
import { Ancla } from '../../Ancla';
import { useGrupo, type PropsGrupo } from './useGrupo';

export function Dinamica(props: PropsGrupo) {
  const g = useGrupo(props);
  const r = useReacciones();
  const grabacion = useGrabacion();
  const [reaccionesAbiertas, setReaccionesAbiertas] = useState(false);
  const reaccionar = useRef(r.reaccionar);
  reaccionar.current = r.reaccionar;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const accion = teclaD2(
        e.key,
        Boolean(el?.closest('input,textarea,[contenteditable="true"]')),
        e.ctrlKey || e.metaKey || e.altKey,
      );
      if (typeof accion === 'number' && !e.repeat) {
        e.preventDefault();
        void reaccionar.current(accion);
      }
    };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, []);
  const { dueno, fuente, invitado, yo } = g;
  if (!fuente || !dueno || !yo)
    return (
      <div className="d2-mundo">
        {grabacion.aviso && (
          <div className="d2-aviso-grabacion" role="status">
            Modo grabación · H o Esc para volver
          </div>
        )}
      </div>
    );
  const nombre = fuente.personas().find((p) => p.id === dueno)?.nombre ?? 'El anfitrión';
  return (
    <div className="d2-mundo">
      {grabacion.aviso && (
        <div className="d2-aviso-grabacion" role="status">
          Modo grabación · H o Esc para volver
        </div>
      )}
      <Ancla
        proyector={props.proyector}
        objetivo={() => {
          const p = props.proyector.current?.mundo(dueno);
          return p ? { ...p, y: p.y + D2.alturaAnfitrion } : null;
        }}
        className="d2-anfitrion"
      >
        <span>Anfitrión</span>
      </Ancla>
      {[...new Set([...r.visibles.keys(), ...r.manos])].map((id) => {
        const numero = r.visibles.get(id)?.numero;
        const reaccion = REACCIONES.find((x) => x.numero === numero);
        return (
          <Ancla
            key={id}
            proyector={props.proyector}
            objetivo={() => {
              const p = props.proyector.current?.mundo(id);
              return p ? { ...p, y: p.y + D2.alturaReaccion } : null;
            }}
            className="d2-reaccion"
          >
            <span>
              {r.manos.includes(id) && <span aria-label="Mano levantada">✋</span>}
              {reaccion && <span aria-label={reaccion.nombre}>{reaccion.icono}</span>}
            </span>
          </Ancla>
        );
      })}
      {r.festejo > 0 && (
        <div key={r.festejo} className="d2-fiesta" aria-label="Aplauso de grupo">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ left: `${8 + i * 7}%`, animationDelay: `${(i % 4) * 0.12}s` }}>
              👏
            </span>
          ))}
        </div>
      )}
      <div
        className="d2-reacciones"
        aria-label="Reacciones"
        title="H: ocultar interfaz para grabar"
        data-abierto={reaccionesAbiertas}
      >
        {/* Donde no cabe la fila completa, las reacciones se pliegan tras un botón; 1–5 siguen activas. */}
        <button
          className="cr-boton d2-reaccionar"
          aria-expanded={reaccionesAbiertas}
          onClick={() => setReaccionesAbiertas(!reaccionesAbiertas)}
        >
          Reaccionar
        </button>
        {REACCIONES.map((x) => (
          <button
            key={x.numero}
            className="cr-boton"
            aria-label={x.numero === 3 && r.manos.includes(yo) ? 'Bajar la mano' : x.nombre}
            aria-pressed={x.numero === 3 ? r.manos.includes(yo) : undefined}
            onClick={() => void r.reaccionar(x.numero)}
          >
            <span aria-hidden="true">{x.icono}</span>
            <kbd>{x.numero}</kbd>
          </button>
        ))}
        {r.error && <p role="alert">{r.error}</p>}
      </div>
      <Votacion props={props} invitado={invitado} />
      <div className="d2-controles">
        {!invitado && (
          <div className="d2-acciones">
            <button className="cr-boton cr-boton--chico" onClick={() => void g.reunir(false)}>
              Reunir aquí
            </button>
            <button
              className="cr-boton cr-boton--chico"
              aria-pressed={g.dirigiendo}
              onClick={() => void (g.dirigiendo ? g.parar() : g.reunir(true))}
            >
              {g.dirigiendo ? 'Dejar de guiar' : 'Sígueme'}
            </button>
          </div>
        )}
        {g.siguiendo && (
          <button className="cr-boton cr-boton--chico" onClick={g.soltar}>
            Siguiendo a {nombre} · Soltarme
          </button>
        )}
        {g.aviso && <p role="status">{g.aviso}</p>}
        {!invitado && r.manos.length > 0 && (
          <div className="d2-manos">
            <strong>Manos levantadas · {r.manos.length}</strong>
            <ol>
              {r.manos.map((id) => (
                <li key={id}>
                  {id === yo
                    ? props.sala.ocupantes.find((p) => p.id === 'yo')?.nombre
                    : fuente.personas().find((p) => p.id === id)?.nombre}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {g.llamada && (
        <div className="d2-invitacion" role="region" aria-label="Invitación del anfitrión">
          <strong>{nombre} te llama</strong>
          <p>
            {g.llamada.seguir ? 'Ven y sigue al grupo.' : 'Reúnete con el grupo.'} Irás en{' '}
            {g.segundos} s.
          </p>
          <button className="cr-boton cr-boton--prim" onClick={() => g.elegir(true)}>
            Ir
          </button>
          <button className="cr-boton" onClick={() => g.elegir(false)}>
            Quedarme
          </button>
        </div>
      )}
    </div>
  );
}
