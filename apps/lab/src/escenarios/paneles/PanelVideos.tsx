import { useState } from 'react';
import { VIDEOS, fechaCorta, formatoDuracion } from './contenido';
import { Hoja } from './Hoja';
import { Portada } from './Portada';
import { Reproductor } from './Reproductor';
import type { PropsHoja } from './tipos';

/** La videoteca abierta desde su quiosco: elige un video y se reproduce aquí mismo. */
export function PanelVideos(hoja: PropsHoja) {
  const [id, setId] = useState(VIDEOS[0]!.id);
  const actual = VIDEOS.find((v) => v.id === id) ?? VIDEOS[0]!;
  return (
    <Hoja
      titulo="Videoteca"
      bajada="Sesiones grabadas y análisis cortos de ejemplo. Elige uno y míralo sin salir de la sala."
      {...hoja}
    >
      <Reproductor
        key={actual.id}
        tema={actual.tema}
        semilla={actual.semilla}
        duracion={actual.duracion}
        titulo={actual.titulo}
      />
      <h3 className="pn-subtitulo">{actual.titulo}</h3>
      <p className="pn-meta">
        {actual.tipo} · {actual.mercado} · {fechaCorta(actual.fecha)} · {formatoDuracion(actual.duracion)}
      </p>
      <p className="pn-nota">{actual.resumen}</p>
      <ul className="pn-videos" aria-label="Videos">
        {VIDEOS.map((v) => (
          <li key={v.id}>
            <button type="button" aria-current={v.id === actual.id} onClick={() => setId(v.id)}>
              <Portada tema={v.tema} semilla={v.semilla} className="pn-miniatura" />
              <span className="pn-video-titulo">{v.titulo}</span>
              <span className="pn-meta">{formatoDuracion(v.duracion)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Hoja>
  );
}
