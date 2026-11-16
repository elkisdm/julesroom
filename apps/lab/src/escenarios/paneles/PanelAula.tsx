import { useState } from 'react';
import { Selector } from '../Selector';
import { avanceClase } from './clase';
import type { Clase, DetalleClase } from './clase';
import { CURSOS, formatoDuracion, formatoReloj, lecciones } from './contenido';
import { BarraAvance, Hoja } from './Hoja';
import { Reproductor } from './Reproductor';
import type { PropsHoja } from './tipos';

/**
 * El aula desde la sala: qué se proyecta ahora y los cursos para tomar sin salir. Cada quien marca su
 * lección como vista; el dueño, además, la expone en la pantalla del aula.
 */
export function PanelAula({
  clase,
  detalle,
  ahora,
  vistas,
  alAlternarVista,
  alExponer,
  ...hoja
}: {
  clase: Clase;
  detalle: DetalleClase;
  ahora: number;
  /** Ids de lecciones vistas por curso. */
  vistas: Record<string, string[]>;
  alAlternarVista: (cursoId: string, leccionId: string) => void;
  alExponer: (cursoId: string, leccionId: string) => void;
} & PropsHoja) {
  const [cursoId, setCursoId] = useState(detalle.curso.id);
  const curso = CURSOS.find((c) => c.id === cursoId) ?? CURSOS[0]!;
  const todas = lecciones(curso);
  const [leccionId, setLeccionId] = useState(detalle.leccion.id);
  const leccion = todas.find((l) => l.id === leccionId) ?? todas[0]!;
  const hechas = vistas[curso.id] ?? [];
  const vista = hechas.includes(leccion.id);
  const enPantalla = clase.cursoId === curso.id && clase.leccionId === leccion.id;
  const avance = avanceClase(clase, ahora);

  return (
    <Hoja
      titulo="Aula"
      bajada="La clase se proyecta para todos en la pantalla del aula. Los cursos los tomas aquí."
      {...hoja}
    >
      <section className="pn-tarjeta" aria-label="En la pantalla del aula">
        <p className="pn-meta">En la pantalla · expone {clase.expositor}</p>
        <p className="pn-destacado">{detalle.leccion.titulo}</p>
        <p className="pn-meta">
          {detalle.curso.titulo} · lección {detalle.numero} de {detalle.total}
        </p>
        <div className="pn-avance">
          <BarraAvance etiqueta="Avance de la clase" porcentaje={Math.round(avance * 100)} />
          <span className="pn-meta">
            {formatoReloj(detalle.leccion.duracion * avance)} / {formatoReloj(detalle.leccion.duracion)}
          </span>
        </div>
      </section>

      <Selector
        etiqueta="Curso"
        className="sel-ancho"
        valor={curso.id}
        opciones={CURSOS.map((c) => ({ valor: c.id, etiqueta: c.titulo, descripcion: c.nivel }))}
        alCambiar={(id) => {
          setCursoId(id);
          setLeccionId(CURSOS.find((c) => c.id === id)!.lecciones[0]!.id);
        }}
      />
      <ol className="pn-lecciones" aria-label="Lecciones del curso">
        {todas.map((l, i) => (
          <li key={l.id}>
            <button type="button" aria-current={l.id === leccion.id} onClick={() => setLeccionId(l.id)}>
              <span className="pn-visto" aria-label={hechas.includes(l.id) ? 'Vista' : 'Pendiente'}>
                {hechas.includes(l.id) ? '✓' : ''}
              </span>
              <span className="pn-leccion-titulo">
                {i + 1}. {l.titulo}
              </span>
              <span className="pn-meta">{formatoDuracion(l.duracion)}</span>
            </button>
          </li>
        ))}
      </ol>
      <Reproductor
        key={`${curso.id}/${leccion.id}`}
        tema={curso.tema}
        semilla={todas.indexOf(leccion) + 11}
        duracion={leccion.duracion}
        titulo={leccion.titulo}
        alTerminar={() => !vista && alAlternarVista(curso.id, leccion.id)}
      />
      <h3 className="pn-subtitulo">{leccion.titulo}</h3>
      <p className="pn-nota">{leccion.resumen}</p>
      <div className="pn-fila">
        <button
          type="button"
          className="pn-boton"
          data-principal={!vista || undefined}
          aria-pressed={vista}
          onClick={() => alAlternarVista(curso.id, leccion.id)}
        >
          {vista ? 'Vista' : 'Marcar como vista'}
        </button>
        <button
          type="button"
          className="pn-boton"
          disabled={enPantalla}
          onClick={() => alExponer(curso.id, leccion.id)}
        >
          {enPantalla ? 'En la pantalla' : 'Exponer en el aula'}
        </button>
      </div>
    </Hoja>
  );
}
