import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EQUIPO_EJEMPLO } from '@oficina/agentes';
import type { PresenciaConversacion } from '@oficina/agentes';
import {
  accionesDe,
  crearFuenteSimulada,
  crearMando,
  escenarioPorId,
  fijarDestino,
  puntoDeReunion,
} from '@oficina/motor';
import type { Accion, AccionHablar, AccionSentarse, Proyector } from '@oficina/motor';
import { AvisoHablar } from './AvisoHablar';
import { Barra } from './Barra';
import type { ResultadoEnvio } from './Barra';
import { Burbuja } from './Burbuja';
import { Escena } from './Escena';
import { Marca } from './Marca';
import { PanelPresencia } from './PanelPresencia';
import { crearAlmacen, useAlmacen } from './almacen';
import { salud } from './cliente';
import { DEPARTAMENTOS_SALA, agentesDeEquipo } from './equipo';
import { buscarMencion } from './mencion';
import { presenciaSimulada, PARAMETROS_PRESENCIA_SIMULADA } from './presenciaSimulada';
import { PARAMETROS_PROXIMIDAD, distancia } from './proximidad';
import type { PlanoXZ } from './proximidad';
import { useConversacion } from './useConversacion';
import './estilos.css';

const ESCENARIO = escenarioPorId('oficina');
const ENTRADA = ESCENARIO.entradas[0];
const IDS = EQUIPO_EJEMPLO.map((d) => d.id);

/** Personas simuladas de la sala; la primera «conversa» con Lienzo en ciclos (ver `presenciaSimulada.ts`). */
const PERSONAS = ['Camila', 'Tomás', 'Ivana', 'Joaquín', 'Renata', 'Matías'].map((nombre, i) => ({
  id: `sim-${i + 1}`,
  nombre,
}));
const CONVERSADORA = PERSONAS[0];
const AGENTE_DE_LA_CONVERSADORA = 'disenadora';

declare global {
  interface Window {
    /** Para automatizar y medir (Playwright). */
    __agentes?: {
      abrir: (id: string) => void;
      cerrar: () => void;
      enviar: (texto: string) => Promise<void>;
      mencionar: (texto: string) => Promise<void>;
      estado: () => unknown;
      ultimaMedicion: () => unknown;
      avatar: { x: number; y: number; z: number };
      ir: (x: number, z: number) => void;
      posicionesAgentes: () => Record<string, PlanoXZ | null>;
      agentes: string[];
    };
  }
}

const enCampoDeTexto = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

