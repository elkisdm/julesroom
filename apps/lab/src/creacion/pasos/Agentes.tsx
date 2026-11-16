import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Proyector, SalaGuardada } from '@oficina/motor';
import { Ancla } from '../Ancla';
import { Tecla } from '../Tecla';
import { alternarAgente, indiceAgente, espacioHoja } from './estadoFlujo';
import { useTecladoFlujo } from './Flujo';
import './agentes.css';

export function Agentes({
  sala,
  elegidos,
  alElegir,
  alSeguir,
  alVolver,
  proyector,
}: {
  sala: SalaGuardada;
  elegidos: string[];
  alElegir: (ids: string[]) => void;
  alSeguir: () => void;
  alVolver: () => void;
  proyector: MutableRefObject<Proyector | null>;
}) {
  const lista = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const nodo = panel.current!;
    const raiz = nodo.closest<HTMLElement>('.cr')!;
    const medir = () =>
      raiz.style.setProperty(
        '--fl-hoja-agentes',
        `${espacioHoja(nodo.getBoundingClientRect().height)}px`,
      );
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    medir();
    return () => {
      observador.disconnect();
      raiz.style.removeProperty('--fl-hoja-agentes');
    };
  }, []);
  const agentes = sala.ocupantes.filter((o) => o.tipo === 'agente');
  const [abierta, setAbierta] = useState(false);
  useTecladoFlujo('agentes', alSeguir, alVolver);
  return (
    <div className="fl-agentes">
      {agentes.map((a) => (
        <Ancla key={a.id} proyector={proyector} objetivo={() => a.id}>
          <button
            className="fl-agente-etiqueta"
            aria-label={`${a.nombre}: ${a.rol}`}
            aria-pressed={elegidos.includes(a.id)}
            onClick={() => alElegir(alternarAgente(elegidos, a.id))}
          >
            <b>{a.nombre}</b>
            <span>{elegidos.includes(a.id) ? '✓ En tu sala' : '+ Invitar'}</span>
          </button>
        </Ancla>
      ))}
      <section
        ref={panel}
        className="fl-panel fl-agentes-panel"
        data-abierta={abierta}
        aria-label="Elige tus agentes"
      >
        <header>
          <div>
            <h2>¿Quién viene?</h2>
            <p>Elige quién entra contigo.</p>
          </div>
          <button
            className="fl-plegar"
            aria-expanded={abierta}
            aria-controls="fl-lista-agentes"
            onClick={() => setAbierta(!abierta)}
          >
            {abierta ? 'Menos −' : 'Ver equipo +'}
          </button>
        </header>
        <div className="fl-agentes-detalle" id="fl-lista-agentes">
          <div className="fl-seleccion">
            <button onClick={() => alElegir(agentes.map((a) => a.id))}>Todos</button>
            <button onClick={() => alElegir([])}>Ninguno</button>
          </div>
          <div
            ref={lista}
            className="fl-agentes-lista"
            role="group"
            aria-label="Agentes sugeridos"
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              e.stopPropagation();
              const botones = [...lista.current!.querySelectorAll('button')];
              const actual = botones.indexOf(document.activeElement as HTMLButtonElement);
              botones[indiceAgente(Math.max(0, actual), botones.length, e.key)]?.focus();
            }}
          >
            {agentes.map((a) => (
              <button
                key={a.id}
                aria-pressed={elegidos.includes(a.id)}
                onClick={() => alElegir(alternarAgente(elegidos, a.id))}
              >
                <span>
                  <b>{a.nombre}</b>
                  <small>{a.rol}</small>
                </span>
                <span aria-hidden="true">{elegidos.includes(a.id) ? '✓' : '+'}</span>
              </button>
            ))}
          </div>
        </div>
        <footer>
          <span role="status">
            {elegidos.length ? `${elegidos.length} contigo` : 'Entras por tu cuenta'}
          </span>
          <button className="cr-boton cr-boton--prim" onClick={alSeguir}>
            Seguir <Tecla>↵</Tecla>
          </button>
        </footer>
        <small className="fl-agentes-nota">Son agentes de ejemplo. Aún no responden.</small>
      </section>
    </div>
  );
}
