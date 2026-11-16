import { MarcasD2 } from './MarcasD2';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, Vector3 } from 'three';
import type { WebGLRenderer } from 'three';
import { horaDeLuz } from '../ambiente/hora';
import { horaFijaDeVariante, resolverVariante } from '../escenarios/variantes';
import { catalogoBase } from '../catalogo/base';
import { paqueteHalloween } from '../catalogo/halloween';
import { crearCatalogo, registrarPaquete } from '../catalogo/registro';
import type { PresenciaAsistente } from '../animacion/presencia';
import type { FuentePresencia } from '../presencia/tipos';
import { escenarioPorId } from '../escenarios/registro';
import { aplicarAjustes, conSueloExtra } from '../escenarios/personalizacion';
import type { AjustesMuebles } from '../escenarios/personalizacion';
import type { Accion, Solido, Superficie } from '../escenarios/tipos';
import { decidirCalidad } from '../rendimiento/calidad';
import type { NivelCalidad } from '../rendimiento/calidad';
import { CONFIG_AJUSTE_INICIAL } from '../rendimiento/ajuste';
import type { ConfigAjuste } from '../rendimiento/ajuste';
import { crearControladorDpr, nivelInicialPorEquipo, proponerNivel } from '../rendimiento/ajuste';
import type { ControladorDpr } from '../rendimiento/ajuste';
import { tecnicasDe } from '../rendimiento/tecnicas';
import type { Tecnicas } from '../rendimiento/tecnicas';
import { frameloopPara } from '../rendimiento/visibilidad';
import type { AgenteOficina, Catalogo, Departamento, MetricasRender } from '../tipos';
import { resolverAtuendo } from '../vestuario/resolver';
import { atuendoPorRol } from '../vestuario/roles';
import type { GestoAgente, Rig } from './animador';
import { crearProyector } from './proyector';
import type { Proyector } from './proyector';
import { FOV_VERTICAL } from './camara';
import type { Punto3 } from './camara';
import { ContextoGrafica } from './contextoGrafica';
import { LOD_INICIAL } from './lod';
import { uniformesVolumen } from './volumen';
import './escenarios/DibujoMansion';
import { ContextoEscenario } from './escenarios/contexto';
import { UbicacionDeEscenario } from './escenarios/ubicar-contexto';
import { dibujoDe } from './escenarios/registroDibujo';
import { paletaLuz } from './casa/luz';
import { paletaConVariante } from './variante';
import { ControlesCamara } from './ControlesCamara';
import type { VistaOficina } from './ControlesCamara';
import { Acciones, crearEstadoAvatar, ejecutarAccionAvatar } from './Acciones';
import { Asistente } from './Asistente';
import { Etiquetas } from './Etiquetas';
import { Intereses } from './Intereses';
import { asignarPuestos, departamentosBase } from './layout';
import { Luces } from './Luces';
import { useMetricas } from './metricas';
import { Personas } from './Personas';
import type { AvatarPropio, RemotaDibujable } from './Personas';
import { ControlesAvatar } from './ControlesAvatar';
import { esEscritorio, hayWebGL, useReduceMotion } from './preferencias';
import { fijarAnisotropia, precalentarTexturas } from './texturas';
import { ZonasAmbiente } from './ZonasAmbiente';

export type { Proyector, PuntoPantalla, PosicionAgente } from './proyector';

