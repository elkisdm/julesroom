import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { crearMando } from '@oficina/motor';
import type { Accion, MetricasRender, VistaOficina } from '@oficina/motor';
import {
  Aviso,
  Boton,
  BotonIcono,
  Campo,
  Dialogo,
  Estado,
  Loseta,
  Menu,
  Segmentado,
  Tecla,
  clases,
} from './componentes';
import { Escena } from './Escena';
import { PERSONAS } from './escenaDemo';
import type { AmbienteDemo } from './Escena';
import { Galeria } from './Galeria';
import { Icono } from './iconos';
import { cambiarModo, modoPorAtajo, MODOS, PARAMETROS_INTERFAZ, vistaInicial } from './interaccion';
import type { Modo } from './interaccion';
import { Palanca } from './Palanca';
import {
  PanelAjustes,
  PanelConstruirDemo,
  PanelConversacion,
  PanelPersonas,
  PanelPresentar,
} from './Paneles';
import type { MensajeDemo } from './Paneles';
import './sala.css';
import './galeria.css';

const TITULOS: Record<Modo, string> = {
  moverse: 'Moverse',
  construir: 'Construir',
  personas: 'Personas',
  conversacion: 'Conversación',
  presentar: 'Presentar',
  ajustes: 'Ajustes',
};
const DESCRIPCIONES: Record<Modo, string> = {
  moverse: '',
  construir: 'Dale forma a tu espacio.',
  personas: '6 personas en la sala.',
  conversacion: 'Sala y asistentes.',
  presentar: 'Reúne la atención del equipo.',
  ajustes: 'Interfaz, ambiente y sonido.',
};
const MENSAJES_INICIALES: MensajeDemo[] = [
  { autor: 'Lucía', texto: 'Dejé un lugar en la mesa. ¿Nos reunimos aquí?' },
  { autor: 'Mateo', texto: 'Me gusta esta luz. Ya estoy llegando.' },
];

