import { useEffect, useMemo, useState } from 'react';
import { laboratorio as L } from '@oficina/motor';
import { Deslizador } from './Deslizador';
import { Escena } from './Escena';
import { PROGRAMAS } from './programa';
import { crearControl } from './control';
import type { Camara, Control, Vista } from './control';
import './caminata.css';

type Objeto = Record<string, number>;
interface Ajuste {
  clave: string;
  nombre: string;
  min: number;
  max: number;
  paso: number;
}
interface Grupo {
  titulo: string;
  id: string;
  objeto: Objeto;
  ajustes: Ajuste[];
}

const a = (clave: string, nombre: string, min: number, max: number, paso = 0.01): Ajuste => ({
  clave,
  nombre,
  min,
  max,
  paso,
});

const GRUPOS: Grupo[] = [
  {
    titulo: 'Velocidad y respuesta',
    id: 'locomocion',
    objeto: L.PARAMETROS_LOCOMOCION as unknown as Objeto,
    ajustes: [
      a('velMax', 'Caminar (m/s)', 0.8, 5, 0.05),
      a('velCorrer', 'Correr (m/s)', 1.5, 9, 0.05),
      a('aceleracion', 'Aceleración (m/s²)', 2, 60, 0.5),
      a('frenado', 'Frenado (m/s²)', 2, 60, 0.5),
      a('frenadoCorrer', 'Frenado corriendo (derrape)', 2, 60, 0.5),
      a('giroMax', 'Giro máximo (rad/s)', 4, 30, 0.5),
      a('anticipacion', 'Anticipación (s)', 0, 0.15, 0.005),
    ],
  },
  {
    titulo: 'Ciclo: ritmo y pasos',
    id: 'caminata',
    objeto: L.PARAMETROS_CAMINATA as unknown as Objeto,
    ajustes: [
      a('cadenciaCaminar', 'Cadencia caminando (ciclos/s)', 0.8, 3.5),
      a('cadenciaCorrer', 'Cadencia corriendo (ciclos/s)', 1, 4),
      a('cadenciaMinima', 'Cadencia a paso lento (fracción)', 0.2, 1),
      a('apoyoCaminar', 'Apoyo caminando (fracción)', 0.3, 0.7),
      a('apoyoCorrer', 'Apoyo corriendo (fracción)', 0.2, 0.5),
      a('recorridoMaximo', 'Recorrido máx. del pie (m)', 0.2, 0.9),
      a('alturaPieCaminar', 'Altura del pie caminando (m)', 0, 0.3, 0.005),
      a('alturaPieCorrer', 'Altura del pie corriendo (m)', 0, 0.45, 0.005),
      a('picoPieCaminar', 'Pico del arco caminando', 0.1, 0.9),
      a('picoPieCorrer', 'Pico del arco corriendo', 0.1, 0.9),
    ],
  },
  {
    titulo: 'Ciclo: cuerpo',
    id: 'cuerpo',
    objeto: L.PARAMETROS_CAMINATA as unknown as Objeto,
    ajustes: [
      a('reboteCaminar', 'Rebote caminando (m)', 0, 0.08, 0.002),
      a('reboteCorrer', 'Rebote corriendo (m)', 0, 0.12, 0.002),
      a('agacheCaminar', 'Agache caminando', 0, 0.12, 0.005),
      a('agacheCorrer', 'Agache corriendo', 0, 0.15, 0.005),
      a('giroPelvisCaminar', 'Giro de pelvis caminando (rad)', 0, 0.5),
      a('giroPelvisCorrer', 'Giro de pelvis corriendo (rad)', 0, 0.5),
      a('contragiroCaminar', 'Contragiro torso caminando', 0, 0.4),
      a('contragiroCorrer', 'Contragiro torso corriendo', 0, 0.4),
      a('ladeoPelvis', 'Ladeo de pelvis (rad)', 0, 0.2, 0.005),
      a('vaivenLateral', 'Vaivén lateral (m)', 0, 0.06, 0.002),
      a('inclinacionCaminar', 'Inclinación caminando (rad)', -0.1, 0.4),
      a('inclinacionCorrer', 'Inclinación corriendo (rad)', 0, 0.6),
    ],
  },
  {
    titulo: 'Ciclo: brazos y cabeza',
    id: 'brazos',
    objeto: L.PARAMETROS_CAMINATA as unknown as Objeto,
    ajustes: [
      a('brazoCaminar', 'Balanceo caminando (rad)', 0, 1.4),
      a('brazoCorrer', 'Balanceo corriendo (rad)', 0, 1.6),
      a('sesgoBrazoCorrer', 'Sesgo adelante corriendo', -0.6, 0.3),
      a('codoCaminar', 'Codo caminando (rad)', 0, 1.6),
      a('codoCorrer', 'Codo corriendo (rad)', 0, 2.2),
      a('codoExtra', 'Codo extra al adelantar', 0, 1.2),
      a('abduccionCaminar', 'Brazos abiertos caminando', 0, 0.5),
      a('abduccionCorrer', 'Brazos abiertos corriendo', 0, 0.6),
      a('retrasoBrazo', 'Retraso del brazo (ciclo)', 0, 0.2, 0.005),
      a('retrasoCabeza', 'Retraso de la cabeza (ciclo)', 0, 0.3, 0.005),
      a('cabeceo', 'Cabeceo (rad)', 0, 0.2, 0.005),
      a('estabilizarCabeza', 'Cabeza estable (0..1)', 0, 1),
    ],
  },
  {
    titulo: 'Salto',
    id: 'salto',
    objeto: L.PARAMETROS_SALTO as unknown as Objeto,
    ajustes: [
      a('altura', 'Altura (m)', 0.2, 2.5),
      a('tiempoAire', 'Tiempo en el aire (s)', 0.25, 1.2),
      a('impulso', 'Impulso (s)', 0, 0.2, 0.005),
      a('aterrizaje', 'Aterrizaje (s)', 0, 0.4, 0.005),
      a('controlAire', 'Control en el aire', 0, 1),
    ],
  },
  {
    titulo: 'Salto: pose',
    id: 'poseSalto',
    objeto: L.PARAMETROS_POSE_SALTO as unknown as Objeto,
    ajustes: [
      a('agacheImpulso', 'Agache al impulsar (m)', 0, 0.25, 0.005),
      a('agacheAterrizaje', 'Agache al aterrizar (m)', 0, 0.3, 0.005),
      a('recogerDelantera', 'Rodilla arriba (m)', 0, 0.4, 0.005),
      a('recogerTrasera', 'Pierna atrás (m)', 0, 0.4, 0.005),
      a('hombroSubida', 'Brazos al subir (rad)', -3, 0.5),
      a('hombroCaida', 'Brazos al caer (rad)', -3.1, 0.5),
      a('abduccionCaida', 'Brazos abiertos al caer', 0, 1.4),
    ],
  },
];

