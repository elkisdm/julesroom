import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef, MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Ambiente } from '../mansion/plano';
import type { Rig } from './animador';
import {
  DISTANCIA_PERSONA,
  avanzarCamara,
  avanzarSeguimiento,
  crearSeguimiento,
  derivarAzimut,
  desplazamientoDe,
  encuadreAmbiente,
  distanciaSeguirPara,
  elevacionGeneralPara,
  encuadreEntero,
  encuadreGeneral,
  encuadreZona,
  leerOrbita,
  PARAMETROS_SEGUIMIENTO,
} from './camara';
import type { EntradaSeguimiento, EstadoCamara, Punto3 } from './camara';
import type { Mando } from '../animacion/avatar';
import { suavizarExp } from '../animacion/resorte';
import {
  acotarObjetivo,
  cajaPaneo,
  ELEVACION_GENERAL_MAX,
  ELEVACION_GENERAL_MIN,
  limitesOrbita,
} from './orbita';
import { useEscenario } from './escenarios/contexto';
import { CENTRO_CUERPO } from './asistente/posicion';
import { cajaDePersona, cajasDeLaCasa, elegirVista, lineaLibre, posicionDe } from './visual';
import type { Caja3, Vista } from './visual';
import { useReduceMotion } from './preferencias';
import { actualizarCorteSeguimiento } from './casa/planoCorte';
import { alturaDeCorteSeguir, SIN_CORTE } from './casa/corte';
import { cajasDeEnvolvente } from './camaraColision';
import { crearOcultacionCercana } from './oclusion';
import { escribirDesvanecidas, limpiarDesvanecidas } from './desvanecer';
import {
  aplicarSuspension,
  conectarSuspensionControles,
  controlesSuspendidos,
} from './suspensionControles';
import type { ControlesConInercia } from './suspensionControles';

/**
 * Vista que pide quien usa la oficina: la general del escenario, la que sigue al avatar propio o una
 * zona (`id` de `Escenario.vistas.zonas`).
 */
export type VistaOficina = 'general' | 'seguir' | { zona: string };

interface Props {
  enfocadoId: string | null;
  /** Ambiente al que se entró; `null` es la casa completa. */
  ambiente: Ambiente | null;
  /** Punto elegido con doble toque (una referencia nueva por cada doble toque), o `null`. */
  foco: Punto3 | null;
  /** Cada vez que cambia, la cámara vuelve a la vista general inicial (dirección incluida). */
  reinicio: number;
  /** Cada vez que cambia, la cámara llega de golpe a su destino (un corte, sin viaje). */
  corte?: number;
  rigs: MutableRefObject<Map<string, Rig>>;
  /** Deriva lenta del azimut (rad/s de pico) mientras el usuario no toca la cámara; 0 = apagada. */
  deriva: number;
  /** Esquiva lo que tapa la cara del enfocado (muros, muebles altos, otras personas). */
  encuadreLibre?: boolean;
  /** Posición del asistente si es ella a quien se enfoca (`enfocadoId` se ignora entonces). */
  asistente?: Punto3 | null;
  /**
   * Centro del cuerpo del asistente, esté o no enfocado: al seguir al avatar, si queda entre la cámara y
   * él se desvanece (la cámara no se mueve por ella).
   */
  asistenteCerca?: Punto3 | null;
  /** Id de la persona (el avatar propio) a la que sigue la cámara, o `null`/ausente: sin seguimiento. */
  seguirId?: string | null;
  /** Mando del avatar seguido: anticipa hacia dónde quiere ir. */
  mandoSeguir?: Mando | null;
  /**
   * Vista pedida: `{ zona }` encuadra esa zona del escenario; `'general'` vuelve a la general del
   * escenario. (`'seguir'` llega como `seguirId`.) Sin ella, manda el resto de las props.
   */
  vista?: VistaOficina;
}