export function Interfaz() {
  const parametros = useMemo(() => new URLSearchParams(location.search), []);
  const [tema, setTema] = useState<'oscuro' | 'claro'>(
    parametros.get('tema') === 'claro' ? 'claro' : 'oscuro',
  );
  const [ambiente, setAmbiente] = useState<AmbienteDemo>(
    parametros.get('ambiente') === 'noche' ? 'noche' : 'dia',
  );
  const [pagina, setPagina] = useState(parametros.get('vista') === 'sistema' ? 'sistema' : 'sala');
  const [simulacion, setSimulacion] = useState(false);
  const [modo, setModo] = useState<Modo>('moverse');
  const [microfono, setMicrofono] = useState(false);
  const [vista, setVista] = useState<VistaOficina>(() => vistaInicial(window.innerWidth));
  const [enMovimiento, setMovimiento] = useState(false);
  const [sentado, setSentado] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [objetos, setObjetos] = useState<string[]>([]);
  const [mensajes, setMensajes] = useState(MENSAJES_INICIALES);
  const [destinatario, setDestinatario] = useState('');
  const [borrador, setBorrador] = useState('');
  const [aviso, setAviso] = useState('');
  const [modal, abrirModal] = useState<'invitar' | 'atajos' | null>(null);
  const [limpia, setLimpia] = useState<'presentar' | 'grabar' | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [errorCopia, setErrorCopia] = useState('');
  const mando = useMemo(() => crearMando(), []);
  const marco = useRef<HTMLDivElement>(null);
  const tituloPanel = useRef<HTMLHeadingElement>(null);
  const alMetricas = useCallback((m: MetricasRender) => {
    if (marco.current) {
      marco.current.dataset.fps = String(m.fps);
      marco.current.dataset.p95 = String(m.p95);
      marco.current.dataset.drawcalls = String(m.drawCalls);
    }
  }, []);
  const alPosicion = useCallback((p: { x: number; y: number; z: number }) => {
    if (marco.current) marco.current.dataset.avatar = JSON.stringify(p);
  }, []);
  const alMovimiento = useCallback((m: boolean) => {
    setMovimiento(m);
    if (m && !document.activeElement?.matches('input, textarea')) setModo('moverse');
  }, []);
  const elegirModo = useCallback((m: Modo) => {
    setModo((actual) => cambiarModo(actual, m));
  }, []);
  const cerrarPanel = () => {
    const anterior = modo;
    setModo('moverse');
    marco.current
      ?.querySelector<HTMLButtonElement>(`.jr-riel [aria-label="${TITULOS[anterior]}"]`)
      ?.focus();
  };
  useEffect(() => {
    if (modo !== 'moverse') tituloPanel.current?.focus();
  }, [modo]);
  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(''), PARAMETROS_INTERFAZ.aviso);
    return () => clearTimeout(timer);
  }, [aviso]);
  useEffect(() => {
    const teclado = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const objetivo = e.target as HTMLElement;
      const escribiendo =
        objetivo.matches('input, textarea, [contenteditable="true"]') ||
        Boolean(objetivo.closest('[role="combobox"], [role="menu"]'));
      if (e.key === 'Escape') {
        if (limpia) {
          setLimpia(null);
          setVista('general');
        } else if (modo !== 'moverse') {
          setModo('moverse');
          marco.current
            ?.querySelector<HTMLButtonElement>(`.jr-riel [aria-label="${TITULOS[modo]}"]`)
            ?.focus();
        }
        return;
      }
      if (pagina !== 'sala') return;
      const nuevo = modoPorAtajo({
        ...e,
        key: e.key,
        code: e.code,
        altKey: e.altKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        escribiendo,
      });
      if (nuevo && !limpia) {
        e.preventDefault();
        elegirModo(nuevo);
      }
      if (
        !escribiendo &&
        e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        (e.code === 'KeyM' || e.key.toLowerCase() === 'm')
      ) {
        e.preventDefault();
        setMicrofono((m) => !m);
      }
    };
    window.addEventListener('keydown', teclado);
    return () => window.removeEventListener('keydown', teclado);
  }, [elegirModo, limpia, modo, pagina]);
  const cambiarAmbiente = (a: AmbienteDemo) => {
    setAmbiente(a);
    setVista(vistaInicial(marco.current?.clientWidth ?? window.innerWidth));
    mando.adelante = 0;
    mando.lateral = 0;
    mando.destino = null;
  };
  const enviar = (texto: string) => {
    setMensajes((m) => [...m, { autor: 'Tú', texto }]);
  };
  const agregar = (nombre: string) => {
    setObjetos((o) => [...o, nombre]);
    setAviso(`${nombre}: añadido al boceto.`);
  };
  const deshacer = () => {
    setObjetos((o) => o.slice(0, -1));
    setAviso('Última pieza retirada del boceto.');
  };
  const activarLimpia = (tipo: 'presentar' | 'grabar') => {
    setModo('moverse');
    setLimpia(tipo);
    if (tipo === 'presentar') setVista({ zona: ambiente === 'dia' ? 'reunion' : 'aula' });
  };
  const conversacion = (nombre: string) => {
    setDestinatario(nombre);
    setModo('conversacion');
  };
  const alMicrofono = () => {
    setMicrofono(!microfono);
    setAviso(
      microfono
        ? 'Micrófono de ejemplo silenciado.'
        : 'Micrófono de ejemplo activado. No se captura audio.',
    );
  };
  const alAccion = () => {
    mando.acciones = (mando.acciones ?? 0) + 1;
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText('https://julesroom.example/estudio-norte');
      setCopiado(true);
      setErrorCopia('');
    } catch {
      setErrorCopia('No pudimos copiar. Selecciona el enlace y cópialo.');
    }
  };
  return (
    <div className="jr jr-app" data-tema={tema} data-simulacion={simulacion}>
      <div
        ref={marco}
        className={clases('jr-marco', pagina === 'sistema' && 'jr-marco--sistema')}
        data-panel={modo !== 'moverse'}
        data-movimiento={enMovimiento}
        data-limpia={Boolean(limpia)}
        onKeyDown={(e) => {
          const t = e.target as HTMLElement;
          if (
            t.closest('[data-interfaz]') &&
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)
          )
            e.stopPropagation();
        }}
      >
        <div
          className="jr-mundo"
          aria-label="Mundo 3D de ejemplo"
          onPointerDown={() => {
            if (modo !== 'moverse') setModo('moverse');
          }}
          hidden={pagina !== 'sala'}
        >
          <Escena
            ambiente={ambiente}
            vista={vista}
            mando={mando}
            visible={pagina === 'sala'}
            alMetricas={alMetricas}
            alMovimiento={alMovimiento}
            alAccion={setAccion}
            alSentarse={setSentado}
            alPosicion={alPosicion}
          />
        </div>
        {!limpia && (
          <div className="jr-barra-lab" data-interfaz>
            <Segmentado
              etiqueta="Explorar el prototipo"
              opciones={[
                { valor: 'sala', etiqueta: 'Sala' },
                { valor: 'sistema', etiqueta: 'Sistema' },
              ]}
              valor={pagina}
              alCambiar={setPagina}
            />
            <div className="jr-barra-separador" />
            <BotonIcono
              nombre={tema === 'oscuro' ? 'Usar tema claro' : 'Usar tema oscuro'}
              icono="contraste"
              onClick={() => setTema(tema === 'oscuro' ? 'claro' : 'oscuro')}
            />
            <BotonIcono
              className="jr-simular"
              nombre="Simular teléfono de 390 px"
              icono="telefono"
              activo={simulacion}
              onClick={() => {
                setSimulacion(!simulacion);
                setVista(vistaInicial(simulacion ? window.innerWidth : 390));
              }}
            />
            <BotonIcono
              nombre={ambiente === 'dia' ? 'Ver mundo de noche' : 'Ver mundo de día'}
              icono={ambiente === 'dia' ? 'luna' : 'sol'}
              onClick={() => cambiarAmbiente(ambiente === 'dia' ? 'noche' : 'dia')}
            />
          </div>
        )}
        {pagina === 'sistema' ? (
          <Galeria />
        ) : (
          <>
            {!limpia && (
              <>
                <header className="jr-identidad" data-interfaz>
                  <div className="jr-marca-sala">
                    <Icono nombre="construir" />
                  </div>
                  <div>
                    <h1>Estudio Norte</h1>
                    <span>
                      {PERSONAS.length + 1} personas <span aria-hidden="true">·</span> Guardado
                      local
                    </span>
                  </div>
                  <BotonIcono
                    nombre="Información y atajos de la sala"
                    icono="abajo"
                    onClick={() => abrirModal('atajos')}
                  />
                </header>
                <nav className="jr-riel" aria-label="Modos de la sala" data-interfaz>
                  {MODOS.map((m, i) => (
                    <Loseta
                      key={m}
                      nombre={TITULOS[m]}
                      icono={m}
                      activo={modo === m}
                      atajo={`Alt+${i + 1}`}
                      onClick={() => elegirModo(m)}
                    />
                  ))}
                  <span className="jr-riel-espacio" />
                  <BotonIcono
                    nombre="Ayuda y atajos"
                    icono="ayuda"
                    onClick={() => abrirModal('atajos')}
                  />
                </nav>
                {modo !== 'moverse' && (
                  <aside
                    key={modo}
                    className="jr-panel-contextual"
                    aria-labelledby="jr-titulo-panel"
                    data-interfaz
                  >
                    <div className="jr-hoja-tirador" />
                    <header className="jr-panel-cabecera">
                      <div>
                        <h2 ref={tituloPanel} tabIndex={-1} id="jr-titulo-panel">
                          {TITULOS[modo]}
                          {modo === 'personas' && <span className="jr-cuenta">6</span>}
                        </h2>
                        <p>{DESCRIPCIONES[modo]}</p>
                      </div>
                      <BotonIcono nombre="Cerrar panel" icono="cerrar" onClick={cerrarPanel} />
                    </header>
                    <div className="jr-panel-contenido">
                      {modo === 'construir' && (
                        <PanelConstruirDemo
                          objetos={objetos}
                          alAgregar={agregar}
                          alDeshacer={deshacer}
                        />
                      )}
                      {modo === 'personas' && (
                        <PanelPersonas
                          alInvitar={() => {
                            abrirModal('invitar');
                            setCopiado(false);
                          }}
                          alConversar={conversacion}
                        />
                      )}
                      {modo === 'conversacion' && (
                        <PanelConversacion
                          mensajes={mensajes}
                          alEnviar={enviar}
                          destinatario={destinatario}
                          texto={borrador}
                          alTexto={setBorrador}
                        />
                      )}
                      {modo === 'presentar' && (
                        <PanelPresentar
                          alPresentar={() => activarLimpia('presentar')}
                          alGrabar={() => activarLimpia('grabar')}
                        />
                      )}
                      {modo === 'ajustes' && (
                        <PanelAjustes
                          tema={tema}
                          alTema={setTema}
                          ambiente={ambiente}
                          alAmbiente={cambiarAmbiente}
                        />
                      )}
                    </div>
                  </aside>
                )}
                <div className="jr-contexto-mundo" aria-hidden="true">
                  <span>{ambiente === 'dia' ? 'La oficina' : 'La sala de noche'}</span>
                  <small>
                    {ambiente === 'dia'
                      ? 'Luz de mañana. Ideas por venir.'
                      : 'Un lugar para seguir conversando.'}
                  </small>
                </div>
                <div className="jr-ayuda-movimiento" data-interfaz>
                  <span>
                    <Tecla>W</Tecla>
                    <Tecla>A</Tecla>
                    <Tecla>S</Tecla>
                    <Tecla>D</Tecla> Caminar
                  </span>
                  <span>
                    <Tecla>Espacio</Tecla> Saltar
                  </span>
                  <span>Arrastra para mirar</span>
                </div>
                <div className="jr-controles-tactiles">
                  <Palanca mando={mando} />
                  <div className="jr-acciones-pulgar">
                    <BotonIcono
                      nombre="Saltar con el pulgar"
                      icono="saltar"
                      onClick={() => {
                        mando.saltos += 1;
                      }}
                    />
                    <BotonIcono
                      nombre={sentado ? 'Levantarse con el pulgar' : 'Interactuar con el pulgar'}
                      icono="sentarse"
                      disabled={!accion && !sentado}
                      onClick={alAccion}
                    />
                  </div>
                </div>
                <div className="jr-dock" role="toolbar" aria-label="Acciones rápidas" data-interfaz>
                  <div className="jr-dock-grupo">
                    <BotonIcono
                      nombre="Micrófono"
                      icono={microfono ? 'microfono' : 'silencio'}
                      activo={microfono}
                      aria-keyshortcuts="Alt+m"
                      onClick={alMicrofono}
                    />
                    <Menu
                      etiqueta="Reacciones"
                      icono="reaccion"
                      opciones={[
                        { valor: 'saludo', etiqueta: 'Saludar', icono: 'personas' },
                        { valor: 'aplauso', etiqueta: 'Aplaudir', icono: 'reaccion' },
                        { valor: 'acuerdo', etiqueta: 'De acuerdo', icono: 'listo' },
                      ]}
                      alElegir={(r) =>
                        setAviso(
                          {
                            saludo: 'Has saludado a la sala.',
                            aplauso: 'Has enviado un aplauso.',
                            acuerdo: 'Has marcado tu acuerdo.',
                          }[r] ?? '',
                        )
                      }
                    />
                  </div>
                  <div className="jr-dock-separador" />
                  <div className="jr-dock-grupo jr-dock-movimiento">
                    <BotonIcono
                      nombre="Saltar"
                      icono="saltar"
                      onClick={() => {
                        mando.saltos += 1;
                      }}
                    />
                    <BotonIcono
                      nombre={sentado ? 'Levantarse' : 'Sentarse cerca de una silla'}
                      icono="sentarse"
                      disabled={accion?.tipo !== 'sentarse' && !sentado}
                      onClick={alAccion}
                    />
                  </div>
                  <BotonIcono
                    nombre={vista === 'seguir' ? 'Vista general' : 'Seguir mi personaje'}
                    icono="vista"
                    activo={vista === 'seguir'}
                    onClick={() => setVista(vista === 'seguir' ? 'general' : 'seguir')}
                  />
                </div>
                <div className="jr-etiqueta-demo">
                  Jules Room <span>Prototipo · datos de ejemplo</span>
                </div>
              </>
            )}
            {limpia && (
              <div className="jr-control-limpia" data-interfaz>
                <Icono nombre={limpia === 'grabar' ? 'grabar' : 'presentar'} />
                <span>{limpia === 'grabar' ? 'Vista para grabar' : 'Presentación de ejemplo'}</span>
                <Boton
                  onClick={() => {
                    setLimpia(null);
                    setVista('general');
                  }}
                >
                  Volver a la sala <Tecla>Esc</Tecla>
                </Boton>
              </div>
            )}
            {aviso && !limpia && (
              <div className="jr-avisos" data-interfaz>
                <Aviso texto={aviso} alCerrar={() => setAviso('')} />
              </div>
            )}
          </>
        )}
        <Dialogo
          abierto={modal === 'invitar'}
          titulo="Hay un lugar para alguien más"
          hoja
          alCerrar={() => abrirModal(null)}
        >
          <p>Así se verá la invitación. El enlace es de ejemplo y no abre una sala compartida.</p>
          <Campo
            etiqueta="Enlace de ejemplo"
            readOnly
            value="https://julesroom.example/estudio-norte"
            onFocus={(e) => e.target.select()}
            error={errorCopia}
          />
          <div className="jr-dialogo-acciones">
            <Boton onClick={() => abrirModal(null)}>Cerrar</Boton>
            <Boton
              jerarquia="primario"
              icono={copiado ? 'listo' : 'enlace'}
              onClick={() => void copiar()}
            >
              {copiado ? 'Copiado' : 'Copiar enlace'}
            </Boton>
          </div>
        </Dialogo>
        <Dialogo
          abierto={modal === 'atajos'}
          titulo="Tu lugar en Jules Room"
          hoja
          alCerrar={() => abrirModal(null)}
        >
          <Estado>Estudio Norte · 6 personas de ejemplo</Estado>
          <p>
            Muévete con el teclado o toca el suelo. Abre un modo cuando lo necesites; el mundo sigue
            a tu lado.
          </p>
          <dl className="jr-atajos">
            {MODOS.map((m, i) => (
              <div key={m}>
                <dt>{TITULOS[m]}</dt>
                <dd>
                  <Tecla>Alt + {i + 1}</Tecla>
                </dd>
              </div>
            ))}
            <div>
              <dt>Caminar / correr</dt>
              <dd>
                <Tecla>WASD</Tecla> / <Tecla>Shift</Tecla>
              </dd>
            </div>
            <div>
              <dt>Saltar / interactuar</dt>
              <dd>
                <Tecla>Espacio</Tecla> / <Tecla>E</Tecla>
              </dd>
            </div>
            <div>
              <dt>Volver al mundo</dt>
              <dd>
                <Tecla>Esc</Tecla>
              </dd>
            </div>
          </dl>
          <Boton jerarquia="primario" onClick={() => abrirModal(null)}>
            Entendido
          </Boton>
        </Dialogo>
      </div>
      {simulacion && (
        <Boton
          className="jr-salir-simulacion"
          onClick={() => {
            setSimulacion(false);
            setVista(vistaInicial(window.innerWidth));
          }}
        >
          Salir de simulación
        </Boton>
      )}
    </div>
  );
}
