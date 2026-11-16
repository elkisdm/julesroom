import { useRef, useState } from 'react';
import type { AccionMomento } from './protocolo';
import { PARAMETROS_MOMENTOS } from './protocolo';

export function PanelMomentos({
  habilitado,
  atencion,
  emitir,
}: {
  habilitado: boolean;
  atencion: boolean;
  emitir: (accion: AccionMomento, opciones?: { minutos?: number; texto?: string }) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const disparador = useRef<HTMLButtonElement>(null);
  const cerrar = () => {
    setAbierto(false);
    disparador.current?.focus();
  };
  const [minutos, setMinutos] = useState('3');
  const [titulo, setTitulo] = useState('');
  const [bienvenida, setBienvenida] = useState('Bienvenidos a la sala');
  return (
    <aside
      className="d5-panel"
      aria-label="Momentos del anfitrión"
      onKeyDown={(e) => {
        if (e.key === 'Escape') cerrar();
      }}
    >
      <button
        className="cr-boton cr-boton--chico"
        ref={disparador}
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        Momentos
      </button>
      {abierto && (
        <section className="d5-controles">
          <div className="d5-cabecera">
            <h2>Un momento juntos</h2>
            <button
              className="cr-boton cr-boton--chico"
              aria-label="Cerrar momentos"
              onClick={cerrar}
            >
              ×
            </button>
          </div>
          {!habilitado && <p>Conecta como anfitrión para compartir un momento.</p>}
          <button
            className="cr-boton cr-boton--prim"
            disabled={!habilitado}
            onClick={() => {
              emitir('foto');
              cerrar();
            }}
          >
            Foto de grupo
          </button>
          <fieldset disabled={!habilitado}>
            <legend>Temporizador</legend>
            <label htmlFor="d5-titulo">Título opcional</label>
            <input
              id="d5-titulo"
              value={titulo}
              maxLength={PARAMETROS_MOMENTOS.textoMax}
              placeholder="Receso"
              onChange={(e) => setTitulo(e.target.value)}
            />
            <div className="d5-fila">
              {[1, 3, 5].map((n) => (
                <button
                  className="cr-boton cr-boton--chico"
                  aria-pressed={minutos === String(n)}
                  key={n}
                  onClick={() => setMinutos(String(n))}
                >
                  {n} min
                </button>
              ))}
            </div>
            <label htmlFor="d5-minutos">Minutos · de 1 a 60</label>
            <input
              id="d5-minutos"
              inputMode="numeric"
              value={minutos}
              maxLength={2}
              onChange={(e) => setMinutos(e.target.value.replace(/\D/g, ''))}
            />
            <button
              className="cr-boton cr-boton--chico"
              onClick={() => emitir('temporizador', { minutos: Number(minutos), texto: titulo })}
            >
              Iniciar temporizador
            </button>
          </fieldset>
          <div className="d5-fila">
            <button
              className="cr-boton cr-boton--chico"
              disabled={!habilitado}
              onClick={() => {
                emitir('celebrar');
                cerrar();
              }}
            >
              Celebrar
            </button>
            <button
              className="cr-boton cr-boton--chico"
              disabled={!habilitado}
              aria-pressed={atencion}
              onClick={() => emitir(atencion ? 'apagar' : 'atencion')}
            >
              {atencion ? 'Apagar foco' : 'Atención'}
            </button>
          </div>
          <label htmlFor="d5-bienvenida">Mensaje de bienvenida</label>
          <input
            id="d5-bienvenida"
            value={bienvenida}
            maxLength={PARAMETROS_MOMENTOS.textoMax}
            onChange={(e) => setBienvenida(e.target.value)}
          />
          <button
            className="cr-boton cr-boton--chico"
            disabled={!habilitado || !bienvenida.trim()}
            onClick={() => {
              emitir('bienvenida', { texto: bienvenida });
              cerrar();
            }}
          >
            Mostrar bienvenida
          </button>
        </section>
      )}
    </aside>
  );
}