export interface OficinaProps {
  agentes: AgenteOficina[];
  /** Objetivo externo de la mirada: id de persona o punto del mundo. Sin él se conserva la animación habitual. */
  miradaAgentes?: Record<string, string | Punto3>;
  /** Gesto externo mientras la entrada esté presente; reutiliza las poses del motor. */
  gestoAgentes?: Record<string, GestoAgente>;
  /** Acciones del anfitrión: compiten con las del escenario por una única pulsación de E. */
  accionesExtra?: readonly Accion[];
  onSeleccionar?: (id: string | null) => void;
  seleccionadoId?: string | null;
  /** `false` detiene el render (frameloop 'never'); al volver a `true` retoma. */
  visible?: boolean;
  /** Por defecto, los 6 departamentos del prototipo. */
  departamentos?: Departamento[];
  /** Id del escenario (plantilla de sala) registrado en el motor; por defecto `'mansion'`. */
  escenario?: string;
  /** Por defecto, base + Halloween. */
  catalogo?: Catalogo;
  /** Por defecto, la hora actual de America/Santiago. */
  horaChile?: Date;
  /**
   * Variante de luz y color del escenario (`Escenario.variantes`, por id); sin ella, la primera. Una
   * variante válida pone también la hora de la luz si no llega `horaChile`; una inválida avisa en consola.
   */
  variante?: string;
  /**
   * Las sombras reales del sol solo se activan con `'alta'` y puntero fino (escritorio);
   * en el resto cada persona lleva una sombra de contacto barata.
   */
  calidad?: 'auto' | 'alta' | 'media' | 'baja';
  /** Acerca la cámara a este agente (como en el vestidor) y vuelve al soltarlo (`null`). */
  enfocadoId?: string | null;
  /**
   * Ambiente del escenario al que se entró (id de `planta.ambientes`); `null` es la sala completa.
   * Controlado si llega; si no, la oficina lo lleva sola.
   */
  ambienteId?: string | null;
  /** Avisa al tocar un ambiente (`id`) o salir tocando fuera de la casa (`null`). */
  onAmbiente?: (id: string | null) => void;
  /**
   * Vista de la cámara: `'general'` (la del escenario, entera), `'seguir'` (sigue al avatar propio) o
   * `{ zona }` (encuadra esa zona de `Escenario.vistas.zonas`; si la zona es un ambiente de la planta,
   * también se entra a él). El cambio es suave. Si llega, manda sobre `seguirAvatar`, `ambienteId` y el
   * toque a ambientes; sin ella todo sigue como antes. Al cambiar de `escenario` la cámara corta a su general.
   */
  vista?: VistaOficina;
  /** Cada vez que cambia el número, la cámara vuelve a la vista general inicial (y se sale del ambiente y del enfoque). */
  vistaGeneral?: number;
  onMetricas?: (metricas: MetricasRender) => void;
  /** Qué hace Asistente: cambia el orbe (escucha, piensa, habla, espera). Por defecto `reposo`. */
  presenciaAsistente?: PresenciaAsistente;
  /** Volumen de la voz del asistente (0..1) mientras `hablando`; sin él, el pulso usa un ritmo sintético. */
  nivelVozAsistente?: number;
  /**
   * Deriva lenta de la cámara (rad/s de pico) para que ningún plano quede quieto: el azimut se
   * mece dentro de los límites del modo actual, solo mientras el usuario no toca la cámara y
   * sin `prefers-reduced-motion`. Sin ella (o con 0) la cámara no se mueve sola.
   */
  derivaCamara?: number;
  /** Nadie sale de la sala de su departamento (para recorridos narrados): sin café ni visitas fuera de ella. */
  retenerEnSala?: boolean;
  /**
   * Entrega una vez una función que proyecta a píxeles de la escena un punto 3D (`{x, y, z}` en
   * metros) o la cabeza de un agente (por id), con la cámara de ese instante. Devuelve `null` si
   * el agente no existe; `visible` es `false` si queda detrás de la cámara. Sirve para anclar
   * HTML (tarjetas, cursores) a la escena. `proyectar.mundo(id)` devuelve una copia de la posición
   * y el rumbo actuales de la raíz (también personas y avatar), o `null` si no existe.
   */
  onProyector?: (proyectar: Proyector) => void;
  /**
   * Con alguien enfocado, la cámara esquiva lo que le tapa la cara (muro, mueble alto u otra
   * persona): rodea por el azimut y, si no hay ángulo limpio, se acerca. Sin ella, el encuadre
   * es el de siempre.
   */
  encuadreLibre?: boolean;
  /** La cámara enfoca al asistente (cuerpo entero, en reposo en el atrio); `enfocadoId` se ignora. */
  enfocaAsistente?: boolean;
  /** Asistente mira directo a cámara en vez de en tres cuartos. */
  asistenteDeFrente?: boolean;
  /** Asistente se queda de pie, como personaje, en su sitio de reposo: no viaja ni se aparta de la cámara. */
  asistentePresente?: boolean;
  /** Cada vez que cambia, la cámara llega de golpe a su nuevo destino (corte) en vez de viajar. */
  corteCamara?: number;
  /**
   * Personas humanas presentes (otras personas del equipo, en vivo). La fuente entrega id,
   * atuendo, posición y rumbo; ver `FuentePresencia`. Se dibujan con el mismo esqueleto instanciado
   * que los agentes, sin un componente React que se actualice por cuadro.
   */
  fuentePresencia?: FuentePresencia | null;
  /**
   * Punto de enganche «hablarle a este agente»: se llama con el id cuando se selecciona un agente
   * (no una persona). El motor no abre conversaciones ni sabe de backend; lo hace quien lo use.
   */
  onHablarAgente?: (agenteId: string) => void;
  /**
   * Avatar propio controlable (teclado WASD/flechas y clic al piso para ir): se dibuja como una
   * persona más, responde en el mismo cuadro y avisa su posición cada cuadro por `alCambiar`.
   * Con avatar, el toque que entra a un ambiente queda desactivado: el clic al piso es «ir allí».
   */
  avatarPropio?: AvatarPropio;
  /** La cámara sigue al avatar propio (sin `vista`; con ella, `vista="seguir"`) (zona muerta, anticipación y brazo contra muros). */
  seguirAvatar?: boolean;
  /** Entrega una vez el renderizador de three, para medir (`gl.info`) desde fuera. */
  onRenderer?: (gl: WebGLRenderer) => void;
  /** Enciende o apaga técnicas gráficas sueltas por encima de lo que trae el nivel de calidad. */
  tecnicas?: Partial<Tecnicas>;
  /**
   * Ids de quien habla ahora: llevan contorno y su nombre se tiñe. Se lee en cada cuadro: puede
   * ser el mismo `Set` modificado en el lugar, sin renderizar de nuevo la oficina.
   */
  hablandoIds?: ReadonlySet<string>;
  /** Solo para medir: `sinCasa` omite la casa y sus ambientes para ver cuánto cuestan. */
  diagnostico?: { sinCasa?: boolean };
  /** Perfiles y umbrales de calidad; por defecto `CONFIG_AJUSTE_INICIAL`. */
  configAjuste?: ConfigAjuste;
  /**
   * Contenido de fuera para las pantallas del escenario (id de `Escenario.pantallas` → lienzo o video):
   * reemplaza el contenido de ejemplo de esa superficie. Puede cambiar en vivo.
   */
  contenidoPantallas?: Readonly<Record<string, HTMLCanvasElement | HTMLVideoElement>>;
  /**
   * Avisa el punto de interés del escenario (`Escenario.intereses`) que corresponde: al hacer clic en lo
   * que lo representa o, con avatar propio, al entrar en su radio; `null` al alejarse. La aplicación abre
   * el panel; el motor no dibuja paneles.
   */
  onInteres?: (id: string | null) => void;
  /** Desactiva la apertura por cercanía cuando la aplicación requiere confirmar con E o toque. */
  interesesPorCercania?: boolean;
  /**
   * Avisa la acción del escenario (`accionesDe`) o de `accionesExtra` que el avatar tiene a mano:
   * sentarse, abrir un panel o hablar (`E`); `null` cuando no hay ninguna o ya está sentado. La aplicación dibuja el aviso
   * («E · sentarse», ver `ETIQUETA_ACCION`); el motor ejecuta la tecla E y el clic en el asiento.
   */
  onAccionCercana?: (accion: Accion | null) => void;
  /**
   * Objetos 3D de la aplicación dibujados dentro de la escena (mismo lienzo, misma luz y el escenario activo
   * por `useEscenario()`): lo que la persona coloca en el modo construir, guías, «fantasmas».
   */
  children?: ReactNode;
  /**
   * Sólidos y superficies pisables que se suman al suelo del escenario activo (lo que coloca el modo
   * construir): bloquean y se pisan como los del escenario, también al navegar con un clic. El mundo del
   * avatar se rehace cuando cambia la IDENTIDAD de estos arreglos: pásalos estables (memorizados), no
   * literales nuevos en cada render.
   */
  solidosExtra?: Solido[];
  superficiesExtra?: Superficie[];
  /**
   * Muebles de la plantilla movidos o quitados (`mundo.ajustesMuebles`). La colisión, los asientos y las
   * acciones siguen a esas piezas. Vacío o ausente: el escenario de siempre.
   */
  ajustesMuebles?: AjustesMuebles;
  /**
   * Mientras se arrastra, el dibujo muestra este ajuste (válido) sin cambiar todavía la colisión.
   * Ausente: el dibujo usa `ajustesMuebles`.
   */
  ajustesDibujo?: AjustesMuebles | null;
}