const PARAMETROS_INICIALES = JSON.stringify(
  Object.fromEntries(GRUPOS.map((g) => [g.id, { ...g.objeto }])),
);

const CAMARAS: [Camara, string][] = [
  ['juego', 'De juego'],
  ['lateral', 'Lateral'],
  ['frontal', 'Frontal'],
  ['atras', 'Detrás'],
  ['cerca', 'De cerca'],
];
const VISTAS: [Vista, string][] = [
  ['ahora', 'Ahora'],
  ['antes', 'Antes (main)'],
  ['lado', 'Lado a lado'],
];
const VELOCIDADES: [number, string][] = [
  [1, '1×'],
  [0.5, '½×'],
  [0.25, '¼×'],
];

const param = (nombre: string) => new URLSearchParams(window.location.search).get(nombre);

declare global {
  interface Window {
    __caminata?: Control;
  }
}

function useTeclado(control: Control) {
  useEffect(() => {
    const abajo = new Set<string>();
    const aplicar = () => {
      const t = control.teclas;
      t.x =
        (abajo.has('KeyA') || abajo.has('ArrowLeft') ? 1 : 0) -
        (abajo.has('KeyD') || abajo.has('ArrowRight') ? 1 : 0);
      t.z =
        (abajo.has('KeyW') || abajo.has('ArrowUp') ? 1 : 0) -
        (abajo.has('KeyS') || abajo.has('ArrowDown') ? 1 : 0);
      t.correr = abajo.has('ShiftLeft') || abajo.has('ShiftRight');
    };
    const bajar = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).getAttribute?.('role') === 'slider') return;
      if (e.code === 'Space') {
        control.teclas.saltar = true;
        setTimeout(() => (control.teclas.saltar = false), 40);
        e.preventDefault();
      }
      abajo.add(e.code);
      aplicar();
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) control.programa = 'manual';
    };
    const subir = (e: KeyboardEvent) => {
      abajo.delete(e.code);
      aplicar();
    };
    window.addEventListener('keydown', bajar);
    window.addEventListener('keyup', subir);
    return () => {
      window.removeEventListener('keydown', bajar);
      window.removeEventListener('keyup', subir);
    };
  }, [control]);
}