export function Sala() {
  const almacen = useMemo(() => crearAlmacen(), []);
  const conversador = useConversacion(almacen, EQUIPO_EJEMPLO);
  const agentesBase = useMemo(() => agentesDeEquipo(EQUIPO_EJEMPLO), []);
  const hablandoIds = useMemo(() => new Set<string>(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const agenteAbierto = useAlmacen(almacen, (e) => e.agenteId);

  // --- personas simuladas ---
  const fuente = useMemo(
    () =>
      crearFuenteSimulada({
        cantidad: 0,
        semilla: 11,
        altas: PERSONAS,
        puntoLibre: (azar, i) => puntoDeReunion(ESCENARIO, i, azar),
        y: ENTRADA?.y ?? 0,
        asientos: accionesDe(ESCENARIO).filter((a): a is AccionSentarse => a.tipo === 'sentarse'),
      }),
    [],
  );
  useEffect(() => {
    let raf = 0;
    let anterior = performance.now();
    const paso = (t: number) => {
      fuente.avanzar(Math.min((t - anterior) / 1000, 0.1));
      anterior = t;
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [fuente]);

  // --- avatar propio ---
  const mando = useMemo(() => crearMando(), []);
  const posAvatar = useRef({
    x: ENTRADA?.x ?? 0,
    y: ENTRADA?.y ?? 0,
    z: ENTRADA?.z ?? 0,
    rumbo: 0,
  });
  const avatar = useMemo(
    () => ({
      id: 'avatar-propio',
      nombre: 'Tú',
      x: ENTRADA?.x ?? 0,
      z: ENTRADA?.z ?? 0,
      mando,
      alCambiar: (e: {
        x: number;
        y: number;
        z: number;
        rumbo: number;
        asiento: string | null;
      }) => {
        posAvatar.current.x = e.x;
        posAvatar.current.y = e.y;
        posAvatar.current.z = e.z;
        posAvatar.current.rumbo = e.rumbo;
        fuente.ocupar(e.asiento);
      },
    }),
    [mando, fuente],
  );

  const abrirCerca = useCallback(
    (id: string) => {
      conversador.abrir(id, 'cerca');
      inputRef.current?.focus();
    },
    [conversador],
  );
  const accionesExtra = useMemo<AccionHablar[]>(
    () =>
      EQUIPO_EJEMPLO.map((agente) => ({
        id: `hablar:${agente.id}`,
        agenteId: agente.id,
        tipo: 'hablar',
        nombre: agente.nombre,
        x: 0,
        // Sin posición conocida aún, la acción queda fuera de cualquier planta.
        y: Infinity,
        z: 0,
        radio: PARAMETROS_PROXIMIDAD.radioEntra,
        alEjecutar: () => abrirCerca(agente.id),
      })),
    [abrirCerca],
  );
  const [cercano, setCercano] = useState<string | null>(null);
  const cercanoRef = useRef<string | null>(null);

  // --- el motor: proyector y acción a mano (E) ---
  const proyector = useRef<Proyector | null>(null);
  const alProyector = useCallback((p: Proyector) => {
    proyector.current = p;
  }, []);
  const alAccionCercana = useCallback((a: Accion | null) => {
    const id = a?.tipo === 'hablar' ? a.agenteId : null;
    cercanoRef.current = id;
    setCercano(id);
  }, []);

  // --- cercanía (~10 Hz, no por cuadro) ---
  const posiciones = useRef<Record<string, PlanoXZ | null>>({});
  const [marcaVisible, setMarcaVisible] = useState(false);
  useEffect(() => {
    const evaluar = () => {
      const proy = proyector.current;
      if (!proy) return;
      const a = posAvatar.current;
      for (const accion of accionesExtra) {
        const posicion = proy.mundo(accion.agenteId);
        posiciones.current[accion.agenteId] = posicion;
        accion.y = posicion?.y ?? Infinity;
        if (posicion) {
          accion.x = posicion.x;
          accion.z = posicion.z;
        }
      }
      const { radioSale } = PARAMETROS_PROXIMIDAD;
      // Una conversación abierta por cercanía se cierra al alejarse.
      const e = almacen.leer();
      const suya = e.agenteId ? posiciones.current[e.agenteId] : null;
      if (e.fase !== 'cerrada' && e.via === 'cerca' && suya && distancia(suya, a) > radioSale) {
        conversador.cerrar();
      }
      // La marca «conversando con …» se ve desde cerca.
      const pc = posiciones.current[AGENTE_DE_LA_CONVERSADORA];
      setMarcaVisible(!!pc && distancia(pc, a) <= PARAMETROS_PRESENCIA_SIMULADA.radioMarca);
    };
    const t = setInterval(evaluar, PARAMETROS_PROXIMIDAD.intervaloMs);
    return () => clearInterval(t);
  }, [almacen, conversador, accionesExtra]);

  // --- presencia simulada: alguien conversa con Lienzo en ciclos ---
  const [presenciaOtra, setPresenciaOtra] = useState<PresenciaConversacion | null>(null);
  useEffect(() => {
    if (!CONVERSADORA) return;
    const t = setInterval(() => {
      setPresenciaOtra((ant) =>
        presenciaSimulada(AGENTE_DE_LA_CONVERSADORA, CONVERSADORA.id, Date.now(), ant),
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // --- abrir y enviar ---
  const abrirPorMencion = useCallback(
    (id: string) => {
      conversador.abrir(id, 'mencion');
      inputRef.current?.focus();
    },
    [conversador],
  );
  /**
   * Enruta lo escrito: con @Nombre va a ese agente (aunque esté lejos); si no, al de la conversación abierta.
   * `promesa` se resuelve al terminar el turno.
   */
  const enrutar = useCallback(
    (texto: string): { resultado: ResultadoEnvio; promesa: Promise<void> } => {
      const mencion = buscarMencion(texto, EQUIPO_EJEMPLO);
      if (mencion) {
        conversador.abrir(mencion.agente.id, 'mencion');
        if (mencion.texto === '') {
          almacen.despachar({ tipo: 'escribir', texto: '' });
          return { resultado: 'ok', promesa: Promise.resolve() };
        }
        return { resultado: 'ok', promesa: conversador.enviar(mencion.texto) };
      }
      if (almacen.leer().agenteId) return { resultado: 'ok', promesa: conversador.enviar(texto) };
      return { resultado: 'sin-destino', promesa: Promise.resolve() };
    },
    [almacen, conversador],
  );
  const desdeLaBarra = useCallback(
    (texto: string): ResultadoEnvio => enrutar(texto).resultado,
    [enrutar],
  );

  // --- atajos: Enter escribe, Esc cierra; el motor ejecuta E ---
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || enCampoDeTexto(e.target)) return;
      if (e.code === 'Enter' && !(e.target as HTMLElement | null)?.closest('button')) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.code === 'Escape' && almacen.leer().fase !== 'cerrada') {
        conversador.cerrar();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [almacen, conversador]);

  const cerrarYSoltarFoco = useCallback(() => {
    conversador.cerrar();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [conversador]);

  // --- teclado móvil: la barra sube con `visualViewport` ---
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const ajustar = () => {
      const tapado = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      document.documentElement.style.setProperty('--teclado', `${Math.round(tapado)}px`);
    };
    ajustar();
    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
    return () => {
      vv.removeEventListener('resize', ajustar);
      vv.removeEventListener('scroll', ajustar);
    };
  }, []);

  // --- estado del servidor (una línea discreta en la ayuda) ---
  const [servidor, setServidor] = useState<'ok' | 'sin-clave' | 'caido' | null>(null);
  useEffect(() => {
    salud()
      .then((s) => setServidor(s.clave ? 'ok' : 'sin-clave'))
      .catch(() => setServidor('caido'));
  }, []);

  // --- medición para automatizar ---
  useEffect(() => {
    window.__agentes = {
      abrir: (id) => abrirPorMencion(id),
      cerrar: () => conversador.cerrar(),
      enviar: (texto) => conversador.enviar(texto),
      mencionar: (texto) => enrutar(texto).promesa,
      estado: () => {
        const e = almacen.leer();
        const hist = e.agenteId ? e.historial[e.agenteId] : undefined;
        return {
          fase: e.fase,
          agenteId: e.agenteId,
          via: e.via,
          cercano: cercanoRef.current,
          ultimo: hist?.at(-1) ?? null,
        };
      },
      ultimaMedicion: () => conversador.ultimaMedicion(),
      avatar: posAvatar.current,
      ir: (x, z) => fijarDestino(mando, x, z),
      posicionesAgentes: () => ({ ...posiciones.current }),
      agentes: IDS,
    };
  }, [almacen, conversador, abrirPorMencion, enrutar, mando]);

  const nombreCercano = EQUIPO_EJEMPLO.find((d) => d.id === cercano)?.nombre ?? null;
  const mostrarAviso = nombreCercano !== null && agenteAbierto !== cercano;
  const mostrarMarca =
    presenciaOtra !== null && marcaVisible && agenteAbierto !== AGENTE_DE_LA_CONVERSADORA;

  return (
    <div className="sala">
      <div className="sala-escena">
        <Escena
          almacen={almacen}
          accionesExtra={accionesExtra}
          agentesBase={agentesBase}
          departamentos={DEPARTAMENTOS_SALA}
          fuente={fuente}
          avatar={avatar}
          hablandoIds={hablandoIds}
          agenteOcupadoPorOtro={presenciaOtra?.agenteId ?? null}
          alProyector={alProyector}
          alAccionCercana={alAccionCercana}
          alHablarAgente={abrirPorMencion}
        />
      </div>

      <header className="ayuda">
        <h1>Jules Room</h1>
        <p className="ayuda-teclas">
          <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> mover · <kbd>E</kbd> hablar ·{' '}
          <kbd>Enter</kbd> escribir · <kbd>Esc</kbd> cerrar
        </p>
        <p>Dato, Lienzo y Guía son agentes de ejemplo.</p>
        {servidor === 'sin-clave' && (
          <p>El servidor no tiene clave: los agentes responderán con su aviso.</p>
        )}
        {servidor === 'caido' && <p>Sin conexión con el servidor de agentes.</p>}
      </header>

      <PanelPresencia almacen={almacen} />

      {mostrarMarca && CONVERSADORA && (
        <Marca
          agenteId={AGENTE_DE_LA_CONVERSADORA}
          nombre={CONVERSADORA.nombre}
          proyector={proyector}
        />
      )}
      <Burbuja
        almacen={almacen}
        definiciones={EQUIPO_EJEMPLO}
        proyector={proyector}
        avatar={posAvatar}
        alCerrar={cerrarYSoltarFoco}
        alReintentar={() => void conversador.reintentar()}
      />
      <AvisoHablar
        nombre={mostrarAviso ? nombreCercano : null}
        alAbrir={() => cercano && abrirCerca(cercano)}
      />
      <Barra
        almacen={almacen}
        definiciones={EQUIPO_EJEMPLO}
        inputRef={inputRef}
        alEnviar={desdeLaBarra}
        alCerrar={cerrarYSoltarFoco}
        alDetener={conversador.detener}
      />
    </div>
  );
}