const SIN_HABLANTES: ReadonlySet<string> = new Set();
const SIN_CONTENIDO: Readonly<Record<string, HTMLCanvasElement | HTMLVideoElement>> = {};

let catalogoPorDefecto: Catalogo | undefined;
function obtenerCatalogoPorDefecto(): Catalogo {
  catalogoPorDefecto ??= registrarPaquete(crearCatalogo(catalogoBase), paqueteHalloween);
  return catalogoPorDefecto;
}

const ESTILO_FALLBACK = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  padding: 24,
  boxSizing: 'border-box',
  textAlign: 'center',
  color: '#c9ced6',
  background: '#0b0d10',
  font: '500 15px/1.5 system-ui, sans-serif',
} as const;

/** Asistente en reposo es más grande que una persona; su posición de reposo la trae el escenario. */
const ESCALA_ASISTENTE = 1.45;

/**
 * Lista de personas de la fuente, que se renueva solo cuando alguien entra o sale (la fuente avisa).
 * Es una copia de identidad: la posición se lee de la fuente directamente en cada cuadro.
 */
function usePresentes(fuente: FuentePresencia | null) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!fuente) return;
    return fuente.suscribir(() => setVersion((v) => v + 1));
  }, [fuente]);
  return useMemo(
    () =>
      fuente
        ? fuente.personas().map((p) => ({ id: p.id, nombre: p.nombre, atuendo: p.atuendo }))
        : [],
    // `version` fuerza la relectura de la lista cuando la fuente avisa.
    [fuente, version],
  );
}

