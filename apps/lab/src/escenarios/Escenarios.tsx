import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Oficina,
  crearFuenteSimulada,
  accionesDe,
  crearMando,
  definicionAProps,
  ejemploEquipo,
  escenarioPorId,
  fijarDestino,
  listarEscenarios,
  puntoDeReunion,
} from '@oficina/motor';
import type {
  Accion,
  AccionSentarse,
  FuentePresencia,
  Proyector,
  PuntoPantalla,
} from '@oficina/motor';
import { agregarAgente } from '../editor';
import { resumir } from '../grafica/muestreo';
import type { ResumenCuadros } from '../grafica/muestreo';
import { RED_LIVEKIT, crearRedSimulada } from '../movimiento/redSimulada';
import { AvisoAccion } from './AvisoAccion';
import { ControlVista } from './ControlVista';
import { Selector } from './Selector';
import { alternarPanel, cerrar, estadoInicial, fijar, panelAbierto } from './paneles/abrir';
import { sonar } from '../creacion/sonido';
import { Paneles } from './paneles/Paneles';
import {
  escenarioInicial,
  mismaVista,
  parsearVista,
  propsDeVista,
  serializarVista,
  varianteInicial,
  vistaPorDefecto,
} from './vista';
import type { Vista } from './vista';
import './escenarios.css';

const param = (nombre: string, defecto: string) =>
  new URLSearchParams(window.location.search).get(nombre) ?? defecto;

const CALIDADES = ['auto', 'alta', 'media', 'baja'] as const;
type Calidad = (typeof CALIDADES)[number];

interface LecturaEscenarios extends ResumenCuadros {
  escenario: string;
  vista: string;
  ocupantes: number;
  ancho: number;
  alto: number;
}

declare global {
  interface Window {
    /** Para automatizar (medir.mjs): cambiar de escenario o vista y leer el costo de los cuadros. */
    __escenarios?: {
      escenarios: string[];
      zonas: string[];
      cambiarEscenario: (id: string) => void;
      /** Simula `onInteres` (abre o cierra un panel) sin mover el avatar. */
      interes: (id: string | null) => void;
      cambiarVista: (texto: string) => void;
      reiniciar: () => void;
      leer: () => LecturaEscenarios;
      /** Posición del avatar propio; `y`: altura de los pies. */
      avatar: { x: number; y: number; z: number };
      /** Como un clic al piso: el avatar propio va a (x, z). */
      ir: (x: number, z: number, y?: number) => void;
      /** Id de la acción a mano del avatar (la del aviso «E · …»), o `null`. */
      accion: () => string | null;
      ocupantes: number;
    };
  }
}

/** Agentes de ejemplo: la definición del equipo más los que hagan falta hasta `total`. */
function agentesDeEjemplo(total: number) {
  let definicion = ejemploEquipo;
  const agentes = () => definicion.ocupantes.filter((o) => o.tipo === 'agente').length;
  for (let i = 0; agentes() < total; i++) {
    definicion = agregarAgente(definicion);
    const nuevo = definicion.ocupantes[definicion.ocupantes.length - 1];
    const deptos = definicion.departamentos;
    if (nuevo?.tipo === 'agente' && deptos.length > 0) {
      nuevo.departamento = deptos[i % deptos.length]?.id ?? nuevo.departamento;
      nuevo.estado = i % 3 === 0 ? 'libre' : 'trabajando';
    }
  }
  const props = definicionAProps(definicion);
  return { ...props, agentes: props.agentes.slice(0, total) };
}

