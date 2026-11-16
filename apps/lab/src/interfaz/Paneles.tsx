import { useState } from 'react';
import {
  Boton,
  Campo,
  Conmutador,
  Deslizador,
  Estado,
  Fila,
  Insignia,
  Progreso,
  Segmentado,
  Selector,
  Tecla,
} from './componentes';
import { Icono } from './iconos';
import type { NombreIcono } from './iconos';
import { PERSONAS } from './escenaDemo';
import type { AmbienteDemo } from './Escena';
import { prepararMensaje } from './interaccion';

const OBJETOS: { nombre: string; icono: NombreIcono; tipo: string }[] = [
  { nombre: 'Silla de trabajo', icono: 'sentarse', tipo: 'Asientos' },
  { nombre: 'Mesa compartida', icono: 'mesa', tipo: 'Mesas' },
  { nombre: 'Planta de interior', icono: 'planta', tipo: 'Objetos' },
  { nombre: 'Lámpara de pie', icono: 'lampara', tipo: 'Objetos' },
];
function MiniaturaObjeto({ tipo }: { tipo: NombreIcono }) {
  return (
    <svg className="jr-miniatura" viewBox="0 0 160 100" aria-hidden="true">
      {tipo === 'sentarse' && (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="m57 53 27-11 28 13-27 12Z" fill="var(--gris-07)" />
          <path d="m57 53-3-35 28-9 2 33Z" fill="var(--gris-10)" />
          <path d="m54 18 4 3 28-9-4-3Z" fill="var(--gris-12)" />
          <path d="m85 67 1 17m0-1-18 8m18-8 19 8m-19-8 5-9" fill="none" strokeWidth="3" />
          <path d="m61 53 1 20m47-17v19" fill="none" strokeWidth="3" />
        </g>
      )}
      {tipo === 'mesa' && (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="m28 45 63-26 42 22-63 27Z" fill="var(--gris-10)" />
          <path d="m28 45 42 23v5L28 50Zm42 23 63-27v5L70 73Z" fill="var(--gris-07)" />
          <path d="M34 52v27m39-8v21m52-45v27m-36-50v30" fill="none" strokeWidth="4" />
        </g>
      )}
      {tipo === 'planta' && (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="m64 63 6 25q12 9 24 0l6-25Z" fill="var(--gris-07)" />
          <ellipse cx="82" cy="63" rx="18" ry="7" fill="var(--gris-09)" />
          <path d="M82 63V28m0 20L62 37m20 4 20-20" fill="none" strokeWidth="2" />
          <path
            d="M82 37C61 42 48 23 52 18c20 0 28 8 30 19Zm0-2c-4-22 8-28 14-27 6 14 2 23-14 27Zm5 6c9-25 23-27 30-19-1 16-14 20-30 19Z"
            fill="var(--gris-10)"
          />
        </g>
      )}
      {tipo === 'lampara' && (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <ellipse cx="81" cy="87" rx="23" ry="7" fill="var(--gris-07)" />
          <path d="M81 86V33" strokeWidth="3" />
          <path d="m65 14-14 27q28 15 59 0L96 14Z" fill="var(--gris-10)" />
          <ellipse cx="80" cy="14" rx="15" ry="5" fill="var(--gris-12)" />
        </g>
      )}
    </svg>
  );
}