function Medidor(props: Parameters<typeof useMetricas>[0]) {
  useMetricas(props);
  return null;
}

/**
 * La oficina en 3D: salas por departamento, escritorios, personas animadas y Asistente.
 * Si el navegador no tiene WebGL muestra un texto y avisa con `onMetricas({ webgl: false })`.
 */
export function Oficina(props: OficinaProps) {
  const [conWebGL] = useState(hayWebGL);
  const { onMetricas } = props;
  useEffect(() => {
    if (!conWebGL) onMetricas?.({ webgl: false });
  }, [conWebGL, onMetricas]);

  if (!conWebGL) {
    return (
      <div role="img" aria-label="Oficina en 3D no disponible" style={ESTILO_FALLBACK}>
        No se puede mostrar la oficina en 3D porque este navegador o dispositivo no tiene WebGL
        activado.
      </div>
    );
  }
  return <Escena {...props} />;
}

function Escena({
  agentes,
  miradaAgentes,
  gestoAgentes,
  accionesExtra,
  onSeleccionar,
  seleccionadoId,
  visible = true,
  departamentos = departamentosBase,
  escenario: escenarioId = 'mansion',
  catalogo,
  horaChile,
  variante: varianteId,
  calidad = 'auto',
  enfocadoId = null,
  ambienteId,
  onAmbiente,
  vistaGeneral = 0,
  vista,
  onMetricas,
  presenciaAsistente = 'reposo',
  nivelVozAsistente,
  derivaCamara = 0,
  retenerEnSala = false,
  onProyector,
  encuadreLibre = false,
  enfocaAsistente = false,
  asistenteDeFrente = false,
  asistentePresente = false,
  corteCamara = 0,
  fuentePresencia = null,
  onHablarAgente,
  avatarPropio,
  seguirAvatar = false,
  onRenderer,
  tecnicas: sobrescribirTecnicas,
  hablandoIds,
  configAjuste = CONFIG_AJUSTE_INICIAL,
  diagnostico,
  contenidoPantallas = SIN_CONTENIDO,
  onInteres,
  interesesPorCercania = true,
  onAccionCercana,
  children,
  solidosExtra,
  superficiesExtra,
  ajustesMuebles,
  ajustesDibujo,
}: OficinaProps) {
  useMemo(precalentarTexturas, []);
  const rigs = useRef(new Map<string, Rig>());

  // --- selección: controlada si llega `seleccionadoId`, interna si no ---
  const [interno, setInterno] = useState<string | null>(null);
  const seleccionado = seleccionadoId !== undefined ? seleccionadoId : interno;
  const idsAgentes = useRef(new Set<string>());
  idsAgentes.current = new Set(agentes.map((a) => a.id));
  const seleccionar = useCallback(
    (id: string | null) => {
      setInterno(id);
      onSeleccionar?.(id);
      if (id !== null && idsAgentes.current.has(id)) onHablarAgente?.(id);
    },
    [onSeleccionar, onHablarAgente],
  );

  // --- ambiente: controlado si llega `ambienteId`, interno si no ---
  const [ambienteInterno, setAmbienteInterno] = useState<string | null>(null);
  // Con extras o ajustes es otro objeto (mismo id): el suelo, las acciones y el mundo del avatar se rehacen
  // por identidad. Sin ajustes es el escenario de siempre, la misma referencia.
  const plantilla = useMemo(() => escenarioPorId(escenarioId), [escenarioId]);
  const conAjustes = useMemo(() => {
    if (!ajustesMuebles || Object.keys(ajustesMuebles).length === 0) return plantilla;
    return aplicarAjustes(plantilla, ajustesMuebles).escenario;
  }, [plantilla, ajustesMuebles]);
  const escenario = useMemo(
    () => conSueloExtra(conAjustes, solidosExtra, superficiesExtra),
    [conAjustes, solidosExtra, superficiesExtra],
  );
  const mueblesDibujo = useMemo(() => {
    if (!ajustesDibujo) return null;
    return aplicarAjustes(plantilla, ajustesDibujo).escenario.planta.muebles;
  }, [plantilla, ajustesDibujo]);
  // `vista` manda: una zona que es ambiente de la planta entra a él; lo demás sale al conjunto.
  const ambienteDeVista =
    typeof vista === 'object' && escenario.planta.ambientes.some((a) => a.id === vista.zona)
      ? vista.zona
      : null;
  const ambienteActivoId =
    vista !== undefined ? ambienteDeVista : ambienteId !== undefined ? ambienteId : ambienteInterno;
  const ambiente = useMemo(
    () => escenario.planta.ambientes.find((a) => a.id === ambienteActivoId) ?? null,
    [escenario, ambienteActivoId],
  );
  // Punto elegido con doble toque: nuevo centro de la órbita hasta salir, cambiar de ambiente o pedir la vista general.
  const [foco, setFoco] = useState<Punto3 | null>(null);
  // Un toque en la casa: entra al ambiente (o sale si fue fuera) y suelta la selección.
  const alToque = useCallback(
    (id: string | null) => {
      if (id !== ambienteActivoId) setFoco(null);
      setAmbienteInterno(id);
      onAmbiente?.(id);
      if (seleccionado !== null) seleccionar(null);
    },
    [ambienteActivoId, onAmbiente, seleccionado, seleccionar],
  );
  const vistaPedidaAnterior = useRef(vista);
  useEffect(() => {
    if (vistaPedidaAnterior.current === vista) return;
    vistaPedidaAnterior.current = vista;
    setFoco(null);
  }, [vista]);
  const vistaAnterior = useRef(vistaGeneral);
  useEffect(() => {
    if (vistaAnterior.current === vistaGeneral) return;
    vistaAnterior.current = vistaGeneral;
    setFoco(null);
    setAmbienteInterno(null);
  }, [vistaGeneral]);

  // --- datos derivados ---
  const catalogoActivo = catalogo ?? obtenerCatalogoPorDefecto();
  const puestos = useMemo(
    () => asignarPuestos(agentes, departamentos, escenario),
    [agentes, departamentos, escenario],
  );
  const atuendos = useMemo(
    () =>
      agentes.map((a, i) => resolverAtuendo(catalogoActivo, a.atuendo ?? atuendoPorRol(a.rol, i))),
    [agentes, catalogoActivo],
  );

  // --- personas remotas: la lista cambia (entra, sale, cambia de atuendo) de vez en cuando; la posición no pasa por React ---
  const presentes = usePresentes(fuentePresencia);
  const idAvatar = avatarPropio?.id;
  const nombreAvatar = avatarPropio?.nombre;
  const atuendoAvatar = avatarPropio?.atuendo;
  const remotas = useMemo<RemotaDibujable[]>(() => {
    const lista = presentes.map((p, i) => ({
      agente: {
        id: p.id,
        nombre: p.nombre,
        rol: 'Persona',
        departamento: '',
        estado: 'libre' as const,
      },
      atuendo: resolverAtuendo(catalogoActivo, p.atuendo ?? atuendoPorRol('', i)),
    }));
    // El avatar propio se monta como una persona más; su movimiento no pasa por la fuente.
    if (idAvatar !== undefined) {
      lista.push({
        agente: {
          id: idAvatar,
          nombre: nombreAvatar ?? '',
          rol: 'Persona',
          departamento: '',
          estado: 'libre' as const,
        },
        atuendo: resolverAtuendo(catalogoActivo, atuendoAvatar ?? atuendoPorRol('', lista.length)),
      });
    }
    return lista;
  }, [presentes, catalogoActivo, idAvatar, nombreAvatar, atuendoAvatar]);

  const nombresPersistentes = useMemo(() => new Set(remotas.map((r) => r.agente.id)), [remotas]);
  const nombres = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agentes) m.set(a.id, a.nombre);
    for (const r of remotas) m.set(r.agente.id, r.agente.nombre);
    return m;
  }, [agentes, remotas]);

  // --- hora y luz ---
  const [reloj, setReloj] = useState(() => new Date());
  const resuelta = useMemo(
    () => resolverVariante(escenario.variantes, varianteId),
    [escenario, varianteId],
  );
  const variante = resuelta.variante;
  useEffect(() => {
    if (resuelta.aviso) console.warn(resuelta.aviso);
  }, [resuelta]);
  const horaFija = horaFijaDeVariante(escenario.ambiente.hora, resuelta);
  useEffect(() => {
    if (horaChile || horaFija !== null) return;
    const id = setInterval(() => setReloj(new Date()), 60_000);
    return () => clearInterval(id);
  }, [horaChile, horaFija]);
  const paleta = useMemo(
    () => paletaConVariante(paletaLuz(horaDeLuz(horaChile, horaFija, reloj)), variante.paleta),
    [horaChile, horaFija, reloj, variante],
  );

  // --- calidad ---
  const reducirMovimiento = useReduceMotion();
  const [nivel, setNivel] = useState<NivelCalidad>(() =>
    nivelInicialPorEquipo({
      nucleos: navigator.hardwareConcurrency || 4,
      memoriaGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      dpr: window.devicePixelRatio || 1,
      tactil: !esEscritorio(),
      anchoPx: window.innerWidth,
    }),
  );
  const ajuste = decidirCalidad({
    modo: calidad,
    nivelActual: nivel,
    p95: 0,
    muestras: 0,
    reduceMotion: reducirMovimiento,
  });
  const tecnicasVigentes = useMemo(
    () => tecnicasDe(ajuste.nivel, sobrescribirTecnicas),
    [ajuste.nivel, sobrescribirTecnicas],
  );
  // Resolución adaptable: un escalón por muestreo, dentro de los límites del nivel y del equipo.
  const controladorRef = useRef<ControladorDpr | null>(null);
  controladorRef.current ??= crearControladorDpr(
    configAjuste,
    ajuste.nivel,
    typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
  );
  const dprVisto = useRef(controladorRef.current.dpr);
  const [dprActual, setDprActual] = useState(controladorRef.current.dpr);
  useEffect(() => {
    const control = controladorRef.current;
    if (!control) return;
    control.cambiarNivel(ajuste.nivel);
    dprVisto.current = control.dpr;
    setDprActual(control.dpr);
  }, [ajuste.nivel]);
  const vigente = useRef({
    modo: calidad,
    nivel: ajuste.nivel,
    config: configAjuste,
    adaptable: tecnicasVigentes.dprAdaptable,
    controlador: controladorRef.current,
    dprVisto,
  });
  vigente.current = {
    modo: calidad,
    nivel: ajuste.nivel,
    config: configAjuste,
    adaptable: tecnicasVigentes.dprAdaptable,
    controlador: controladorRef.current,
    dprVisto,
  };
  // Sombras reales del sol: solo con calidad 'alta' pedida y un puntero fino (escritorio).
  const [escritorio] = useState(esEscritorio);
  const sombras = ajuste.sombras && calidad === 'alta' && escritorio;
  const alMuestrear = useCallback((p95: number, muestras: number) => {
    const v = vigente.current;
    const control = v.controlador;
    let cambio = false;
    if (v.adaptable) {
      const nuevo = control.muestrear(p95, muestras);
      if (nuevo !== v.dprVisto.current) {
        v.dprVisto.current = nuevo;
        setDprActual(nuevo);
        cambio = true;
      }
    }
    if (v.modo === 'auto' && !control.enGracia) {
      const siguiente = proponerNivel(v.config, v.nivel, control.dpr, p95, muestras);
      if (siguiente !== v.nivel) {
        control.cambiarNivel(siguiente);
        v.dprVisto.current = control.dpr;
        setDprActual(control.dpr);
        setNivel(siguiente);
        cambio = true;
      }
    }
    return cambio;
  }, []);

  // --- Asistente: espera en el atrio; con alguien enfocado o seleccionado se aparta a un costado ---
  const perfil = configAjuste.perfiles[ajuste.nivel];
  const valorGrafica = useMemo(
    () => ({
      tecnicas: tecnicasVigentes,
      lod: { distanciaSimple: perfil.distanciaLod, histeresis: LOD_INICIAL.histeresis },
      maxEtiquetas: perfil.maxEtiquetas,
      distanciaEtiquetas: perfil.distanciaEtiquetas,
    }),
    [ajuste.nivel, tecnicasVigentes, perfil],
  );
  // Anisotropía de los atlas: lo pedido por el nivel, topado a lo que soporta la GPU.
  const anisotropia = valorGrafica.tecnicas.anisotropia;
  const renderer = useRef<WebGLRenderer | null>(null);
  useEffect(() => {
    const tope = renderer.current?.capabilities.getMaxAnisotropy() ?? anisotropia;
    fijarAnisotropia(Math.min(anisotropia, tope));
  }, [anisotropia]);
  // Volumen (rampa fría y luz de contorno): uniformes compartidos, sin recompilar.
  useEffect(() => {
    uniformesVolumen.uRampa.value = valorGrafica.tecnicas.volumen ? 1 : 0;
    uniformesVolumen.uRim.value = valorGrafica.tecnicas.rim ? 1 : 0;
  }, [valorGrafica.tecnicas.volumen, valorGrafica.tecnicas.rim]);
  const alProyector = useRef(onProyector);
  alProyector.current = onProyector;
  const reposoAsistente = escenario.planta.asistente;
  const asistentePos = useMemo(
    () => new Vector3(reposoAsistente.x, reposoAsistente.y, reposoAsistente.z),
    [reposoAsistente],
  );
  const Dibujo = dibujoDe(escenario.id);
  const alInteres = useRef(onInteres);
  alInteres.current = onInteres;
  // Un clic sobre un punto de interés abre su panel y no mueve al avatar (`ControlesAvatar`).
  const interesAtendido = useRef(false);
  const interesPorClic = useCallback((id: string) => {
    interesAtendido.current = true;
    alInteres.current?.(id);
  }, []);
  // Acciones del avatar (sentarse, abrir): lo que tiene a mano y la tecla E que la ejecuta.
  const alAccionCercana = useRef(onAccionCercana);
  alAccionCercana.current = onAccionCercana;
  const estadoAvatar = useRef(crearEstadoAvatar());
  const accionActual = useRef<Accion | null>(null);
  const alCambiarAvatar = useRef(avatarPropio?.alCambiar);
  alCambiarAvatar.current = avatarPropio?.alCambiar;
  const avatarConEstado = useMemo(
    () =>
      avatarPropio && {
        ...avatarPropio,
        alCambiar: (e: Parameters<NonNullable<AvatarPropio['alCambiar']>>[0]) => {
          const q = estadoAvatar.current;
          q.x = e.x;
          q.y = e.y;
          q.z = e.z;
          q.rumbo = e.rumbo;
          q.estado = e.estado;
          alCambiarAvatar.current?.(e);
        },
      },
    [avatarPropio],
  );
  const mandoAvatar = avatarPropio?.mando;
  const alAccion = useCallback(() => {
    if (!mandoAvatar) return;
    ejecutarAccionAvatar(
      mandoAvatar,
      estadoAvatar.current,
      accionActual.current,
      alInteres.current,
    );
  }, [mandoAvatar]);
  // La cámara sigue al avatar con `vista="seguir"` o, sin `vista`, con `seguirAvatar`.
  const seguirActivo =
    avatarPropio !== undefined && (vista !== undefined ? vista === 'seguir' : seguirAvatar);

  return (
    <Canvas
      camera={{ fov: FOV_VERTICAL, position: [0, 20, 120], near: 0.5, far: 600 }}
      dpr={tecnicasVigentes.dprAdaptable ? dprActual : (controladorRef.current?.dpr ?? 1)}
      frameloop={frameloopPara(visible)}
      shadows={sombras ? 'soft' : false}
      gl={{ antialias: true, powerPreference: 'default' }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      onCreated={({ gl, get }) => {
        // La exposición la fija la luz según la hora (`Luces`).
        gl.toneMapping = ACESFilmicToneMapping;
        renderer.current = gl;
        fijarAnisotropia(
          Math.min(valorGrafica.tecnicas.anisotropia, gl.capabilities.getMaxAnisotropy()),
        );
        onRenderer?.(gl);
        alProyector.current?.(crearProyector(rigs, get));
      }}
      onPointerMissed={avatarPropio ? undefined : () => alToque(null)}
    >
      <ContextoGrafica.Provider value={valorGrafica}>
        <ContextoEscenario.Provider value={escenario}>
          <UbicacionDeEscenario muebles={mueblesDibujo}>
            {Dibujo && (
              <Dibujo
                key={`dibujo-${escenario.id}-${variante.id}`}
                escenario={escenario}
                variante={variante}
                paleta={paleta}
                sombras={sombras}
                movimiento={ajuste.movimiento}
                rigs={rigs}
                ambiente={ambiente}
                seguirId={seguirActivo ? (idAvatar ?? null) : null}
                asistente={asistentePos}
                escalaAsistente={ESCALA_ASISTENTE}
                sinCasa={diagnostico?.sinCasa ?? false}
                contenidoPantallas={contenidoPantallas}
                onInteres={interesPorClic}
              />
            )}
            <Luces
              paleta={paleta}
              sombras={sombras}
              puntuales={escenario.ambiente.tipo === 'exterior'}
            />
            <Personas
              key={`personas-${escenario.id}`}
              agentes={agentes}
              miradaAgentes={miradaAgentes}
              gestoAgentes={gestoAgentes}
              atuendos={atuendos}
              puestos={puestos}
              seleccionadoId={seleccionado}
              onSeleccionar={seleccionar}
              movimiento={ajuste.movimiento}
              paseos={ajuste.paseos}
              sombras={sombras}
              asistente={asistentePos}
              enfocadoId={enfocadoId}
              ambienteId={ambiente?.id ?? null}
              retenerEnSala={retenerEnSala}
              rigs={rigs}
              remotas={remotas}
              fuente={fuentePresencia}
              hablandoIds={hablandoIds}
              avatarPropio={avatarConEstado}
              seguir={seguirActivo}
            />
            <MarcasD2 />
            <Etiquetas
              nombres={nombres}
              siempreIds={nombresPersistentes}
              rigs={rigs}
              seleccionadoId={seleccionado}
              hablandoIds={hablandoIds ?? SIN_HABLANTES}
              centroId={seguirActivo ? (idAvatar ?? null) : null}
            />
            {avatarPropio && interesesPorCercania && (
              <Intereses avatarId={avatarPropio.id} rigs={rigs} onInteres={alInteres} />
            )}
            {avatarPropio && (
              <Acciones
                mando={mandoAvatar}
                alAccion={alAccion}
                accionesExtra={accionesExtra}
                avatar={estadoAvatar}
                accion={accionActual}
                fuente={fuentePresencia}
                onAccionCercana={alAccionCercana}
              />
            )}
            <Asistente
              posicion={asistentePos}
              acompanado={avatarPropio ? estadoAvatar : undefined}
              apartarDeId={enfocadoId ?? seleccionado}
              enAmbiente={ambiente !== null && !enfocaAsistente}
              deFrente={asistenteDeFrente}
              presente={asistentePresente}
              rigs={rigs}
              movimiento={ajuste.movimiento}
              presencia={presenciaAsistente}
              nivelVoz={nivelVozAsistente}
              reposo={reposoAsistente}
              escala={ESCALA_ASISTENTE}
            />
            {avatarPropio ? (
              <ControlesAvatar
                mando={avatarPropio.mando}
                altura={escenario.entradas[0]?.y ?? 0}
                interesAtendido={interesAtendido}
                alAccion={alAccion}
              />
            ) : (
              <ZonasAmbiente onToque={alToque} onDobleToque={setFoco} />
            )}
            <ControlesCamara
              enfocadoId={enfocadoId}
              ambiente={ambiente}
              foco={foco}
              reinicio={vistaGeneral}
              rigs={rigs}
              deriva={derivaCamara}
              encuadreLibre={encuadreLibre}
              corte={corteCamara}
              asistente={enfocaAsistente ? asistentePos : null}
              asistenteCerca={asistentePos}
              seguirId={seguirActivo ? (idAvatar ?? null) : null}
              mandoSeguir={avatarPropio?.mando ?? null}
              vista={vista}
            />
            <Medidor
              agentes={agentes.length + remotas.length}
              onMetricas={onMetricas}
              alMuestrear={alMuestrear}
            />
            {children}
          </UbicacionDeEscenario>
        </ContextoEscenario.Provider>
      </ContextoGrafica.Provider>
    </Canvas>
  );
}