/** Página de escenarios: elige la plantilla de sala, la vista de cámara y recorre sus paneles. */
export function Escenarios() {
  const [id, setId] = useState(() =>
    escenarioInicial(
      param('escenario', ''),
      listarEscenarios().map((e) => e.id),
    ),
  );
  const escenario = useMemo(() => escenarioPorId(id), [id]);
  // Sin variante elegida, el motor usa la primera del escenario.
  const [varianteId, setVarianteId] = useState<string | undefined>(() =>
    varianteInicial(
      param('variante', ''),
      escenarioPorId(id).variantes.map((v) => v.id),
    ),
  );
  const [vista, setVista] = useState<Vista>(() =>
    parsearVista(
      param('vista', vistaPorDefecto(window.innerWidth, window.innerHeight)),
      escenarioPorId(id).vistas.zonas.map((z) => z.id),
    ),
  );
  const [reinicioVista, setReinicioVista] = useState(0);
  const [estadoPanel, setEstadoPanel] = useState(estadoInicial);
  const proyector = useRef<Proyector | null>(null);
  const [origenPanel, setOrigenPanel] = useState<PuntoPantalla | null>(null);

  const nAgentes = Number(param('ag', '18'));
  const nSimuladas = Number(param('sim', '25'));
  const conRed = param('red', '1') === '1';
  const calidad = (
    (CALIDADES as readonly string[]).includes(param('calidad', 'auto'))
      ? param('calidad', 'auto')
      : 'auto'
  ) as Calidad;

  const props = useMemo(() => agentesDeEjemplo(nAgentes), [nAgentes]);

  // Las personas simuladas se recrean con el paseo del escenario: así se reubican al cambiarlo.
  const entrada = escenario.entradas[0];
  const base = useMemo(
    () =>
      crearFuenteSimulada({
        cantidad: nSimuladas,
        semilla: 1,
        puntoLibre: (azar, i) => puntoDeReunion(escenario, i, azar),
        y: entrada?.y ?? 0,
        asientos: accionesDe(escenario).filter((a): a is AccionSentarse => a.tipo === 'sentarse'),
      }),
    [nSimuladas, escenario, entrada],
  );
  const red = useMemo(() => (conRed ? crearRedSimulada(base, RED_LIVEKIT) : null), [base, conRed]);
  useEffect(() => {
    let rafId = 0;
    let anterior = performance.now();
    const paso = (t: number) => {
      const dt = Math.min((t - anterior) / 1000, 0.1);
      anterior = t;
      base.avanzar(dt);
      red?.avanzar(dt);
      rafId = requestAnimationFrame(paso);
    };
    rafId = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(rafId);
  }, [base, red]);
  const fuente: FuentePresencia = red ?? base;

  const mando = useMemo(() => crearMando(), []);
  const posAvatar = useRef({ x: 0, y: 0, z: 0 });
  const posturaAnterior = useRef(false);
  const [sentado, setSentado] = useState(false);
  // Un avatar nuevo por escenario: vuelve a la entrada del escenario al cambiarlo.
  const avatar = useMemo(
    () => ({
      id: 'avatar-propio',
      nombre: 'Tú',
      // `?x=…&z=…` coloca el avatar ahí (para grabar un tramo del mundo); sin ellos, en la entrada.
      x: Number(param('x', String(entrada?.x ?? 0))),
      z: Number(param('z', String(entrada?.z ?? 0))),
      mando,
      alCambiar: (e: {
        x: number;
        y: number;
        z: number;
        asiento: string | null;
        estado: 'de-pie' | 'sentado';
      }) => {
        posAvatar.current.x = e.x;
        posAvatar.current.y = e.y;
        posAvatar.current.z = e.z;
        const ahoraSentado = e.estado === 'sentado';
        if (posturaAnterior.current !== ahoraSentado) sonar('paso');
        posturaAnterior.current = ahoraSentado;
        // Las simuladas no se sientan donde está el avatar.
        base.ocupar(e.asiento);
        // ...ni lo atraviesan al pasear.
        base.evitar({ x: e.x, y: e.y, z: e.z });
        setSentado(e.estado === 'sentado');
      },
    }),
    [entrada, mando, base],
  );

  const [accion, setAccion] = useState<Accion | null>(null);
  const accionActual = useRef<Accion | null>(null);
  const alAccionCercana = useCallback((a: Accion | null) => {
    accionActual.current = a;
    setAccion(a);
  }, []);

  const alInteres = useCallback(
    (idInteres: string | null) => {
      if (!idInteres) return;
      const a = accionesDe(escenario).find((a) => a.tipo === 'abrir' && a.interes === idInteres);
      setOrigenPanel(
        a ? (proyector.current?.({ x: a.x, y: a.y ?? posAvatar.current.y, z: a.z }) ?? null) : null,
      );
      setEstadoPanel((e) => alternarPanel(e, idInteres));
      sonar('paso');
    },
    [escenario],
  );
  const alFijar = useCallback((f: boolean) => setEstadoPanel((e) => fijar(e, f)), []);
  const alCerrar = useCallback(() => setEstadoPanel(cerrar()), []);

  const cambiarVista = useCallback((v: Vista) => {
    setVista((actual) => (mismaVista(actual, v) ? actual : v));
    // «General» y las zonas devuelven la cámara a su encuadre aunque ya estuviera en esa vista.
    if (v !== 'seguir') setReinicioVista((n) => n + 1);
  }, []);
  const cambiarEscenario = useCallback((nuevo: string) => {
    setId(nuevo);
    setVarianteId(undefined);
    setVista('general');
    setReinicioVista((n) => n + 1);
    setEstadoPanel(estadoInicial);
  }, []);

  // La URL refleja el escenario y la vista sin recargar.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('escenario', id);
    url.searchParams.set('vista', serializarVista(vista));
    if (varianteId) url.searchParams.set('variante', varianteId);
    else url.searchParams.delete('variante');
    window.history.replaceState(null, '', url);
  }, [id, vista, varianteId]);

  // Atajos: G general, F seguirme (sin pisar escritura ni combinaciones).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === 'g') cambiarVista('general');
      else if (k === 'f') cambiarVista('seguir');
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [cambiarVista]);

  // Medición: cuadros desde el propio requestAnimationFrame, igual que la página de gráfica.
  const cuadros = useRef<number[]>([]);
  useEffect(() => {
    let rafId = 0;
    let anterior = 0;
    const paso = (t: number) => {
      if (anterior) cuadros.current.push(t - anterior);
      if (cuadros.current.length > 20_000) cuadros.current.shift();
      anterior = t;
      rafId = requestAnimationFrame(paso);
    };
    rafId = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(rafId);
  }, []);
  const ocupantes = props.agentes.length + nSimuladas;
  const ultimo = useRef({ id, vista, ocupantes });
  ultimo.current = { id, vista, ocupantes };
  useEffect(() => {
    window.__escenarios = {
      escenarios: listarEscenarios().map((e) => e.id),
      zonas: escenario.vistas.zonas.map((z) => z.id),
      cambiarEscenario,
      interes: alInteres,
      cambiarVista: (texto) =>
        cambiarVista(
          parsearVista(
            texto,
            escenario.vistas.zonas.map((z) => z.id),
          ),
        ),
      reiniciar: () => {
        cuadros.current = [];
      },
      leer: () => ({
        ...resumir(cuadros.current),
        escenario: ultimo.current.id,
        vista: serializarVista(ultimo.current.vista),
        ocupantes: ultimo.current.ocupantes,
        ancho: window.innerWidth,
        alto: window.innerHeight,
      }),
      avatar: posAvatar.current,
      ir: (x, z, y = Number.NaN) => fijarDestino(mando, x, z, false, y),
      accion: () => accionActual.current?.id ?? null,
      ocupantes,
    };
  }, [escenario, cambiarEscenario, alInteres, cambiarVista, ocupantes, mando]);

  const lista = listarEscenarios();
  return (
    <div className="esc">
      <div className="esc-escena">
        <Oficina
          agentes={props.agentes}
          departamentos={props.departamentos}
          horaChile={props.horaChile}
          escenario={id}
          variante={varianteId}
          calidad={calidad}
          fuentePresencia={fuente}
          avatarPropio={avatar}
          vistaGeneral={reinicioVista}
          corteCamara={reinicioVista}
          onInteres={alInteres}
          interesesPorCercania={false}
          onProyector={(p) => {
            proyector.current = p;
          }}
          onAccionCercana={alAccionCercana}
          {...propsDeVista(vista)}
        />
      </div>
      <div className="esc-barra">
        <Selector
          etiqueta="Escenario"
          opciones={lista.map((e) => ({
            valor: e.id,
            etiqueta: e.nombre,
            descripcion: e.descripcion,
          }))}
          valor={id}
          alCambiar={cambiarEscenario}
        />
        <Selector
          etiqueta="Variante"
          opciones={escenario.variantes.map((v) => ({ valor: v.id, etiqueta: v.nombre }))}
          valor={varianteId ?? escenario.variantes[0]?.id ?? null}
          alCambiar={setVarianteId}
        />
        <ControlVista vista={vista} zonas={escenario.vistas.zonas} alCambiar={cambiarVista} />
      </div>
      <p className="esc-ayuda">
        <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> mover · <kbd>E</kbd> sentarse / abrir ·{' '}
        <kbd>G</kbd> general · <kbd>F</kbd> seguirme
      </p>
      <AvisoAccion
        accion={accion}
        sentado={sentado}
        abierto={accion?.tipo === 'abrir' && panelAbierto(estadoPanel, accion.interes)}
        alAccion={() => {
          mando.acciones = (mando.acciones ?? 0) + 1;
        }}
      />
      <Paneles estado={estadoPanel} origen={origenPanel} alFijar={alFijar} alCerrar={alCerrar} />
    </div>
  );
}