/** Altura sobre los pies a la que apunta la cámara (igual que en `avanzarCamara`). */
const ALTURA_MIRA = 1.1;
/** Altura sobre sus pies a la que se encuadra al asistente (la cámara suma `ALTURA_MIRA` a este punto). */
const ALTURA_MIRA_ASISTENTE = 0;
/** Hasta dónde puede rodear la cámara un obstáculo (rad desde el frente) y cuánto acercarse. */
const LIMITE_AZIMUT_LIBRE = 1.3;
const DISTANCIA_MIN_LIBRE = 2.2;
/** Segundos tras soltar el arrastre en que se espera a que termine la inercia antes de derivar. */
const PAUSA_TRAS_USUARIO = PARAMETROS_SEGUIMIENTO.pausaManual;
/** Media vida (s) con que la cámara sube a la elevación de seguimiento al entrar en ese modo. */
const VIDA_ELEVACION_SEGUIR = 0.5;
const TOLERANCIA_ELEVACION = 0.01;
const GRADOS = Math.PI / 180;

/**
 * Cámara en perspectiva de casa de muñecas. En reposo la órbita es del usuario: vuelta
 * completa de 360° alrededor de la casa (arrastre o un dedo), zoom (rueda o pellizco) y paneo
 * (clic derecho o dos dedos) con inercia, todo acotado (`limitesOrbita`); dentro de un
 * ambiente la órbita es corta. Según el estado, además viaja suave a la casa completa, a un
 * ambiente, a un punto o a una persona enfocada.
 */
