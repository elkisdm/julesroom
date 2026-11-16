import { useState } from 'react';
import {
  Aviso,
  Boton,
  BotonIcono,
  Campo,
  Cargando,
  Conmutador,
  Deslizador,
  Dialogo,
  Estado,
  Fila,
  Insignia,
  Loseta,
  Menu,
  Progreso,
  Segmentado,
  Selector,
  Tecla,
} from './componentes';
import { ICONOS, Icono } from './iconos';

const OPCIONES = [
  { valor: 'equipo', etiqueta: 'Equipo' },
  { valor: 'invitados', etiqueta: 'Invitados' },
  { valor: 'privada', etiqueta: 'Solo yo' },
];
const ESTADOS = [
  'Reposo',
  'Hover',
  'Presionado',
  'Foco visible',
  'Activo',
  'Deshabilitado',
  'Cargando',
];
export function Galeria() {
  const [activo, setActivo] = useState(true);
  const [valor, setValor] = useState('equipo');
  const [tab, setTab] = useState('uno');
  const [volumen, setVolumen] = useState(60);
  const [dialogo, abrir] = useState<'dialogo' | 'hoja' | null>(null);
  const [aviso, setAviso] = useState('Todo está guardado en este boceto.');
  return (
    <main className="jr-galeria">
      <header className="jr-galeria-portada">
        <span className="jr-nota">Jules Room / Sistema de interfaz / 01</span>
        <h1>Espacio para estar.</h1>
        <p>
          Una gramática tranquila para un mundo en movimiento.
          <br />
          La superficie ordena. El contenido aporta el color.
        </p>
        <nav aria-label="Secciones del sistema">
          <a href="#fundamentos">Fundamentos</a>
          <a href="#componentes">Componentes</a>
          <a href="#estados">Estados</a>
          <a href="#comportamiento">Comportamiento</a>
        </nav>
      </header>
      <section id="fundamentos" className="jr-galeria-seccion">
        <div className="jr-seccion-intro">
          <span>01</span>
          <h2>Fundamentos</h2>
          <p>Doce grises, tres superficies. La profundidad se construye por proximidad de tonos.</p>
        </div>
        <div className="jr-galeria-contenido">
          <div className="jr-grises">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i}>
                <span style={{ background: `var(--gris-${String(i + 1).padStart(2, '0')})` }} />
                <small>{String(i + 1).padStart(2, '0')}</small>
              </div>
            ))}
          </div>
          <div className="jr-superficies">
            {[0, 1, 2].map((n) => (
              <div key={n} style={{ background: `var(--superficie-${n})` }}>
                <span>Superficie {n}</span>
                <small>{['Contexto', 'Panel', 'Control'][n]}</small>
              </div>
            ))}
          </div>
          <div className="jr-tipografia">
            <p className="jr-tipo-grande">Aa · Figtree</p>
            <p>Una sala, muchas maneras de encontrarse.</p>
            <span>400 Regular · 500 Medio · 600 Semibold</span>
            <small>Variable local · texto 15/22 · filas 16/24 · títulos 20/26</small>
          </div>
          <div className="jr-en-linea jr-radios">
            {[8, 12, 16].map((r) => (
              <div key={r} style={{ borderRadius: r }}>
                <strong>{r}</strong>
                <small>px</small>
              </div>
            ))}
            <p>
              Control / grupo / panel
              <br />
              <small>Espacios: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48</small>
            </p>
          </div>
          <div className="jr-iconos-muestra">
            {ICONOS.map((nombre) => (
              <div key={nombre} title={nombre}>
                <Icono nombre={nombre} />
                <Icono nombre={nombre} activo />
                <small>{nombre}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="componentes" className="jr-galeria-seccion">
        <div className="jr-seccion-intro">
          <span>02</span>
          <h2>Piezas de un mismo lugar</h2>
          <p>Controles operables. Todos comparten foco, ritmo, altura táctil y lenguaje.</p>
        </div>
        <div className="jr-galeria-contenido jr-muestras-grid">
          <article className="jr-muestra">
            <h3>Acciones</h3>
            <div className="jr-en-linea">
              <Boton
                jerarquia="primario"
                onClick={() => setAviso('Cambios guardados en el boceto.')}
              >
                Guardar cambios
              </Boton>
              <Boton onClick={() => abrir('dialogo')}>Ver detalles</Boton>
              <Boton jerarquia="terciario" onClick={() => setAviso('Acción cancelada.')}>
                Cancelar
              </Boton>
              <BotonIcono nombre="Añadir" icono="mas" onClick={() => setAviso('Pieza añadida.')} />
            </div>
          </article>
          <article className="jr-muestra">
            <h3>Riel y estado activo</h3>
            <div className="jr-en-linea">
              <Loseta
                nombre="Construir de muestra"
                icono="construir"
                activo={activo}
                atajo="Alt+2"
                onClick={() => setActivo(!activo)}
              />
              <Loseta
                nombre="Personas de muestra"
                icono="personas"
                activo={!activo}
                atajo="Alt+3"
                onClick={() => setActivo(!activo)}
              />
              <Insignia>6 personas</Insignia>
              <Estado>Disponible</Estado>
            </div>
          </article>
          <article className="jr-muestra">
            <h3>Elección</h3>
            <Conmutador
              etiqueta="Notificaciones"
              descripcion="Solo cuando necesitan tu atención"
              activo={activo}
              alCambiar={setActivo}
            />
            <Segmentado
              etiqueta="Visibilidad"
              opciones={OPCIONES}
              valor={valor}
              alCambiar={setValor}
            />
          </article>
          <article className="jr-muestra">
            <h3>Entrada y validación</h3>
            <Campo
              etiqueta="Nombre de la sala"
              placeholder="Por ejemplo, Estudio Norte"
              ayuda="Visible para quienes invites."
            />
            <Campo
              etiqueta="Nombre con error"
              defaultValue=""
              error="Escribe un nombre antes de continuar."
            />
          </article>
          <article className="jr-muestra">
            <h3>Selector propio</h3>
            <Selector
              etiqueta="Quién puede entrar"
              opciones={OPCIONES}
              valor={valor}
              alCambiar={setValor}
            />
            <small>Flechas · Inicio · Fin · letras · Enter · Escape</small>
          </article>
          <article className="jr-muestra">
            <h3>Ajuste continuo</h3>
            <Deslizador etiqueta="Volumen de muestra" valor={volumen} alCambiar={setVolumen} />
            <Progreso etiqueta="Preparando el espacio" valor={volumen} />
          </article>
          <article className="jr-muestra">
            <h3>Pestañas</h3>
            <Segmentado
              etiqueta="Pestañas de muestra"
              tipo="pestanas"
              idPanel="muestra-panel"
              opciones={[
                { valor: 'uno', etiqueta: 'Personas' },
                { valor: 'dos', etiqueta: 'Agentes' },
              ]}
              valor={tab}
              alCambiar={setTab}
            />
            <div role="tabpanel" id="muestra-panel" aria-labelledby={`muestra-panel-${tab}`}>
              <Fila
                iniciales={tab === 'uno' ? 'LU' : 'JU'}
                titulo={tab === 'uno' ? 'Lucía' : 'Jules'}
                detalle={tab === 'uno' ? 'En la sala' : 'Asistente de ejemplo'}
                estado="Disponible"
              />
              <Fila
                icono="construir"
                titulo="Construcción compartida"
                detalle="Cambios guardados"
              />
            </div>
          </article>
          <article className="jr-muestra">
            <h3>Menú y superficies temporales</h3>
            <div className="jr-en-linea">
              <Menu
                etiqueta="Acciones de muestra"
                opciones={[
                  { valor: 'copiar', etiqueta: 'Copiar enlace', icono: 'enlace' },
                  { valor: 'renombrar', etiqueta: 'Renombrar', icono: 'ajustes' },
                ]}
                alElegir={(v) =>
                  setAviso(
                    v === 'copiar' ? 'Enlace de ejemplo copiado.' : 'Nombre listo para editar.',
                  )
                }
              />
              <Boton onClick={() => abrir('dialogo')}>Abrir diálogo</Boton>
              <Boton onClick={() => abrir('hoja')}>Abrir hoja</Boton>
            </div>
            <small>Foco atrapado, fondo inerte y retorno al activador.</small>
          </article>
          <article className="jr-muestra">
            <h3>Indisponible, sin ambigüedad</h3>
            <Conmutador
              etiqueta="Voz no disponible"
              activo={false}
              alCambiar={setActivo}
              deshabilitado
            />
            <Selector
              etiqueta="Acceso no disponible"
              opciones={OPCIONES}
              valor={valor}
              alCambiar={setValor}
              deshabilitado
            />
            <Segmentado
              etiqueta="Elección no disponible"
              opciones={OPCIONES}
              valor={valor}
              alCambiar={setValor}
              deshabilitado
            />
            <div className="jr-en-linea">
              <Menu
                etiqueta="Menú no disponible"
                opciones={OPCIONES}
                alElegir={setValor}
                deshabilitado
              />
              <Boton cargando>Guardando</Boton>
            </div>
          </article>
          <article className="jr-muestra">
            <h3>Sin datos, con un siguiente paso</h3>
            <p>Aún no hay personas invitadas.</p>
            <Boton onClick={() => abrir('hoja')}>Invitar a alguien de ejemplo</Boton>
            <Deslizador
              etiqueta="Volumen no disponible"
              valor={0}
              alCambiar={setVolumen}
              deshabilitado
            />
          </article>
          <article className="jr-muestra jr-muestra-ancha">
            <h3>Feedback y ayudas</h3>
            <Aviso texto={aviso} />
            <div className="jr-en-linea">
              <Tecla>Esc</Tecla>
              <span>Cerrar</span>
              <Tecla>Alt</Tecla>
              <Tecla>2</Tecla>
              <span>Construir</span>
              <Cargando />
              <span>Preparando</span>
              <Insignia>Solo lectura</Insignia>
            </div>
          </article>
        </div>
      </section>
      <section id="estados" className="jr-galeria-seccion">
        <div className="jr-seccion-intro">
          <span>03</span>
          <h2>El estado es una señal</h2>
          <p>
            Foco de dos píxeles. Activo por superficie y peso. Cargando conserva el ancho y bloquea
            repeticiones.
          </p>
        </div>
        <div className="jr-galeria-contenido">
          <div className="jr-matriz-estados">
            {ESTADOS.map((estado, i) => (
              <article key={estado} data-estado={i}>
                <small>{estado}</small>
                <Boton
                  disabled={i === 5}
                  cargando={i === 6}
                  aria-pressed={i === 4}
                  onClick={() => setAviso(estado)}
                >
                  Acción
                </Boton>
                <BotonIcono
                  nombre={`Icono ${estado}`}
                  icono="construir"
                  activo={i === 4}
                  disabled={i === 5}
                  cargando={i === 6}
                />
                <Campo
                  etiqueta={`Campo ${estado}`}
                  placeholder="Nombre"
                  disabled={i >= 5}
                  readOnly={i === 4}
                  aria-busy={i === 6 || undefined}
                />
              </article>
            ))}
          </div>
          <p className="jr-nota">
            Hover y presionado se fijan aquí para comparar. El foco real aparece al navegar con Tab.
            Los controles informativos (tecla, insignia, progreso y carga) no simulan estados de
            interacción.
          </p>
        </div>
      </section>
      <section id="comportamiento" className="jr-galeria-seccion">
        <div className="jr-seccion-intro">
          <span>04</span>
          <h2>Movimiento con propósito</h2>
        </div>
        <div className="jr-galeria-contenido jr-reglas">
          <div>
            <strong>160 ms</strong>
            <span>Entrada de superficies</span>
          </div>
          <div>
            <strong>100 ms</strong>
            <span>Salida y respuesta de presión</span>
          </div>
          <div>
            <strong>44 px</strong>
            <span>Objetivo táctil mínimo</span>
          </div>
          <p>
            Sin desenfoque ni rebotes. La preferencia de movimiento reducido detiene las
            transiciones y el paseo autónomo. Solo un panel ocupa el contexto. Escape siempre
            permite volver al mundo.
          </p>
        </div>
      </section>
      <footer className="jr-galeria-pie">Jules Room · Interfaz AF · Prototipo independiente</footer>
      <Dialogo
        abierto={dialogo !== null}
        titulo={dialogo === 'hoja' ? 'Una decisión a tu alcance' : 'Renombrar la sala'}
        hoja={dialogo === 'hoja'}
        alCerrar={() => abrir(null)}
      >
        <p>
          {dialogo === 'hoja'
            ? 'En teléfono, esta superficie se apoya en el borde inferior. Conserva las mismas reglas de foco.'
            : 'El nombre ayuda a tu equipo a encontrar su lugar.'}
        </p>
        <Campo etiqueta="Nombre del ejemplo" defaultValue="Estudio Norte" />
        <Selector
          etiqueta="Acceso del ejemplo"
          opciones={OPCIONES}
          valor={valor}
          alCambiar={setValor}
        />
        <div className="jr-dialogo-acciones">
          <Boton onClick={() => abrir(null)}>Cancelar</Boton>
          <Boton
            jerarquia="primario"
            onClick={() => {
              abrir(null);
              setAviso('Nombre actualizado en el ejemplo.');
            }}
          >
            Guardar
          </Boton>
        </div>
      </Dialogo>
    </main>
  );
}