export function PanelConstruirDemo({
  objetos,
  alAgregar,
  alDeshacer,
}: {
  objetos: string[];
  alAgregar: (nombre: string) => void;
  alDeshacer: () => void;
}) {
  const [tab, setTab] = useState('catalogo');
  const [busqueda, buscar] = useState('');
  const [categoria, elegir] = useState('Todos');
  const lista = OBJETOS.filter(
    (o) =>
      (categoria === 'Todos' || o.tipo === categoria) &&
      o.nombre.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase()),
  );
  return (
    <>
      <Segmentado
        etiqueta="Contenido de construcción"
        opciones={[
          { valor: 'catalogo', etiqueta: 'Catálogo' },
          { valor: 'colocados', etiqueta: 'En la sala' },
        ]}
        valor={tab}
        alCambiar={setTab}
        tipo="pestanas"
        idPanel="panel-construccion"
      />
      <div
        role="tabpanel"
        id="panel-construccion"
        aria-labelledby={`panel-construccion-${tab}`}
        className="jr-apilado"
      >
        {tab === 'catalogo' ? (
          <>
            <div className="jr-construir-filtros">
              <Campo
                etiqueta="Buscar mobiliario"
                placeholder="Sillas, mesas, objetos…"
                icono="buscar"
                value={busqueda}
                onChange={(e) => buscar(e.target.value)}
              />
              <Selector
                etiqueta="Categoría"
                opciones={['Todos', 'Asientos', 'Mesas', 'Objetos'].map((x) => ({
                  valor: x,
                  etiqueta: x,
                }))}
                valor={categoria}
                alCambiar={elegir}
              />
            </div>
            <div className="jr-catalogo">
              {lista.map((o) => (
                <button
                  type="button"
                  key={o.nombre}
                  className="jr-objeto"
                  onClick={() => alAgregar(o.nombre)}
                >
                  <MiniaturaObjeto tipo={o.icono} />
                  <span>{o.nombre}</span>
                  <Icono nombre="mas" />
                </button>
              ))}
            </div>
            {!lista.length && (
              <p className="jr-nota">No hay objetos con ese nombre. Prueba con «silla».</p>
            )}
            <p className="jr-nota">Elige una pieza para añadirla a tu boceto.</p>
          </>
        ) : (
          <>
            <p className="jr-nota">Boceto local · no modifica el mundo.</p>
            {objetos.length ? (
              objetos.map((o, i) => (
                <Fila key={`${i}-${o}`} icono="construir" titulo={o} detalle={`Pieza ${i + 1}`} />
              ))
            ) : (
              <p>Aún no hay piezas. Elige una en el catálogo.</p>
            )}
          </>
        )}
      </div>
      <div className="jr-panel-pie">
        <div className="jr-en-linea jr-entre">
          <small>{objetos.length} piezas en el boceto</small>
          <Boton
            icono="deshacer"
            jerarquia="terciario"
            disabled={!objetos.length}
            onClick={alDeshacer}
          >
            Deshacer
          </Boton>
        </div>
      </div>
    </>
  );
}

export function PanelPersonas({
  alInvitar,
  alConversar,
}: {
  alInvitar: () => void;
  alConversar: (nombre: string) => void;
}) {
  const [busqueda, buscar] = useState('');
  const lista = PERSONAS.filter((p) =>
    p.nombre.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase()),
  );
  return (
    <>
      <Campo
        etiqueta="Buscar en esta sala"
        icono="buscar"
        placeholder="Nombre de una persona"
        value={busqueda}
        onChange={(e) => buscar(e.target.value)}
      />
      <div className="jr-lista-personas">
        <Fila iniciales="TÚ" titulo="Tú" detalle="Anfitrión" estado="En la sala" />
        {lista.map((p) => (
          <Fila
            key={p.id}
            iniciales={p.iniciales}
            titulo={p.nombre}
            detalle={p.detalle}
            estado="En la sala"
            onClick={() => alConversar(p.nombre)}
          />
        ))}
        {!lista.length && <p className="jr-nota">No encontramos a esa persona.</p>}
      </div>
      <div className="jr-panel-pie jr-apilado">
        <Boton jerarquia="primario" icono="enlace" onClick={alInvitar}>
          Invitar a alguien
        </Boton>
        <p className="jr-nota">Las personas de esta sala son de ejemplo.</p>
      </div>
    </>
  );
}

export interface MensajeDemo {
  autor: string;
  texto: string;
}
export function PanelConversacion({
  mensajes,
  alEnviar,
  destinatario,
  texto,
  alTexto,
}: {
  mensajes: MensajeDemo[];
  alEnviar: (texto: string) => void;
  destinatario: string;
  texto: string;
  alTexto: (texto: string) => void;
}) {
  const [canal, setCanal] = useState('sala');
  return (
    <>
      <Segmentado
        etiqueta="Canal de conversación"
        opciones={[
          { valor: 'sala', etiqueta: 'Sala' },
          { valor: 'jules', etiqueta: 'Jules', icono: 'conversacion' },
        ]}
        valor={canal}
        alCambiar={setCanal}
        tipo="pestanas"
        idPanel="canal-conversacion"
      />
      <div
        role="tabpanel"
        id="canal-conversacion"
        aria-labelledby={`canal-conversacion-${canal}`}
        className="jr-apilado"
      >
        <div className="jr-chat-cabecera">
          <Estado>
            {canal === 'jules'
              ? 'Asistente de ejemplo'
              : destinatario
                ? `Para ${destinatario}`
                : 'Conversación de la sala'}
          </Estado>
        </div>
        <div className="jr-mensajes" role="log" aria-label="Mensajes" aria-live="polite">
          {canal === 'jules' && (
            <article>
              <strong>Jules</strong>
              <p>Puedo ayudarte a preparar tu sala. Esta conversación es una demostración local.</p>
            </article>
          )}
          {mensajes.map((m, i) => (
            <article key={i} data-propio={m.autor === 'Tú'}>
              <strong>{m.autor}</strong>
              <p>{m.texto}</p>
            </article>
          ))}
        </div>
        <form
          className="jr-compositor"
          onSubmit={(e) => {
            e.preventDefault();
            const limpio = prepararMensaje(texto);
            if (limpio) {
              alEnviar(limpio);
              alTexto('');
            }
          }}
        >
          <Campo
            etiqueta={canal === 'jules' ? 'Mensaje para Jules' : 'Tu mensaje'}
            placeholder="Escribe algo…"
            value={texto}
            maxLength={500}
            onChange={(e) => alTexto(e.target.value)}
          />
          <Boton type="submit" jerarquia="primario" icono="enviar" disabled={!texto.trim()}>
            Enviar
          </Boton>
        </form>
        <p className="jr-nota">
          Solo se muestra aquí. <Tecla>Enter</Tecla> para enviar.
        </p>
      </div>
    </>
  );
}

