import { useEffect, useMemo, useRef, useState } from 'react';
import {
  OPCIONES,
  Oficina,
  apagarTodo,
  atuendoPorRol,
  crearFuenteSimulada,
  crearMando,
  definicionAProps,
  ejemploEquipo,
  encenderTodo,
  estadisticas,
  fijarOpciones,
  medidoresAnimacion,
} from '@oficina/motor';
import type { EstadisticasMedidor, OpcionesMovimiento } from '@oficina/motor';
import { agregarAgente } from '../editor';
import { RED_LIVEKIT, crearRedSimulada } from './redSimulada';
import type { FuentePresencia, PersonaPresente } from '@oficina/motor';
import './movimiento.css';

const param = (nombre: string, defecto: string) =>
  new URLSearchParams(window.location.search).get(nombre) ?? defecto;

/** Las técnicas de la lista «Equipo de movimiento», en su orden de prioridad, más tres extras. */
const TECNICAS: { clave: keyof OpcionesMovimiento; nombre: string; nota: string }[] = [
  {
    clave: 'suavizadoExp',
    nombre: '1 · Suavizado independiente del framerate',
    nota: 'Mismo movimiento a 30, 60 o 144 Hz.',
  },
  {
    clave: 'snapshots',
    nombre: '2 · Remotos en el pasado (snapshots + Hermite)',
    nota: 'Fluidos con datos a 10 Hz, retraso y pérdida.',
  },
  {
    clave: 'prediccionAvatar',
    nombre: '3 · Predicción local del avatar',
    nota: 'Apagada, la orden llega con 0,15 s de retraso de red.',
  },
  {
    clave: 'marchaPorDistancia',
    nombre: '4 · Marcha por distancia',
    nota: 'Pies atados a lo recorrido: no patinan.',
  },
  {
    clave: 'resorteCritico',
    nombre: '5 · Resorte crítico (inclinación, altura, giro)',
    nota: 'Arranque y frenado con peso, giros progresivos.',
  },
  {
    clave: 'resorteRebase',
    nombre: '6 · Resorte subamortiguado (rebase)',
    nota: 'Pequeño rebote al frenar y al apoyar.',
  },
  {
    clave: 'camaraSeguimiento',
    nombre: '7 · Cámara con zona muerta y anticipación',
    nota: 'Apagada, la cámara va pegada al avatar.',
  },
  {
    clave: 'presupuestoLod',
    nombre: '8 · Presupuesto de animación en ms',
    nota: 'Lejanos y poco importantes se actualizan menos.',
  },
  {
    clave: 'pausaFueraDePantalla',
    nombre: '9 · Pausa fuera de pantalla',
    nota: 'No se anima lo que no se ve; vuelve a la fase correcta.',
  },
  {
    clave: 'aplastarEstirar',
    nombre: '10 · Aplastar, estirar y anticipación',
    nota: 'Peso al pisar y al sentarse.',
  },
  {
    clave: 'vida',
    nombre: 'Extra · Vida en reposo',
    nota: 'Respiración, cambio de peso, parpadeo y gestos propios.',
  },
  {
    clave: 'transiciones',
    nombre: 'Extra · Transiciones suaves',
    nota: 'Sentarse con anticipación, saludo con rebase.',
  },
  {
    clave: 'interes',
    nombre: 'Extra · Mirada que sigue a quien pasa',
    nota: 'Con reacción distinta por persona.',
  },
];

const CANTIDADES = [0, 3, 25, 100];

declare global {
  interface Window {
    __movimiento?: {
      opciones: OpcionesMovimiento;
      fijar: (c: Partial<OpcionesMovimiento>) => void;
      medicion: () => { agentes: EstadisticasMedidor; remotas: EstadisticasMedidor };
      avatar: { x: number; z: number; rumbo: number; velocidad: number };
      personas: () => readonly { x: number; z: number }[];
    };
  }
}

const vacio = (): EstadisticasMedidor => ({ media: 0, p50: 0, p95: 0, max: 0, n: 0 });