export function Caminata() {
  const control = useMemo(() => {
    const c = crearControl();
    c.programa = param('programa') ?? c.programa;
    c.camara = (param('camara') as Camara | null) ?? c.camara;
    c.vista = (param('vista') as Vista | null) ?? c.vista;
    c.huellas = param('huellas') !== '0';
    window.__caminata = c;
    return c;
  }, []);
  const [, refrescar] = useState(0);
  const render = () => refrescar((n) => n + 1);
  const [lectura, setLectura] = useState(control.lectura);
  const [copiado, setCopiado] = useState(false);
  // En pantallas angostas el panel parte cerrado: si no, tapa la escena.
  const [panel, setPanel] = useState(
    param('panel') === '1' || (param('panel') !== '0' && window.innerWidth >= 700),
  );
  useTeclado(control);

  useEffect(() => {
    const id = setInterval(() => setLectura({ ...control.lectura }), 150);
    return () => clearInterval(id);
  }, [control]);

  const fijar = (cambio: Partial<Control>) => {
    Object.assign(control, cambio);
    render();
  };
  const reiniciar = () => {
    control.reiniciar.ahora = true;
    control.reiniciar.antes = true;
  };
  const copiar = async () => {
    const valores = Object.fromEntries(GRUPOS.map((g) => [g.id, g.objeto]));
    await navigator.clipboard.writeText(JSON.stringify(valores, null, 2));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };
  const restaurar = () => {
    const iniciales = JSON.parse(PARAMETROS_INICIALES) as Record<string, Objeto>;
    for (const g of GRUPOS) Object.assign(g.objeto, iniciales[g.id]);
    render();
  };

  const alto = lectura.alto || 1.6;
  const pasos = 2 * L.cadencia(lectura.velocidad) * (lectura.velocidad > 0.05 ? 1 : 0);
  const lado = control.vista === 'lado';

  return (
    <div className="cam">
      <div className={lado ? 'cam-escenas cam-escenas-lado' : 'cam-escenas'}>
        {(lado || control.vista === 'ahora') && (
          <div className="cam-escena">
            <Escena control={control} version="ahora" />
            {lado && <span className="cam-etiqueta">Ahora</span>}
          </div>
        )}
        {(lado || control.vista === 'antes') && (
          <div className="cam-escena">
            <Escena control={control} version="antes" />
            {lado && <span className="cam-etiqueta">Antes (main)</span>}
          </div>
        )}
      </div>

      <div className="cam-lectura" aria-live="off">
        <span>{lectura.velocidad.toFixed(2)} m/s</span>
        <span>{(lectura.velocidad / alto).toFixed(2)} cuerpos/s</span>
        <span>{pasos.toFixed(1)} pasos/s</span>
        <span>carrera {L.factorCarrera(lectura.velocidad).toFixed(2)}</span>
        <span>salto: {lectura.salto}</span>
      </div>

      <button type="button" className="cam-boton cam-alternar" onClick={() => setPanel(!panel)}>
        {panel ? 'Ocultar panel' : 'Panel'}
      </button>

      {panel && (
        <aside className="cam-panel">
          <h1>Caminata</h1>
          <p className="cam-nota">W A S D mueve · Shift corre · Espacio salta</p>

          <section>
            <h2>Programa</h2>
            <div className="cam-fila">
              {PROGRAMAS.map((p) => (
                <button
                  type="button"
                  key={p.nombre}
                  className={control.programa === p.nombre ? 'cam-boton activo' : 'cam-boton'}
                  onClick={() => {
                    fijar({ programa: p.nombre });
                    reiniciar();
                  }}
                >
                  {p.titulo}
                </button>
              ))}
              <button
                type="button"
                className={control.programa === 'manual' ? 'cam-boton activo' : 'cam-boton'}
                onClick={() => fijar({ programa: 'manual' })}
              >
                Teclado
              </button>
            </div>
          </section>

          <section>
            <h2>Versión</h2>
            <div className="cam-fila">
              {VISTAS.map(([v, t]) => (
                <button
                  type="button"
                  key={v}
                  className={control.vista === v ? 'cam-boton activo' : 'cam-boton'}
                  onClick={() => {
                    fijar({ vista: v });
                    reiniciar();
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>Cámara</h2>
            <div className="cam-fila">
              {CAMARAS.map(([v, t]) => (
                <button
                  type="button"
                  key={v}
                  className={control.camara === v ? 'cam-boton activo' : 'cam-boton'}
                  onClick={() => fijar({ camara: v })}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>Tiempo</h2>
            <div className="cam-fila">
              {VELOCIDADES.map(([v, t]) => (
                <button
                  type="button"
                  key={v}
                  className={control.velocidad === v ? 'cam-boton activo' : 'cam-boton'}
                  onClick={() => fijar({ velocidad: v })}
                >
                  {t}
                </button>
              ))}
              <button
                type="button"
                className={control.pausa ? 'cam-boton activo' : 'cam-boton'}
                onClick={() => fijar({ pausa: !control.pausa })}
              >
                {control.pausa ? 'Seguir' : 'Pausa'}
              </button>
              <button
                type="button"
                className="cam-boton"
                onClick={() => fijar({ pausa: true, cuadros: control.cuadros + 1 })}
              >
                Cuadro +1
              </button>
              <button
                type="button"
                className={control.huellas ? 'cam-boton activo' : 'cam-boton'}
                onClick={() => fijar({ huellas: !control.huellas })}
              >
                Huellas
              </button>
              <button type="button" className="cam-boton" onClick={reiniciar}>
                Reiniciar
              </button>
            </div>
          </section>

          {GRUPOS.map((g) => (
            <details key={g.id} className="cam-grupo" open={g.id === 'locomocion'}>
              <summary>{g.titulo}</summary>
              {g.ajustes.map((x) => (
                <Deslizador
                  key={x.clave}
                  nombre={x.nombre}
                  valor={g.objeto[x.clave] as number}
                  min={x.min}
                  max={x.max}
                  paso={x.paso}
                  onCambio={(v) => {
                    g.objeto[x.clave] = v;
                    // El ciclo toma su forma de caminar y de correr de las mismas velocidades.
                    if (g.id === 'locomocion' && x.clave === 'velMax')
                      L.PARAMETROS_CAMINATA.velCaminar = v;
                    if (g.id === 'locomocion' && x.clave === 'velCorrer')
                      L.PARAMETROS_CAMINATA.velCorrer = v;
                    render();
                  }}
                />
              ))}
            </details>
          ))}

          <div className="cam-fila">
            <button type="button" className="cam-boton activo" onClick={copiar}>
              {copiado ? 'Copiado' : 'Copiar valores'}
            </button>
            <button type="button" className="cam-boton" onClick={restaurar}>
              Valores iniciales
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
