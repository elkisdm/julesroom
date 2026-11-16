import { CargaInvitada } from './envivo/CargaInvitada';
import './envivo/carga-invitada.css';
import { listarSalas } from '@oficina/motor';
import { recuperarSala, migrarSalaAnterior } from './envivo/recuperacion';
import { pasoInvitado, personajeRapido } from './envivo/entradaInvitada';
import { mezclarSala } from './envivo/protocolo';
import { accionesDeObjetos } from './construir/asientosObjetos';
/**
 * Crear tu sala y construir dentro de ella. Un Canvas vive durante todo el recorrido;
 * el selector conserva sus mundos preparados dentro del mismo renderer.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Oficina,
  accionesDe,
  aDefinicion,
  aplicarAjustes,
  crearMando,
  definicionAProps,
  escenarioPorId,
  fijarPantalla,
  fijarDestino,
} from '@oficina/motor';
import type {
  Accion,
  Atuendo,
  ContenidoPantalla,
  ObjetoColocado,
  Proyector,
  PuntoPantalla,
  SalaGuardada,
  Solido,
  Superficie,
} from '@oficina/motor';
import { AvisoAccion } from '../escenarios/AvisoAccion';
import { Entrada } from './Entrada';
import { Dentro } from './Dentro';
import { useConstruir } from './construir/useConstruir';
import { precargarTrasLlegada } from './precargaModulos';
import { useMobiliario } from './construir/useMobiliario';
import { EncuadreConstruir } from './construir/EncuadreConstruir';
import { elegirVariante, varianteActiva } from './construir/variantes';
import { contenidosDePantallas } from './construir/contenidos';
import { ID_YO, atuendoInicial, conPlantilla, puedeConstruir, salaNueva } from './plantillas';
import { useSala } from './useSala';
import { Presentacion } from './envivo/presentacion/Presentacion';
import { entradaDe, puntoDeAparicion } from './aparicion';
import { misionesIniciales } from './misiones';
import { sonar } from './sonido';
import './crear.css';
import './construir/construir-telefono.css';
import type { ControlVestidor } from './pasos/Vestidor3D';

const Vestidor3D = lazy(() =>
  import('./pasos/Vestidor3D').then((m) => ({ default: m.Vestidor3D })),
);
const PanelConstruir = lazy(() =>
  import('./construir/PanelConstruir').then((m) => ({ default: m.PanelConstruir })),
);
const EscenaObjetosDentro = lazy(() =>
  import('./construir/EscenaObjetosDentro').then((m) => ({ default: m.EscenaObjetosDentro })),
);
const Paneles = lazy(() =>
  import('../escenarios/paneles/Paneles').then((m) => ({ default: m.Paneles })),
);
import { conVestidor, vistaPorPaso } from './pasos/estadoPersonaje';
import { EscenaMundos, usePrecargaMundos } from './pasos/EscenaMundos';
import { salaDeFondo } from './pasos/bancosInactivos';
import { navegarMundo } from './pasos/mundos';
import { PARAMETROS_FLUJO, seleccionarAgentes, zonaDeAgentes } from './pasos/estadoFlujo';
import { TransicionFlujo } from './pasos/TransicionFlujo';
import type { CSSProperties } from 'react';
import { useInteraccionFisica } from './useInteraccionFisica';
import { alternarPanel, estadoInicial, fijar, panelAbierto } from '../escenarios/paneles/abrir';
import { MedidorDrawCalls } from './MedidorDrawCalls';
import { useEnVivo } from './envivo/useEnVivo';
import { salaEnVivo } from './envivo/sinServidor';
import { Presencia } from './envivo/Presencia';
import { PizarraViva } from './envivo/pizarra/PizarraViva';
import { Conversacion } from './envivo/Conversacion';
import { Momentos } from './envivo/momentos/Momentos';
import './envivo/envivo.css';

export type Paso = 'llegada' | 'sala' | 'nombre' | 'personaje' | 'agentes' | 'invitar' | 'dentro';

export interface EstadoAvatar {
  x: number;
  y: number;
  z: number;
  velocidad: number;
  estado: 'de-pie' | 'sentado';
}

declare global {
  interface Window {
    /** Para recorrer la página con Playwright. */
    __crear?: {
      paso: () => Paso;
      construyendo: () => boolean;
      sala: () => SalaGuardada | null;
      avatar: EstadoAvatar;
      lista: () => boolean;
      /** Como hacer clic en un agente. */
      hablar: (id: string) => void;
      drawCalls: () => number;
      accion: () => Accion | null;
      mundo: (id: string) => { x: number; y: number; z: number } | null;
      asientos: () => {
        id: string;
        x: number;
        y?: number;
        z: number;
        aproximacion: { x: number; y?: number; z: number };
      }[];
      ir: (x: number, z: number, correr?: boolean, y?: number) => void;
      colocarObjetos: (objetos: ObjetoColocado[]) => void;
      setPlantilla: (id: string) => void;
      entrarConstruir: () => void;
      contenidoPantalla: (pantallaId: string, contenido: string) => void;
      construir: () => void;
      aplicar: (sala: SalaGuardada) => void;
    };
  }
}

