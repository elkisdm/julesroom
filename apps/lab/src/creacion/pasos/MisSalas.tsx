import { useEffect, useRef, useState } from 'react';
import { PARAMETROS_BIBLIOTECA, type ResumenSala } from '@oficina/motor';
import { fechaRelativa, moverSala } from './biblioteca';
import './mis-salas.css';

export function MisSalas({
  salas,
  miniaturas,
  error,
  alCerrar,
  alAbrir,
  alRenombrar,
  alEliminar,
}: {
  salas: ResumenSala[];
  miniaturas: Record<string, string>;
  error: string;
  alCerrar: () => void;
  alAbrir: (id: string) => void;
  alRenombrar: (id: string, nombre: string) => boolean;
  alEliminar: (id: string) => boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const [editar, setEditar] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [quitar, setQuitar] = useState<ResumenSala | null>(null);
  const [mensaje, setMensaje] = useState('');
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const nodo = dialogo.current;
    nodo?.showModal();
    lista.current?.querySelector<HTMLButtonElement>('[data-sala]')?.focus();
    return () => {
      nodo?.close();
      anterior?.focus({ preventScroll: true });
    };
  }, []);
  const restaurar = (id: string) =>
    requestAnimationFrame(() => {
      const botones = lista.current?.querySelectorAll<HTMLButtonElement>('[data-sala]');
      const destino = Array.from(botones ?? []).find((b) => b.dataset.sala === id) ?? botones?.[0];
      (destino ?? dialogo.current?.querySelector<HTMLButtonElement>('button'))?.focus();
    });
  return (
    <dialog
      ref={dialogo}
      className="ms-dialogo"
      aria-labelledby="ms-titulo"
      onCancel={(e) => {
        e.preventDefault();
        if (quitar) {
          restaurar(quitar.id);
          setQuitar(null);
        } else if (editar) {
          restaurar(editar);
          setEditar(null);
        } else alCerrar();
      }}
    >
      <header className="ms-cabecera">
        <div>
          <h2 id="ms-titulo">Mis salas</h2>
          <p>Guardadas en este navegador</p>
        </div>
        <button
          className="cr-boton cr-boton--chico"
          onClick={alCerrar}
          aria-label="Cerrar Mis salas"
        >
          ×
        </button>
      </header>
      {quitar ? (
        <section className="ms-confirmacion" role="alertdialog" aria-labelledby="ms-quitar">
          <h3 id="ms-quitar">¿Eliminar {quitar.nombre}?</h3>
          <p>Se borrará de este navegador. Las demás salas se conservan.</p>
          <div className="ms-acciones">
            <button
              className="cr-boton"
              autoFocus
              onClick={() => {
                restaurar(quitar.id);
                setQuitar(null);
              }}
            >
              Conservar sala
            </button>
            <button
              className="cr-boton ms-eliminar"
              onClick={() => {
                if (alEliminar(quitar.id)) {
                  restaurar(quitar.id);
                  setQuitar(null);
                }
              }}
            >
              Eliminar sala
            </button>
          </div>
        </section>
      ) : (
        <div
          className="ms-lista"
          ref={lista}
          onKeyDown={(e) => {
            if (editar || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key))
              return;
            e.preventDefault();
            const botones = Array.from(
              lista.current?.querySelectorAll<HTMLButtonElement>('[data-sala]') ?? [],
            );
            const fila = (e.target as HTMLElement).closest('[data-fila]');
            const actual = botones.findIndex((b) => b.closest('[data-fila]') === fila);
            botones[moverSala(actual, botones.length, e.key)]?.focus();
          }}
        >
          {salas.length === 0 && (
            <p className="ms-vacio">
              Aún no tienes salas guardadas. Vuelve a la portada para crear una.
            </p>
          )}
          {salas.map((s) => (
            <article className="ms-sala" data-fila={s.id} key={s.id}>
              <button
                className="ms-entrar"
                data-sala={s.id}
                onClick={() => alAbrir(s.id)}
                aria-label={`Entrar a ${s.nombre}`}
              >
                <span className="ms-miniatura">
                  {(s.miniatura ?? miniaturas[s.plantilla]) ? (
                    <img src={s.miniatura ?? miniaturas[s.plantilla]} alt="" />
                  ) : (
                    <MiniaturaMundo mundo={s.plantilla} />
                  )}
                </span>
                <span className="ms-datos">
                  <strong>{s.nombre}</strong>
                  <span>Último uso: {fechaRelativa(s.ultimoUso)}</span>
                  <span className="ms-entrar-texto">
                    Entrar <span aria-hidden="true">↗</span>
                  </span>
                </span>
              </button>
              {editar === s.id ? (
                <form
                  className="ms-editar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!nombre.trim()) {
                      setMensaje('Escribe un nombre para tu sala.');
                      return;
                    }
                    if (alRenombrar(s.id, nombre)) {
                      setEditar(null);
                      setMensaje('');
                      restaurar(s.id);
                    }
                  }}
                >
                  <label htmlFor="ms-nombre">Nombre de la sala</label>
                  <input
                    id="ms-nombre"
                    autoFocus
                    value={nombre}
                    maxLength={PARAMETROS_BIBLIOTECA.nombreMaximo}
                    onChange={(e) => setNombre(e.target.value)}
                    aria-describedby="ms-error"
                    aria-invalid={Boolean(mensaje)}
                  />
                  <div className="ms-acciones">
                    <button className="cr-boton cr-boton--chico" type="submit">
                      Guardar nombre
                    </button>
                    <button
                      className="cr-boton cr-boton--chico"
                      type="button"
                      onClick={() => {
                        setEditar(null);
                        restaurar(s.id);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="ms-acciones ms-gestionar">
                  <button
                    className="cr-boton cr-boton--chico"
                    onClick={() => {
                      setEditar(s.id);
                      setNombre(s.nombre);
                      setMensaje('');
                    }}
                  >
                    Renombrar<span className="ms-solo-lector"> {s.nombre}</span>
                  </button>
                  <button className="cr-boton cr-boton--chico" onClick={() => setQuitar(s)}>
                    Eliminar<span className="ms-solo-lector"> {s.nombre}</span>
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <p id="ms-error" className="ms-error" role="alert">
        {mensaje || error}
      </p>
    </dialog>
  );
}

/** Vista isométrica editorial mientras no hay una captura del mundo en esta sesión. */
function MiniaturaMundo({ mundo }: { mundo: string }) {
  const bloques = mundo === 'mansion' ? [0, 1, 2, 3] : mundo === 'oficina' ? [0, 1, 2] : [0, 1];
  return (
    <svg viewBox="0 0 180 110" aria-hidden="true" className={`ms-mundo ms-mundo--${mundo}`}>
      <path className="ms-planta" d="M15 65 88 20 165 62 91 105Z" />
      <path className="ms-pared" d="M15 65V35L88 0v20Z" />
      <path className="ms-pared ms-pared--luz" d="M88 0 165 42v20L88 20Z" />
      {bloques.map((i) => (
        <g key={i} transform={`translate(${40 + i * 23} ${55 - i * 4})`}>
          <path className="ms-mesa" d="M0 0 18-10 35 0 17 10Z" />
          <path className="ms-pata" d="M0 0v10l17 10V10Z" />
        </g>
      ))}
    </svg>
  );
}
