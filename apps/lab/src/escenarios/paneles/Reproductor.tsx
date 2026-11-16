import { useEffect, useRef, useState } from 'react';
import { BarraAvance } from './Hoja';
import { Portada } from './Portada';
import { formatoReloj } from './contenido';
import type { Tema } from './contenido';

/** Segundos de la demo por cada segundo real: el «video» de ejemplo corre a esta velocidad. */
const VELOCIDAD = 30;

/** Reproductor de ejemplo: no hay video real, la barra avanza sola. */
export function Reproductor({
  tema,
  semilla,
  duracion,
  titulo,
  alTerminar,
}: {
  tema: Tema;
  semilla: number;
  duracion: number;
  titulo: string;
  alTerminar?: () => void;
}) {
  const [segundos, setSegundos] = useState(0);
  const [corre, setCorre] = useState(false);
  const fin = useRef(alTerminar);
  fin.current = alTerminar;

  useEffect(() => {
    if (!corre) return;
    const id = setInterval(() => {
      setSegundos((s) => {
        const n = Math.min(duracion, s + VELOCIDAD / 4);
        if (n >= duracion) {
          setCorre(false);
          fin.current?.();
        }
        return n;
      });
    }, 250);
    return () => clearInterval(id);
  }, [corre, duracion]);

  const terminado = segundos >= duracion;
  return (
    <div className="pn-repro">
      <div className="pn-repro-imagen">
        <Portada tema={tema} semilla={semilla} className="pn-portada" />
        <button
          type="button"
          className="pn-repro-boton"
          aria-label={corre ? `Pausar ${titulo}` : `Reproducir ${titulo}`}
          onClick={() => {
            if (terminado) setSegundos(0);
            setCorre((c) => !c);
          }}
        >
          <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
            {corre ? (
              <path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor" />
            ) : (
              <path d="M7 4l9 6-9 6z" fill="currentColor" />
            )}
          </svg>
        </button>
      </div>
      <div className="pn-repro-pie">
        <BarraAvance etiqueta="Avance del video" porcentaje={Math.round((segundos / duracion) * 100)} />
        <span>
          {formatoReloj(segundos)} / {formatoReloj(duracion)}
        </span>
      </div>
    </div>
  );
}