export function PanelPresentar({
  alPresentar,
  alGrabar,
}: {
  alPresentar: () => void;
  alGrabar: () => void;
}) {
  const [destino, setDestino] = useState('sala');
  return (
    <>
      <div className="jr-presentacion-preview">
        <span>Jules Room</span>
        <strong>
          Un lugar para
          <br />
          pensar juntos.
        </strong>
        <span>Estudio Norte · Encuentro del equipo</span>
      </div>
      <Selector
        etiqueta="Dónde presentar"
        opciones={[
          { valor: 'sala', etiqueta: 'Pantalla de la sala' },
          { valor: 'personal', etiqueta: 'Solo en mi vista' },
        ]}
        valor={destino}
        alCambiar={setDestino}
      />
      <p className="jr-nota">Encuadra la sala y despeja los controles. No comparte tu pantalla.</p>
      <Boton jerarquia="primario" icono="presentar" onClick={alPresentar}>
        Iniciar presentación
      </Boton>
      <div className="jr-panel-pie jr-apilado">
        <h3>Una vista sin distracciones</h3>
        <p className="jr-nota">
          Oculta los paneles para capturar el mundo con tu herramienta de grabación.
        </p>
        <Boton icono="grabar" onClick={alGrabar}>
          Vista para grabar
        </Boton>
      </div>
    </>
  );
}

export function PanelAjustes({
  tema,
  alTema,
  ambiente,
  alAmbiente,
}: {
  tema: 'oscuro' | 'claro';
  alTema: (v: 'oscuro' | 'claro') => void;
  ambiente: AmbienteDemo;
  alAmbiente: (a: AmbienteDemo) => void;
}) {
  const [volumen, setVolumen] = useState(60);
  const [nombres, setNombres] = useState(true);
  return (
    <>
      <h3>Apariencia</h3>
      <Segmentado
        etiqueta="Tema de interfaz"
        opciones={[
          { valor: 'oscuro', etiqueta: 'Oscuro', icono: 'luna' },
          { valor: 'claro', etiqueta: 'Claro', icono: 'sol' },
        ]}
        valor={tema}
        alCambiar={(v) => alTema(v as 'oscuro' | 'claro')}
      />
      <Selector
        etiqueta="Ambiente del prototipo"
        opciones={[
          { valor: 'dia', etiqueta: 'Oficina · de día' },
          { valor: 'noche', etiqueta: 'Sala · de noche' },
        ]}
        valor={ambiente}
        alCambiar={(v) => alAmbiente(v as AmbienteDemo)}
      />
      <hr className="jr-divisor" />
      <h3>Preferencias de ejemplo</h3>
      <Deslizador etiqueta="Volumen de la sala" valor={volumen} alCambiar={setVolumen} />
      <Conmutador
        etiqueta="Mostrar nombres"
        descripcion="Preferencia para la futura integración"
        activo={nombres}
        alCambiar={setNombres}
      />
      <Conmutador
        etiqueta="Sonido del micrófono"
        descripcion="No se solicita acceso en este prototipo"
        activo={false}
        alCambiar={() => undefined}
        deshabilitado
      />
      <div className="jr-panel-pie jr-apilado">
        <Progreso etiqueta="Preparación de la sala" valor={100} />
        <Insignia>Prototipo local · AF</Insignia>
      </div>
    </>
  );
}