export function ControlesCamara({
  enfocadoId,
  ambiente,
  foco,
  reinicio,
  corte = 0,
  rigs,
  deriva,
  encuadreLibre = false,
  asistente = null,
  asistenteCerca = null,
  seguirId = null,
  mandoSeguir = null,
  vista: vistaPedida,
}: Props) {
  const escenario = useEscenario();
  const { vistas } = escenario;
  const camara = useThree((estado) => estado.camera);
  const { width, height } = useThree((estado) => estado.size);
  const reducirMovimiento = useReduceMotion();
  const clock = useThree((estado) => estado.clock);
  const controles = useRef<ComponentRef<typeof OrbitControls>>(null);

  // En vertical el encuadre inicial se acerca a la planta baja; el alejamiento máximo sigue siendo
  // la casa entera.
  const casa = useMemo(() => encuadreGeneral(vistas, width, height), [vistas, width, height]);
  const casaEntera = useMemo(() => encuadreEntero(vistas, width, height), [vistas, width, height]);
  const elevacionGeneral = elevacionGeneralPara(vistas, width, height);
  const elevacionSeguir = vistas.seguir.elevacion * GRADOS;
  const parametrosSeguir = useMemo(
    () => ({
      ...PARAMETROS_SEGUIMIENTO,
      distanciaSeguir: distanciaSeguirPara(width / height, vistas.seguir.distancia),
    }),
    [vistas, width, height],
  );
  // Una zona pedida por `vista` manda sobre el ambiente al que se entró.
  const zonaPedida = useMemo(
    () =>
      typeof vistaPedida === 'object'
        ? (vistas.zonas.find((z) => z.id === vistaPedida.zona) ?? null)
        : null,
    [vistaPedida, vistas],
  );
  const recinto = useMemo<Pick<Ambiente, 'x0' | 'x1' | 'z0' | 'z1' | 'y' | 'alto'> | null>(
    () =>
      zonaPedida
        ? {
            x0: zonaPedida.caja.x0,
            x1: zonaPedida.caja.x1,
            z0: zonaPedida.caja.z0,
            z1: zonaPedida.caja.z1,
            y: zonaPedida.caja.y0,
            alto: zonaPedida.caja.y1 - zonaPedida.caja.y0,
          }
        : ambiente,
    [zonaPedida, ambiente],
  );
  const encuadreDelAmbiente = useMemo(
    () =>
      zonaPedida
        ? encuadreZona(zonaPedida.caja, width, height, vistas)
        : ambiente
          ? encuadreAmbiente(ambiente, width, height)
          : null,
    [zonaPedida, ambiente, vistas, width, height],
  );
  const limites = useMemo(
    () => limitesOrbita(recinto, casaEntera, encuadreDelAmbiente, cajaPaneo(vistas.general)),
    [recinto, casaEntera, encuadreDelAmbiente, vistas],
  );

  // El punto de mira solo se fija al montar: al cambiar el tamaño no debe saltar.
  const [objetivoInicial] = useState<[number, number, number]>(() => [
    casa.objetivo.x,
    casa.objetivo.y,
    casa.objetivo.z,
  ]);
  const estado = useRef<EstadoCamara>({
    activo: false,
    x: casa.objetivo.x,
    y: casa.objetivo.y,
    z: casa.objetivo.z,
    distancia: casa.distancia,
    azimut: 0,
    elevacion: elevacionGeneral,
    clave: casa,
    reorientar: false,
  });
  const vigente = useRef({
    enfocadoId,
    foco,
    casa,
    encuadreDelAmbiente,
    limites,
    reducirMovimiento,
    deriva,
    encuadreLibre,
    asistente,
    asistenteCerca,
    seguirId,
    mandoSeguir,
    parametrosSeguir,
    elevacionGeneral,
    elevacionSeguir,
  });
  vigente.current = {
    enfocadoId,
    foco,
    casa,
    encuadreDelAmbiente,
    limites,
    reducirMovimiento,
    deriva,
    encuadreLibre,
    asistente,
    asistenteCerca,
    seguirId,
    mandoSeguir,
    parametrosSeguir,
    elevacionGeneral,
    elevacionSeguir,
  };
  const seguimiento = useMemo(crearSeguimiento, []);
  const ocultacionPropia = useMemo(crearOcultacionCercana, []);
  useLayoutEffect(() => () => ocultacionPropia.restaurar(), [ocultacionPropia]);
  useLayoutEffect(() => () => actualizarCorteSeguimiento(null, 0), []);
  useLayoutEffect(() => limpiarDesvanecidas, []);
  const entradaSeguimiento = useMemo<EntradaSeguimiento>(
    () => ({
      dt: 0,
      x: 0,
      y: 0,
      z: 0,
      adelante: 0,
      lateral: 0,
      azimut: 0,
      elevacion: 0,
      distanciaActual: 0,
      cajas: [],
    }),
    [],
  );
  const cajasCasa = useMemo(() => cajasDeLaCasa(escenario.planta), [escenario]);
  const envolvente = useMemo(
    () =>
      cajasDeEnvolvente(
        escenario.planta,
        PARAMETROS_SEGUIMIENTO.altoEnvolvente,
        PARAMETROS_SEGUIMIENTO.espesorEnvolvente,
      ),
    [escenario],
  );
  const piesAsistente = useMemo<Punto3>(() => ({ x: 0, y: 0, z: 0 }), []);
  const asistenteMira = useMemo<Punto3>(() => ({ x: 0, y: 0, z: 0 }), []);
  const vistaLibre = useRef<{ clave: string; vista: Vista } | null>(null);
  // Hasta cuándo (reloj de la escena) el usuario manda: durante el arrastre y su inercia.
  const usuarioHasta = useRef(0);
  const desplazamiento = useMemo<Punto3>(() => ({ x: 0, y: 0, z: 0 }), []);
  const desvio = useMemo<Punto3>(() => ({ x: 0, y: 0, z: 0 }), []);
  // Al entrar en seguimiento la cámara sube a la elevación del escenario, salvo que el usuario orbite.
  const elevandoSeguir = useRef(false);

  // Vista inicial: la casa completa de frente.
  useLayoutEffect(() => {
    const inicial = vigente.current.casa;
    camara.position.set(inicial.posicion.x, inicial.posicion.y, inicial.posicion.z);
    camara.lookAt(inicial.objetivo.x, inicial.objetivo.y, inicial.objetivo.z);
    controles.current?.update();
  }, [camara]);

  const corteAnterior = useRef(corte);
  const saltar = useRef(false);
  useLayoutEffect(() => {
    if (corteAnterior.current === corte) return;
    corteAnterior.current = corte;
    saltar.current = true;
  }, [corte]);

  // Al cambiar de escenario la cámara corta (sin viaje) a la vista general del nuevo.
  const escenarioAnterior = useRef(escenario.id);
  useLayoutEffect(() => {
    if (escenarioAnterior.current === escenario.id) return;
    escenarioAnterior.current = escenario.id;
    const nueva = vigente.current.casa;
    const e = estado.current;
    e.activo = false;
    e.reorientar = false;
    e.clave = nueva;
    e.x = nueva.objetivo.x;
    e.y = nueva.objetivo.y;
    e.z = nueva.objetivo.z;
    e.distancia = nueva.distancia;
    e.azimut = 0;
    e.elevacion = vigente.current.elevacionGeneral;
    ocultacionPropia.restaurar();
    seguimiento.iniciado = false;
    elevandoSeguir.current = false;
    vistaLibre.current = null;
    camara.position.set(nueva.posicion.x, nueva.posicion.y, nueva.posicion.z);
    camara.lookAt(nueva.objetivo.x, nueva.objetivo.y, nueva.objetivo.z);
    controles.current?.target.set(nueva.objetivo.x, nueva.objetivo.y, nueva.objetivo.z);
    controles.current?.update();
  }, [escenario.id, camara, seguimiento]);

  // Pedir `'general'` (o salir del seguimiento a ella) vuelve a la vista general, también en dirección.
  const vistaAnterior = useRef(vistaPedida);
  useLayoutEffect(() => {
    if (vistaAnterior.current === vistaPedida) return;
    vistaAnterior.current = vistaPedida;
    if (vistaPedida === 'general') estado.current.reorientar = true;
  }, [vistaPedida]);

  // La aplicación suspende la órbita en la captura del pointerdown. Se aplica aquí,
  // sobre el control real, para que no gire ni herede inercia al soltar.
  useLayoutEffect(() => {
    return conectarSuspensionControles((suspendido) => {
      const actual = controles.current as ControlesConInercia | null;
      if (!actual) return;
      aplicarSuspension(actual, suspendido);
      if (usuarioHasta.current === Infinity) usuarioHasta.current = clock.getElapsedTime();
    });
  }, [clock]);

  // «Vista general»: vuelve al encuadre inicial, también en dirección.
  const reinicioAnterior = useRef(reinicio);
  useLayoutEffect(() => {
    if (reinicioAnterior.current === reinicio) return;
    reinicioAnterior.current = reinicio;
    estado.current.reorientar = true;
  }, [reinicio]);

  useFrame(({ clock }, delta) => {
    if (controlesSuspendidos()) return;
    const orbita = controles.current;
    if (!orbita) return;
    const v = vigente.current;
    const e = estado.current;
    // En reposo la cámara es del usuario: el estado solo la sigue para partir de donde está.
    if (!e.activo) {
      e.x = orbita.target.x;
      e.y = orbita.target.y;
      e.z = orbita.target.z;
      leerOrbita(e, camara.position.x - e.x, camara.position.y - e.y, camara.position.z - e.z);
    }
    // Seguimiento del avatar: modo propio; enfocado, foco, asistente y viajes mandan sobre él.
    const seguido =
      v.seguirId && !e.activo && !v.enfocadoId && !v.asistente && !v.foco
        ? rigs.current.get(v.seguirId)?.raiz.position
        : undefined;
    orbita.enablePan = !seguido;
    actualizarCorteSeguimiento(
      seguido && escenario.id === 'mansion' ? seguido.y : null,
      Math.min(delta, 0.1),
    );
    if (seguido) {
      if (!seguimiento.iniciado) elevandoSeguir.current = true;
      const entrada = entradaSeguimiento;
      entrada.dt = Math.min(delta, 0.1);
      entrada.x = seguido.x;
      entrada.y = seguido.y;
      entrada.z = seguido.z;
      entrada.adelante = v.mandoSeguir?.adelante ?? 0;
      entrada.lateral = v.mandoSeguir?.lateral ?? 0;
      entrada.azimut = e.azimut;
      entrada.elevacion = e.elevacion;
      entrada.distanciaActual = e.distancia;
      entrada.distanciaMax = v.limites.distanciaMax;
      entrada.cajas = cajasCasa;
      entrada.fantasmas = envolvente;
      const jules = v.asistenteCerca;
      if (jules) {
        piesAsistente.x = jules.x;
        piesAsistente.y = jules.y - CENTRO_CUERPO;
        piesAsistente.z = jules.z;
      }
      entrada.asistente = jules ? piesAsistente : null;
      // Solo la mansión tiene losas: el techo es el cielo del piso del avatar (donde empieza el corte).
      const cielo =
        v.parametrosSeguir.limitarAlTecho && escenario.id === 'mansion'
          ? alturaDeCorteSeguir(seguido.y)
          : SIN_CORTE;
      entrada.techo = cielo < SIN_CORTE ? cielo : undefined;
      entrada.frente = vistas.seguir.frente;
      entrada.orbitando = clock.elapsedTime <= usuarioHasta.current;
      entrada.reducirMovimiento = v.reducirMovimiento;
      avanzarSeguimiento(seguimiento, entrada, v.parametrosSeguir);
      escribirDesvanecidas(
        seguimiento.obstaculos,
        seguimiento.opacidadObstaculos,
        seguimiento.asistenteActivo ? seguimiento.cajaAsistente : null,
        seguimiento.opacidadAsistente,
      );
      const rigPropio = v.seguirId ? rigs.current.get(v.seguirId) : undefined;
      if (rigPropio) {
        ocultacionPropia.actualizar(
          rigPropio.partes,
          seguimiento.distancia,
          v.parametrosSeguir.distanciaOcultarAvatar,
          v.parametrosSeguir.distanciaMinBrazo,
        );
      }
      e.azimut = seguimiento.azimut;
      e.elevacion = seguimiento.elevacion;
      const l = v.limites;
      orbita.minAzimuthAngle = -l.azimutMax;
      orbita.maxAzimuthAngle = l.azimutMax;
      orbita.minPolarAngle = Math.PI / 2 - l.elevacionMax;
      orbita.maxPolarAngle = Math.PI / 2 - l.elevacionMin;
      // El brazo puede acercar la cámara más de lo que permite el zoom del usuario.
      orbita.minDistance = 0;
      orbita.maxDistance = l.distanciaMax;
      e.x = seguimiento.mira.x;
      e.y = seguimiento.mira.y;
      e.z = seguimiento.mira.z;
      e.distancia = seguimiento.distancia;
      if (usuarioHasta.current === Infinity) elevandoSeguir.current = false;
      if (elevandoSeguir.current) {
        const dt = Math.min(delta, 0.1);
        e.elevacion = v.reducirMovimiento
          ? v.elevacionSeguir
          : suavizarExp(e.elevacion, v.elevacionSeguir, VIDA_ELEVACION_SEGUIR, dt);
        if (Math.abs(e.elevacion - v.elevacionSeguir) < TOLERANCIA_ELEVACION) {
          elevandoSeguir.current = false;
        }
      }
      // La subida a la elevación de seguimiento tampoco pasa del techo del piso del avatar.
      e.elevacion = Math.min(e.elevacion, seguimiento.elevacionMax);
      orbita.target.set(e.x, e.y, e.z);
      desplazamientoDe(e, desplazamiento);
      camara.position.set(e.x + desplazamiento.x, e.y + desplazamiento.y, e.z + desplazamiento.z);
      // La elevación del seguimiento puede diferir de la que el control acaba de leer (techo): la mira va con ella.
      camara.lookAt(e.x, e.y, e.z);
      return;
    }
    ocultacionPropia.restaurar();
    limpiarDesvanecidas();
    seguimiento.iniciado = false;
    elevandoSeguir.current = false;
    // Deriva: solo en reposo (o siguiendo a una persona), sin reducir movimiento y sin usuario.
    const derivando =
      v.deriva > 0 &&
      !v.reducirMovimiento &&
      (!e.activo || v.enfocadoId !== null || v.asistente !== null) &&
      clock.elapsedTime > usuarioHasta.current;
    if (derivando) {
      const limite = v.enfocadoId === null && v.asistente === null ? v.limites.azimutMax : Infinity;
      e.azimut = derivarAzimut(e.azimut, clock.elapsedTime, Math.min(delta, 0.1), v.deriva, limite);
    }
    if (v.asistente) {
      // `asistente` es el centro de su cuerpo; la cámara espera los pies de la persona enfocada.
      asistenteMira.x = v.asistente.x;
      asistenteMira.y = v.asistente.y - CENTRO_CUERPO + ALTURA_MIRA_ASISTENTE;
      asistenteMira.z = v.asistente.z;
    }
    const enfocado = v.asistente
      ? asistenteMira
      : v.enfocadoId
        ? (rigs.current.get(v.enfocadoId)?.raiz.position ?? null)
        : null;
    let vista: Vista | null = null;
    if (v.encuadreLibre && enfocado) {
      const clave = v.asistente ? 'asistente' : (v.enfocadoId ?? '');
      if (vistaLibre.current?.clave !== clave) vistaLibre.current = null;
      const mira = { x: enfocado.x, y: enfocado.y + ALTURA_MIRA, z: enfocado.z };
      const deseada: Vista = vistaLibre.current?.vista ?? {
        azimut: e.azimut,
        elevacion: Math.min(ELEVACION_GENERAL_MAX, Math.max(ELEVACION_GENERAL_MIN, e.elevacion)),
        distancia: DISTANCIA_PERSONA,
      };
      const cajas: Caja3[] = [...cajasCasa];
      for (const [id, rig] of rigs.current) {
        if (id !== v.enfocadoId) cajas.push(cajaDePersona(rig.raiz.position));
      }
      if (!lineaLibre(posicionDe(mira, deseada), mira, cajas)) {
        vistaLibre.current = {
          clave,
          vista: elegirVista(mira, deseada, cajas, {
            limiteAzimut: LIMITE_AZIMUT_LIBRE,
            elevacionMin: ELEVACION_GENERAL_MIN,
            elevacionMax: ELEVACION_GENERAL_MAX,
            distanciaMin: DISTANCIA_MIN_LIBRE,
          }),
        };
      }
      vista = vistaLibre.current?.vista ?? null;
    } else vistaLibre.current = null;
    const movio = avanzarCamara(e, {
      vista,
      dt: Math.min(delta, 0.1),
      casa: v.casa,
      ambiente: v.encuadreDelAmbiente,
      foco: v.foco,
      enfocado,
      instantaneo: v.reducirMovimiento || saltar.current,
      elevacionGeneral: v.elevacionGeneral,
    });
    saltar.current = false;
    if (e.activo) {
      // En viaje no hay límites: la cámara cruza ángulos y distancias que en reposo no se permiten.
      orbita.minAzimuthAngle = -Infinity;
      orbita.maxAzimuthAngle = Infinity;
      orbita.minPolarAngle = 0;
      orbita.maxPolarAngle = Math.PI;
      orbita.minDistance = 0;
      orbita.maxDistance = Infinity;
    } else {
      const l = v.limites;
      orbita.minAzimuthAngle = -l.azimutMax;
      orbita.maxAzimuthAngle = l.azimutMax;
      orbita.minPolarAngle = Math.PI / 2 - l.elevacionMax;
      orbita.maxPolarAngle = Math.PI / 2 - l.elevacionMin;
      orbita.minDistance = l.distanciaMin;
      orbita.maxDistance = l.distanciaMax;
      // El paneo no saca el punto de mira de la caja: la cámara se mueve lo mismo que él.
      acotarObjetivo(orbita.target, l.caja, desvio);
      camara.position.x += desvio.x;
      camara.position.y += desvio.y;
      camara.position.z += desvio.z;
    }
    if (!movio && !derivando) return;
    orbita.target.set(e.x, e.y, e.z);
    desplazamientoDe(e, desplazamiento);
    camara.position.set(e.x + desplazamiento.x, e.y + desplazamiento.y, e.z + desplazamiento.z);
  });

  return (
    <OrbitControls
      ref={controles}
      makeDefault
      target={objetivoInicial}
      onStart={() => {
        usuarioHasta.current = Infinity;
      }}
      onEnd={() => {
        usuarioHasta.current = clock.getElapsedTime() + PAUSA_TRAS_USUARIO;
      }}
      enableDamping={!reducirMovimiento}
      dampingFactor={PARAMETROS_SEGUIMIENTO.inerciaManual}
      zoomSpeed={PARAMETROS_SEGUIMIENTO.rapidezRueda}
      screenSpacePanning
    />
  );
}