/** Sin objetos colocados: la misma referencia siempre, para no rehacer el suelo del escenario. */
const SIN_SUELO_EXTRA = { solidos: [] as Solido[], superficies: [] as Superficie[] };

const borrador = (): SalaGuardada =>
  salaNueva('trading', { nombre: '', equipo: '', tuNombre: '', atuendo: atuendoInicial(3) });

export function Crear() {
  const s = useSala();
  // La creación todavía no tiene documento de biblioteca; usa una identidad provisional.
  const [idConexion, setIdConexion] = useState(() =>
    new URLSearchParams(location.search).has('sala')
      ? `invitacion-${crypto.randomUUID()}`
      : (s.salas[0]?.id ?? `borrador-${crypto.randomUUID()}`),
  );
  const idsConocidos = useRef(new Set(s.salas.map((sala) => sala.id)));
  useEffect(() => {
    if (new URLSearchParams(location.search).has('sala') || !s.salas[0]) return;
    const anteriores = Object.keys(localStorage).filter((k) => k.startsWith('demo/dueno/'));
    const anterior =
      sessionStorage.getItem('demo/sala') ??
      (s.salas.length === 1 && anteriores.length === 1
        ? anteriores[0]!.slice('demo/dueno/'.length)
        : null);
    migrarSalaAnterior(localStorage, idConexion, anterior);
  }, []);
  const [paso, setPaso] = useState<Paso>(
    new URLSearchParams(location.search).has('sala') ? 'nombre' : 'llegada',
  );
  // Mientras se crea, la sala vive aquí; al entrar pasa a `s` (guardada y con historia).
  const [enCreacion, setEnCreacion] = useState<SalaGuardada>(() => s.salaAlAbrir ?? borrador());
  const [agentesElegidos, setAgentesElegidos] = useState<string[] | null>(null);
  const idsAgentes =
    agentesElegidos ?? enCreacion.ocupantes.filter((o) => o.tipo === 'agente').map((o) => o.id);
  const sala =
    paso === 'dentro'
      ? (s.sala ?? enCreacion)
      : paso === 'invitar'
        ? seleccionarAgentes(enCreacion, idsAgentes)
        : enCreacion;
  // Configuración pública completa o servicios locales explícitos; sin ellos la sala es individual.
  const enVivo = salaEnVivo(import.meta.env);
  const porInvitacion = new URLSearchParams(location.search).has('sala');
  const vivo = useEnVivo(
    (paso === 'invitar' || paso === 'dentro' || (porInvitacion && paso === 'personaje')) && enVivo,
    sala,
    s.reemplazar,
    idConexion,
  );
  // Al autoguardar por primera vez, publica la relación bajo el id real de biblioteca.
  useEffect(() => {
    if (vivo.sesion.invitado || !vivo.sesion.dueno || paso !== 'dentro') return;
    const nueva = s.salas.find((sala) => !idsConocidos.current.has(sala.id));
    const viva = recuperarSala(localStorage, idConexion);
    if (nueva && viva) localStorage.setItem(`demo/guardada/${nueva.id}`, viva);
  }, [s.salas, vivo.sesion.invitado, vivo.sesion.dueno, paso, idConexion]);
  const publicarVivo = useRef(vivo.publicar);
  publicarVivo.current = vivo.publicar;
  const plantilla = sala.plano.plantilla;
  const plantillaEscenario = useMemo(() => escenarioPorId(plantilla), [plantilla]);
  const ajustesMuebles = sala.mundo.ajustesMuebles;
  const escenario = useMemo(() => {
    if (!ajustesMuebles || Object.keys(ajustesMuebles).length === 0) return plantillaEscenario;
    return aplicarAjustes(plantillaEscenario, ajustesMuebles).escenario;
  }, [plantillaEscenario, ajustesMuebles]);
  const comparando = paso === 'llegada' || paso === 'sala';
  const fondoMotor = useRef(sala);
  fondoMotor.current = salaDeFondo(sala, fondoMotor.current, comparando);
  const salaMotor = fondoMotor.current;
  const props = useMemo(() => definicionAProps(aDefinicion(salaMotor)), [salaMotor]);
  const [cuadroVisible, setCuadroVisible] = useState('');
  const yo = sala.ocupantes.find((o) => o.id === ID_YO);
  const atuendo: Atuendo = yo?.atuendo ?? atuendoInicial(3);

  const precarga = usePrecargaMundos(plantilla, sala.mundo.variante, comparando);
  const lista = precarga.terminada;
  const entradaMedida = useRef(false);
  useEffect(() => {
    if (
      entradaMedida.current ||
      !vivo.sesion.invitado ||
      paso !== 'dentro' ||
      !vivo.recibida ||
      !lista
    )
      return;
    entradaMedida.current = true;
    performance.measure('d1-enlace-hasta-dentro', { start: 0, end: performance.now() });
  }, [paso, vivo.sesion.invitado, vivo.recibida, lista]);
  useEffect(() => {
    if (paso === 'llegada' && lista) return precargarTrasLlegada();
  }, [paso, lista]);
  const [sentado, setSentado] = useState(false);
  const plantillaVisible = salaMotor.plano.plantilla;

  // --- avatar propio ---
  const mando = useMemo(() => crearMando(), []);
  const pos = useRef<EstadoAvatar>({ x: 0, y: 0, z: 0, velocidad: 0, estado: 'de-pie' });
  const entrada = entradaDe(escenario.entradas, vivo.sesion.yo, vivo.sesion.invitado);
  // Ya caminó en esta sala: solo entonces `pos` vale como punto donde reaparecer.
  const colocado = useRef(false);
  const controlVestidor = useRef<ControlVestidor>({
    categoria: 0,
    giro: 0,
    arrastrando: false,
    miniaturas: {},
  });
  const primera = escenario.entradas[0];
  const posicionVestidor = { x: primera?.x ?? 0, y: primera?.y ?? 0, z: primera?.z ?? 0 };
  const conAvatar = paso === 'agentes' || paso === 'invitar' || paso === 'dentro';
  const ultimaPlantilla = useRef(plantilla);
  const avatar = useMemo(() => {
    // Al cambiar de ropa sigue donde estaba; al cambiar de sala, vuelve a la entrada.
    if (ultimaPlantilla.current !== plantilla) colocado.current = false;
    ultimaPlantilla.current = plantilla;
    const punto = puntoDeAparicion(colocado.current ? pos.current : null, entrada);
    return {
      id: vivo.sesion.yo,
      nombre: yo?.nombre || 'Tú',
      atuendo,
      x: punto.x,
      z: punto.z,
      mando,
      alCambiar: (e: EstadoAvatar & { asiento: string | null; rumbo: number }) => {
        publicarVivo.current({ ...e, saltos: mando.saltos });
        colocado.current = true;
        pos.current.x = e.x;
        pos.current.y = e.y;
        pos.current.z = e.z;
        pos.current.velocidad = e.velocidad;
        if (pos.current.estado !== e.estado) sonar('paso');
        pos.current.estado = e.estado;
        setSentado(e.estado === 'sentado');
      },
    };
  }, [plantilla, entrada, mando, JSON.stringify(atuendo), yo?.nombre, vivo.sesion.yo]);

  const [accion, setAccion] = useState<Accion | null>(null);
  const proyector = useRef<Proyector | null>(null);
  const drawCalls = useRef(0);
  const [agenteHablando, setAgenteHablando] = useState<string | null>(null);
  const [panel, setPanel] = useState(estadoInicial);
  const [origenPanel, setOrigenPanel] = useState<PuntoPantalla | null>(null);
  const [estadoMisiones, setEstadoMisiones] = useState(misionesIniciales);
  const misionesInterno = useRef(estadoMisiones);
  const [misionesCerradas, setMisionesCerradas] = useState(false);

  // --- construir ---
  const construible =
    !vivo.sesion.invitado &&
    (!vivo.publica || Boolean(vivo.sesion.dueno)) &&
    puedeConstruir(paso, plantilla);
  const escapeMobiliario = useRef<() => boolean>(() => false);
  const c = useConstruir({
    sala,
    escenario,
    aplicar: s.aplicar,
    activo: construible,
    proyector,
    consumirEscape: () => escapeMobiliario.current(),
  });
  const m = useMobiliario({
    sala,
    plantilla: plantillaEscenario,
    escenario,
    aplicar: s.aplicar,
    construyendo: c.construyendo,
    enMano: c.enMano !== null,
    seleccionObjeto: c.seleccion,
    limpiarObjeto: () => c.setSeleccion(null),
    alDeshacer: s.deshacer,
    alRehacer: s.rehacer,
  });
  escapeMobiliario.current = m.consumirEscape;
  const fisica = useInteraccionFisica(
    sala,
    proyector,
    pos.current,
    (id) => {
      setAgenteHablando(id);
      sonar('hablar');
    },
    paso === 'dentro' && !c.construyendo,
  );

  const abrirPanel = (id: string | null) => {
    if (!id) return;
    const objetivo = accionesDe(escenario).find((a) => a.tipo === 'abrir' && a.interes === id);
    setOrigenPanel(
      objetivo
        ? (proyector.current?.({ x: objetivo.x, y: objetivo.y ?? pos.current.y, z: objetivo.z }) ??
            null)
        : null,
    );
    setPanel((actual) => alternarPanel(actual, id));
    sonar('paso');
  };

  // --- cámara por paso ---
  const mesaAgentes = zonaDeAgentes(sala, escenario);
  const vista = vistaPorPaso(paso, c.construyendo, mesaAgentes);
  const pantallas = useMemo(
    () => contenidosDePantallas(escenario, sala.mundo.pantallas),
    [escenario, sala.mundo.pantallas],
  );

  const yPiso = escenario.entradas[0]?.y ?? 0;
  const accionesCatalogo = useMemo(
    () => [...(fisica.accionesExtra ?? []), ...accionesDeObjetos(sala.mundo.objetos, yPiso)],
    [fisica.accionesExtra, sala.mundo.objetos, yPiso],
  );
  const [sueloExtra, setSueloExtra] = useState<{ solidos: Solido[]; superficies: Superficie[] }>(
    SIN_SUELO_EXTRA,
  );
  useEffect(() => {
    if (paso !== 'dentro') {
      setSueloExtra(SIN_SUELO_EXTRA);
      return;
    }
    let vivo = true;
    void import('./construir/solidos').then((m) => {
      if (vivo) setSueloExtra(m.suelosDeObjetos(sala.mundo.objetos, yPiso));
    });
    return () => {
      vivo = false;
    };
  }, [paso, sala.mundo.objetos, yPiso]);
  // UNA sola fuente de la variante: `sala.mundo.variante`. La escribe la selección de mundo (en la
  // sala en creación, que pasa entera a la guardada al entrar) y la pestaña «Estilo» de construir.
  const varianteId = useMemo(
    () => varianteActiva(escenario, sala.mundo.variante),
    [escenario, sala.mundo.variante],
  );

  const ir = useCallback((p: Paso) => {
    sonar('paso');
    setPaso(p);
  }, []);

  const elegirPlantilla = useCallback(
    (id: string) => {
      if (id === plantilla) return;
      setEnCreacion((x) => (x.plano.plantilla === id ? x : conPlantilla(x, id)));
      setAgentesElegidos(null);
    },
    [plantilla],
  );

  const navegar = useCallback((direccion: number) => {
    setEnCreacion((x) => conPlantilla(x, navegarMundo(x.plano.plantilla, direccion)));
    setAgentesElegidos(null);
  }, []);

  const entrar = useCallback(
    (rapido = false) => {
      const propia = rapido
        ? personajeRapido(enCreacion, crypto.getRandomValues(new Uint32Array(1))[0]!)
        : enCreacion;
      const destino =
        vivo.sesion.invitado && vivo.recibida && s.sala
          ? mezclarSala(s.sala, propia)
          : seleccionarAgentes(propia, idsAgentes);
      s.reemplazar(destino, precarga.miniaturas[enCreacion.plano.plantilla]);
      setAgenteHablando(null);
      ir('dentro');
    },
    [enCreacion, idsAgentes, ir, s, vivo.sesion.invitado, vivo.recibida],
  );

  const abrirSala = (id: string) => {
    const resumen = s.salas.find((sala) => sala.id === id);
    const guardada = s.abrir(id, resumen && precarga.miniaturas[resumen.plantilla]);
    if (!guardada) return;
    setIdConexion(id);
    idsConocidos.current = new Set(s.salas.map((sala) => sala.id));
    setEnCreacion(guardada);
    setAgentesElegidos(null);
    ir('dentro');
  };
  const crearOtra = () => {
    if (!s.nueva()) return;
    setIdConexion(`borrador-${crypto.randomUUID()}`);
    idsConocidos.current = new Set(listarSalas(localStorage).salas.map((sala) => sala.id));
    setEnCreacion(borrador());
    setAgentesElegidos(null);
    ir('sala');
  };

  const colocarObjetos = useCallback(
    (objetos: ObjetoColocado[]) => {
      s.aplicar({ ...sala, mundo: { ...sala.mundo, objetos } });
    },
    [s, sala],
  );

  useEffect(() => {
    window.__crear = {
      paso: () => paso,
      construyendo: () => c.construyendo,
      sala: () => sala,
      avatar: pos.current,
      lista: () => lista,
      hablar: (id) => setAgenteHablando(id),
      drawCalls: () => drawCalls.current,
      accion: () => accion,
      mundo: (id) => proyector.current?.mundo(id) ?? null,
      asientos: () =>
        accionesDe(escenario)
          .filter((a) => a.tipo === 'sentarse')
          .map((a) => ({ id: a.id, x: a.x, y: a.y, z: a.z, aproximacion: a.asiento.aproximacion })),
      ir: (x, z, correr = false, y = Number.NaN) => fijarDestino(mando, x, z, correr, y),
      colocarObjetos,
      setPlantilla: elegirPlantilla,
      entrarConstruir: () => {
        if (paso === 'dentro' && construible) c.entrar();
      },
      contenidoPantalla: (pantallaId, contenido) => {
        const r = fijarPantalla(sala, pantallaId, contenido as ContenidoPantalla);
        if (r.ok) s.aplicar(r.sala);
      },
      construir: () => c.entrar(),
      aplicar: (siguiente) => s.aplicar(siguiente),
    };
  }, [paso, c.construyendo, sala, lista, colocarObjetos, elegirPlantilla, construible, c, s]);

  // Nombre y Tú comparten la escena del vestidor (composición de G): sin salto entre ambos.
  const vestidor = conVestidor(paso);
  return (
    <div
      className={`cr cr--${paso}${c.construyendo ? ' cr--construyendo' : ''}`}
      style={
        {
          '--fl-duracion': `${PARAMETROS_FLUJO.transicionSegundos}s`,
          '--fl-curva': PARAMETROS_FLUJO.curva,
        } as CSSProperties
      }
    >
      <div
        className={`cr-escena${lista ? ' cr-escena--lista' : ''}`}
        aria-hidden={paso !== 'dentro'}
      >
        <Oficina
          agentes={vestidor ? [] : props.agentes}
          fuentePresencia={vivo.fuente ?? undefined}
          hablandoIds={vivo.fuente?.hablandoIds}
          departamentos={props.departamentos}
          escenario={plantillaVisible}
          variante={salaMotor.mundo.variante}
          calidad="auto"
          avatarPropio={conAvatar ? avatar : undefined}
          vista={vista}
          seguirAvatar={vista === 'seguir'}
          derivaCamara={paso === 'llegada' || paso === 'sala' ? PARAMETROS_FLUJO.deriva : 0}
          contenidoPantallas={pantallas}
          solidosExtra={sueloExtra.solidos}
          superficiesExtra={sueloExtra.superficies}
          ajustesMuebles={plantillaVisible === plantilla ? ajustesMuebles : undefined}
          ajustesDibujo={plantillaVisible === plantilla ? m.ajustesDibujo : undefined}
          onProyector={(p) => {
            proyector.current = p;
          }}
          onAccionCercana={paso === 'dentro' && !c.construyendo ? setAccion : undefined}
          {...fisica}
          accionesExtra={accionesCatalogo}
          miradaAgentes={
            vivo.burbuja
              ? {
                  ...fisica.miradaAgentes,
                  [vivo.burbuja.agente]: {
                    x: vivo.burbuja.x,
                    y: vivo.burbuja.y + 1.5,
                    z: vivo.burbuja.z,
                  },
                }
              : Object.fromEntries(
                  Object.keys(fisica.miradaAgentes).map((id) => [id, vivo.sesion.yo]),
                )
          }
          gestoAgentes={
            vivo.burbuja?.fase === 'texto'
              ? { ...fisica.gestoAgentes, [vivo.burbuja.agente]: 'explicar' }
              : fisica.gestoAgentes
          }
          interesesPorCercania={false}
          onInteres={paso === 'dentro' && !c.construyendo ? abrirPanel : undefined}
          onHablarAgente={
            paso === 'dentro' && !c.construyendo
              ? (id) => fisica.accionesExtra?.find((a) => a.agenteId === id)?.alEjecutar()
              : undefined
          }
        >
          {/* Solo en desarrollo: lo leen los scripts de medición (`window.__crear.drawCalls`). */}
          {import.meta.env.DEV && <MedidorDrawCalls destino={drawCalls} />}
          {c.construyendo && plantillaVisible === plantilla && <EncuadreConstruir />}
          {paso === 'dentro' && (
            <Suspense fallback={null}>
              <EscenaObjetosDentro
                {...c.props3D}
                fantasma={c.fantasma ?? m.fantasma}
                alBajarPiso={m.alBajarPiso}
                arrastreActivo={m.arrastrando}
                huellaMarca={m.huella}
                alPuntero={(x, z, presionado) => {
                  c.props3D.alPuntero?.(x, z, presionado);
                  m.alPuntero(x, z);
                }}
                alSoltar={(x, z) => {
                  if (!m.alSoltar(x, z)) c.props3D.alSoltar?.(x, z);
                }}
              />
              {/* Montajes de la sala compartida, en orden: presentación (D3). */}
              <Presentacion
                fuente={vivo.fuente}
                sesion={vivo.sesion}
                proyector={proyector}
                avatar={pos.current}
                activo={!c.construyendo}
              />
            </Suspense>
          )}
          {vestidor && (
            <Suspense fallback={null}>
              <Vestidor3D atuendo={atuendo} control={controlVestidor} posicion={posicionVestidor} />
            </Suspense>
          )}
          <EscenaMundos
            escenario={escenario}
            trabajo={precarga.trabajo}
            estados={precarga.estados}
            alPresentar={setCuadroVisible}
            presentar={paso === 'sala' || paso === 'llegada'}
            explorar={paso === 'sala'}
            vestidor={vestidor}
            variante={varianteId}
            alNavegar={navegar}
          />
          <TransicionFlujo paso={paso} />
          {paso === 'dentro' && enVivo && (
            <Momentos fuente={vivo.fuente} sesion={vivo.sesion} sala={sala} proyector={proyector} />
          )}
          {paso === 'dentro' && <PizarraViva vivo={vivo} posicion={pos} escenario={escenario} />}
        </Oficina>
      </div>

      {paso !== 'dentro' && (
        <Entrada
          paso={paso}
          invitado={vivo.sesion.invitado}
          alEntrarYa={() => entrar(true)}
          enlace={enVivo ? vivo.sesion.enlace : null}
          personas={vivo.personas}
          demo={
            vivo.publica
              ? { error: vivo.error, llave: vivo.llaveDemo, alLlave: vivo.setLlaveDemo }
              : undefined
          }
          lista={lista}
          agentesElegidos={idsAgentes}
          alAgentes={setAgentesElegidos}
          precarga={precarga}
          miniaturas={precarga.miniaturas}
          cuadroVisible={cuadroVisible}
          variante={varianteId}
          alVariante={(id) => setEnCreacion((x) => elegirVariante(x, id))}
          sala={enCreacion}
          salas={s.salas}
          errorBiblioteca={s.errorGuardado ?? s.erroresAlAbrir.join('. ')}
          alAbrirSala={abrirSala}
          alCrearSala={crearOtra}
          alRenombrarSala={s.renombrar}
          alEliminarSala={s.eliminar}
          alCambiar={setEnCreacion}
          alElegirPlantilla={elegirPlantilla}
          alIr={(p) => {
            const destino = vivo.sesion.invitado ? pasoInvitado(p) : p;
            if (destino === 'dentro') entrar();
            else ir(destino);
          }}
          alEntrar={() => entrar()}
          proyector={proyector}
          controlVestidor={controlVestidor}
          posicionVestidor={posicionVestidor}
        />
      )}

      {paso !== 'llegada' && s.errorGuardado && (
        <p className="cr-aviso-guardado" role="alert">
          {s.errorGuardado}. Tu sala sigue abierta; libera espacio para conservarla.
        </p>
      )}
      {paso === 'dentro' && vivo.sesion.invitado && !vivo.error && (!vivo.recibida || !lista) && (
        <CargaInvitada nombre={vivo.nombreSala} anfitrion={vivo.anfitrion} />
      )}
      {paso === 'dentro' && !c.construyendo && (
        <button className="cr-boton cr-portada" onClick={() => ir('llegada')}>
          Mis salas
        </button>
      )}
      {paso === 'dentro' && !c.construyendo && (
        <>
          <Dentro
            misiones={{
              estado: estadoMisiones,
              setEstado: setEstadoMisiones,
              interno: misionesInterno,
              cerrada: misionesCerradas,
              setCerrada: setMisionesCerradas,
            }}
            sala={sala}
            escenario={escenario}
            avatar={pos.current}
            mando={mando}
            proyector={proyector}
            agenteHablando={agenteHablando}
            alConstruir={c.entrar}
            puedeConstruir={construible}
          />
          {enVivo && (
            <Presencia
              fuente={vivo.fuente}
              enlace={vivo.sesion.enlace}
              esperando={!vivo.recibida}
              dueno={vivo.sesion.dueno}
              invitado={vivo.sesion.invitado && Boolean(vivo.fuente)}
              errorConexion={vivo.error}
              publica={vivo.publica}
              llaveDemo={vivo.llaveDemo}
              alLlaveDemo={vivo.setLlaveDemo}
            />
          )}
          <Conversacion
            sala={sala}
            abierto={agenteHablando}
            cerrar={() => setAgenteHablando(null)}
            proyector={proyector}
            burbuja={vivo.burbuja}
            emitir={vivo.emitirBurbuja}
            conversacionId={vivo.sesion.yo}
            local={!enVivo || vivo.publica}
            posicion={pos.current}
          />
          <AvisoAccion
            accion={accion}
            sentado={sentado}
            abierto={accion?.tipo === 'abrir' && panelAbierto(panel, accion.interes)}
            alAccion={() => {
              mando.acciones = (mando.acciones ?? 0) + 1;
            }}
          />
          <Suspense fallback={null}>
            <Paneles
              estado={panel}
              origen={origenPanel}
              alFijar={(valor) => setPanel((p) => fijar(p, valor))}
              alCerrar={() => setPanel(estadoInicial)}
            />
          </Suspense>
        </>
      )}

      {paso === 'dentro' && c.construyendo && (
        <Suspense fallback={null}>
          <PanelConstruir
            c={c}
            m={m}
            sala={sala}
            escenario={escenario}
            guardado={s.guardado}
            errorGuardado={s.errorGuardado}
            puedeDeshacer={s.puedeDeshacer}
            puedeRehacer={s.puedeRehacer}
            alDeshacer={s.deshacer}
            alRehacer={s.rehacer}
            alAplicar={s.aplicar}
            alImportar={s.reemplazar}
          />
        </Suspense>
      )}
    </div>
  );
}