/** Página de movimiento: mueve tu avatar y enciende o apaga cada técnica para ver qué aporta. */
export function Movimiento() {
  // `ag=N` suma N agentes más (para medir 100 ocupantes que se sientan, pasean y conversan).
  const props = useMemo(() => {
    let definicion = ejemploEquipo;
    const n = Number(param('ag', '0'));
    for (let i = 0; i < n; i++) {
      definicion = agregarAgente(definicion);
      const nuevo = definicion.ocupantes[definicion.ocupantes.length - 1];
      const deptos = definicion.departamentos;
      if (nuevo?.tipo === 'agente' && deptos.length > 0) {
        nuevo.departamento = deptos[i % deptos.length]?.id ?? nuevo.departamento;
        nuevo.estado = i % 3 === 0 ? 'libre' : 'trabajando';
      }
    }
    return definicionAProps(definicion);
  }, []);
  const [simuladas, setSimuladas] = useState(Number(param('sim', '25')));
  const [conRed, setConRed] = useState(param('red', '1') === '1');
  const [hz, setHz] = useState(Number(param('hz', String(RED_LIVEKIT.hz))));
  const [retardo, setRetardo] = useState(Number(param('retardo', String(RED_LIVEKIT.retardoMs))));
  const [perdida, setPerdida] = useState(Number(param('perdida', String(RED_LIVEKIT.perdida))));
  const [conAvatar, setConAvatar] = useState(param('avatar', '1') === '1');
  const [seguir, setSeguir] = useState(param('seguir', '1') === '1');
  const [panel, setPanel] = useState(param('panel', '1') === '1');
  const [, repintar] = useState(0);
  const [lectura, setLectura] = useState({ agentes: vacio(), remotas: vacio() });
  const foco = param('foco', '');

  // Opciones desde la URL: off=a,b apaga esas técnicas; todo=0 apaga todas.
  useEffect(() => {
    if (param('todo', '1') === '0') apagarTodo();
    for (const clave of param('off', '').split(',')) {
      if (clave in OPCIONES) fijarOpciones({ [clave]: false });
    }
    for (const clave of param('on', '').split(',')) {
      if (clave in OPCIONES) fijarOpciones({ [clave]: true });
    }
    repintar((n) => n + 1);
  }, []);

  const base = useMemo(() => crearFuenteSimulada({ cantidad: simuladas, semilla: 1 }), [simuladas]);
  const red = useMemo(
    () =>
      conRed ? crearRedSimulada(base, { ...RED_LIVEKIT, hz, retardoMs: retardo, perdida }) : null,
    // Los parámetros se aplican en vivo abajo; la red se recrea solo al cambiar la fuente o encenderla.
    [base, conRed],
  );
  useEffect(() => {
    if (red) Object.assign(red.parametros, { hz, retardoMs: retardo, perdida });
  }, [red, hz, retardo, perdida]);
  useEffect(() => {
    let id = 0;
    let anterior = performance.now();
    const paso = (t: number) => {
      const dt = Math.min((t - anterior) / 1000, 0.1);
      anterior = t;
      base.avanzar(dt);
      red?.avanzar(dt);
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [base, red]);

  // `estatua=1`: una persona quieta justo delante del avatar (prueba determinista de la separación).
  const conEstatua = param('estatua', '0') === '1';
  const fuenteFinal = useMemo<FuentePresencia>(() => {
    const origen: FuentePresencia = red ?? base;
    if (!conEstatua) return origen;
    const estatua: PersonaPresente = {
      id: 'estatua',
      nombre: 'Estatua',
      atuendo: atuendoPorRol('Coach', 3),
      x: 1.45,
      y: 0,
      z: 1.6,
      rumbo: 0,
    };
    const lista = [...origen.personas(), estatua];
    return { personas: () => lista, suscribir: (f) => origen.suscribir(f) };
  }, [red, base, conEstatua]);

  const mando = useMemo(() => crearMando(), []);
  const estadoAvatar = useRef({ x: 0, z: 0, rumbo: 0, velocidad: 0 });
  const avatar = useMemo(
    () =>
      conAvatar
        ? {
            id: 'avatar-propio',
            nombre: 'Tú',
            x: 1.5,
            z: 2.5,
            mando,
            alCambiar: (e: { x: number; z: number; rumbo: number; velocidad: number }) => {
              estadoAvatar.current.x = e.x;
              estadoAvatar.current.z = e.z;
              estadoAvatar.current.rumbo = e.rumbo;
              estadoAvatar.current.velocidad = e.velocidad;
            },
          }
        : null,
    [conAvatar, mando],
  );

  useEffect(() => {
    window.__movimiento = {
      opciones: OPCIONES,
      fijar: (c) => {
        fijarOpciones(c);
        repintar((n) => n + 1);
      },
      medicion: () => {
        const a = vacio();
        const r = vacio();
        estadisticas(medidoresAnimacion.agentes, a);
        estadisticas(medidoresAnimacion.remotas, r);
        return { agentes: a, remotas: r };
      },
      avatar: estadoAvatar.current,
      personas: () => fuenteFinal.personas(),
    };
  }, [fuenteFinal]);
  useEffect(() => {
    const id = setInterval(() => {
      const a = vacio();
      const r = vacio();
      estadisticas(medidoresAnimacion.agentes, a);
      estadisticas(medidoresAnimacion.remotas, r);
      setLectura({ agentes: a, remotas: r });
    }, 500);
    return () => clearInterval(id);
  }, []);

  const total = lectura.agentes.p95 + lectura.remotas.p95;
  return (
    <div className="mov">
      <div className="mov-escena">
        <Oficina
          agentes={props.agentes}
          departamentos={props.departamentos}
          horaChile={props.horaChile}
          calidad="media"
          fuentePresencia={fuenteFinal}
          enfocadoId={foco || null}
          avatarPropio={avatar ?? undefined}
          seguirAvatar={conAvatar && seguir}
        />
      </div>
      <button className="mov-boton-panel" onClick={() => setPanel((p) => !p)} aria-expanded={panel}>
        {panel ? 'Ocultar panel' : 'Mostrar panel'}
      </button>
      {panel && (
        <aside className="mov-panel" aria-label="Controles de movimiento">
          <h1>Movimiento</h1>
          <p className="mov-ayuda">
            Mueve tu avatar con <b>W A S D</b> o las flechas, o haz clic en el piso para ir allí.
            Enciende o apaga cada técnica y mira la diferencia.
          </p>
          <section>
            <h2>Escena</h2>
            <div className="mov-fila">
              <span>Personas simuladas</span>
              {CANTIDADES.map((n) => (
                <button
                  key={n}
                  className={n === simuladas ? 'activo' : ''}
                  onClick={() => setSimuladas(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="mov-check">
              <input
                type="checkbox"
                checked={conAvatar}
                onChange={(e) => setConAvatar(e.target.checked)}
              />
              <span>Mi avatar</span>
            </label>
            <label className="mov-check">
              <input
                type="checkbox"
                checked={seguir}
                disabled={!conAvatar}
                onChange={(e) => setSeguir(e.target.checked)}
              />
              <span>La cámara me sigue</span>
            </label>
          </section>
          <section>
            <h2>Red simulada (LiveKit)</h2>
            <label className="mov-check">
              <input
                type="checkbox"
                checked={conRed}
                onChange={(e) => setConRed(e.target.checked)}
              />
              <span>Posiciones remotas por red (apagado: datos perfectos)</span>
            </label>
            <label className="mov-rango">
              <span>Envíos por segundo: {hz}</span>
              <input
                type="range"
                min={2}
                max={30}
                value={hz}
                disabled={!conRed}
                onChange={(e) => setHz(Number(e.target.value))}
              />
            </label>
            <label className="mov-rango">
              <span>Retraso: {retardo} ms</span>
              <input
                type="range"
                min={0}
                max={400}
                step={10}
                value={retardo}
                disabled={!conRed}
                onChange={(e) => setRetardo(Number(e.target.value))}
              />
            </label>
            <label className="mov-rango">
              <span>Pérdida: {Math.round(perdida * 100)} %</span>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={perdida}
                disabled={!conRed}
                onChange={(e) => setPerdida(Number(e.target.value))}
              />
            </label>
          </section>
          <section>
            <h2>Técnicas</h2>
            <div className="mov-fila">
              <button
                onClick={() => {
                  encenderTodo();
                  repintar((n) => n + 1);
                }}
              >
                Todo encendido
              </button>
              <button
                onClick={() => {
                  apagarTodo();
                  repintar((n) => n + 1);
                }}
              >
                Todo apagado (antes)
              </button>
            </div>
            {TECNICAS.map((t) => (
              <label key={t.clave} className="mov-check mov-tecnica">
                <input
                  type="checkbox"
                  checked={OPCIONES[t.clave]}
                  onChange={(e) => {
                    fijarOpciones({ [t.clave]: e.target.checked });
                    repintar((n) => n + 1);
                  }}
                />
                <span>
                  {t.nombre}
                  <small>{t.nota}</small>
                </span>
              </label>
            ))}
          </section>
          <section>
            <h2>Costo de animación (JavaScript, por cuadro)</h2>
            <table className="mov-tabla">
              <thead>
                <tr>
                  <th></th>
                  <th>media</th>
                  <th>p95</th>
                  <th>máx</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Agentes</td>
                  <td>{lectura.agentes.media.toFixed(2)}</td>
                  <td>{lectura.agentes.p95.toFixed(2)}</td>
                  <td>{lectura.agentes.max.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Personas remotas</td>
                  <td>{lectura.remotas.media.toFixed(2)}</td>
                  <td>{lectura.remotas.p95.toFixed(2)}</td>
                  <td>{lectura.remotas.max.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mov-ayuda">
              ms. p95 total: <b>{total.toFixed(2)} ms</b> (presupuesto inicial ≤ 2 ms).
            </p>
          </section>
        </aside>
      )}
    </div>
  );
}
