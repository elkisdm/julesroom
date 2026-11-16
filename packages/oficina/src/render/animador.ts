import type { Group, Vector3 } from 'three';
import type { Azar } from '../azar';
import { calcularPose, crearPose } from '../animacion/articulaciones';
import type { EntradaPose, Pose, PosturaCuerpo } from '../animacion/articulaciones';
import { caraPorEstado, estaParpadeando, planParpadeo } from '../animacion/expresion';
import type { PlanParpadeo } from '../animacion/expresion';
import { ajusteIdle, ajusteNeutro, nuevoIdle } from '../animacion/idle';
import type { AjusteIdle, Idle } from '../animacion/idle';
import {
  ASISTENTE,
  SEGUNDOS_GESTO,
  GIRO_SILLA_ENFOCADO,
  GIRO_SILLA_SALA,
  yawObjetivoAtento,
} from '../animacion/atencion';
import type { AtencionPersona } from '../animacion/atencion';
import { costadoLibre, debePararse, giroHacia } from '../animacion/costado';
import type { Interaccion } from '../animacion/interacciones';
import { avanzarMaquina, crearMaquina } from '../animacion/maquina';
import type { Maquina } from '../animacion/maquina';
import { frecuenciaPaso } from '../animacion/marcha';
import { OPCIONES } from '../animacion/opciones';
import {
  crearCandidatos,
  crearInteres,
  crearSalidaInteres,
  elegirInteres,
} from '../animacion/interes';
import type { Candidatos, Interes, SalidaInteres } from '../animacion/interes';
import { PARAMETROS_LOCOMOCION, conducir, crearLocomocion, irHacia } from '../animacion/locomocion';
import type { Locomocion, ParametrosLocomocion } from '../animacion/locomocion';
import {
  crearResorte,
  envolverAngulo,
  resorteSub,
  suavizarAnguloExp,
  suavizarExp,
} from '../animacion/resorte';
import type { Resorte } from '../animacion/resorte';
import {
  avanzarSecundario,
  crearSecundario,
  impulsoPisada,
  impulsoSentarse,
} from '../animacion/secundario';
import type { EntradasSecundario, Secundario } from '../animacion/secundario';
import {
  avanzarPeso,
  avanzarReaccion,
  crearReaccion,
  crearSalidaEnvolvente,
  crearSalidaReaccion,
  crearSalidaSentarse,
  curvaLevantarse,
  curvaSentarse,
  dispararSaludo,
  envolventeGesto,
  suavizarPaso,
} from '../animacion/transicion';
import type { Reaccion } from '../animacion/transicion';
import { avanzarVida, crearAjusteVida, crearVida, GESTOS_VIDA, semillaDe } from '../animacion/vida';
import type { AjusteVida, Vida } from '../animacion/vida';
import { avanzarFase, calcularZancada, crearSalidaZancada } from '../animacion/zancada';
import { avanzarFaseCaminata, calcularCaminata, crearSalidaCaminata } from '../animacion/caminata';
import { ajustarAlTerreno, crearEstadoPies } from '../animacion/pisada';
import type { EstadoPies } from '../animacion/pisada';
import type { Suelo } from '../escenarios/suelo';
import { atencionOrbe, calcularMirada, LIMITE_YAW, suavizar } from '../animacion/mirada';
import type { Mirada, Vec3 } from '../animacion/mirada';
import { perfilDeRol } from '../animacion/personalidad';
import type { PerfilIdle } from '../animacion/personalidad';
import {
  alturaNav,
  avanzarNav,
  destinoNav,
  llegoANodo,
  NODO_ASIENTO,
  NODO_PASILLO,
  NODO_SALIDA,
  NODO_VISITA,
} from '../animacion/ruta';
import type { Nav, Nodo, PuntoXZ } from '../animacion/ruta';
import type { AgenteOficina } from '../tipos';
import type { Puesto } from './layout';
import type { Parte } from './Pieza';
import { celdaIcono, celdasCara } from './texturas';

/** Piezas de una persona que el animador mueve; las registra `Persona` al montarse. */
export interface Rig {
  raiz: Group;
  pelvis: Group;
  columna: Group;
  torso: Group;
  cabeza: Group;
  piernas: readonly [{ cadera: Group; rodilla: Group }, { cadera: Group; rodilla: Group }];
  brazos: readonly [{ hombro: Group; codo: Group }, { hombro: Group; codo: Group }];
  taza: Parte;
  /** Hoja de papel en la mano izquierda (la muestran los idles de lectura). */
  hoja: Parte;
  /** Teléfono en la mano derecha. */
  telefono: Parte;
  /** Plano de la cara (su `celda` cambia con el parpadeo); `null` con cabeza de calabaza. */
  cara: Parte | null;
  /** Globo de estado: se muestra con `ancla.visible` y elige su `celda`. */
  icono: Parte;
  /** Aro bajo quien espera una decisión o está seleccionado; vive en coordenadas del mundo. */
  anillo: Group;
  /** Todas las piezas visibles del esqueleto, para dibujarlas instanciadas. */
  partes: readonly Parte[];
  /** Cara de un disfraz (vampiro, calavera, momia): no cambia con el estado. */
  caraFija: string | null;
  /** Lleva una taza equipada (pieza `taza`). */
  tazaEquipada: boolean;
  /** Altura del globo de estado sobre la cabeza. */
  alturaIcono: number;
  /**
   * Grupos de accesorios con inercia (mochila, capa, audífonos); los llena `Persona`. El animador
   * les da un resorte propio que sigue con retraso el movimiento del cuerpo.
   */
  secundarios?: Group[];
}

interface BrazoSuave {
  hombro: number;
  abduccion: number;
  codo: number;
}

/** Estado de simulación de una persona (posición, postura, reloj de idle y parpadeo). */
export interface Sim {
  x: number;
  z: number;
  /** Altura del piso bajo la persona: sube y baja por las escaleras. */
  y: number;
  yaw: number;
  /** 0 = de pie, 1 = sentado. */
  sit: number;
  /** 0..1: cuánto de la marcha se aplica (rampa al empezar y terminar de caminar). */
  marcha: number;
  fase: number;
  /** Desfase propio para que nadie respire, teclee o gire en fase con otro. */
  fasePropia: number;
  maquina: Maquina;
  /** Nodo de la cadena de ruta al que va (ver `animacion/ruta.ts`). */
  meta: number;
  nav: Nav;
  /** Ruta del puesto, armada al crear la persona (`puesto.rutas`); el bucle solo la lee. */
  cadena: Nodo[];
  /** Puesto para el que se armó la cadena y si termina en el aro de luz: si cambian, se rehace. */
  claveRuta: string;
  aLaLuz: boolean;
  /** Los nodos de visita de la cadena apuntan a un colega, mientras dura la visita y el regreso. */
  tramoVisita: boolean;
  /** Dónde quiere estar ahora, escrito cada cuadro. */
  destino: PuntoXZ;
  rol: string;
  perfil: PerfilIdle;
  /** 0..1: cuánto sigue con la mirada al orbe del asistente (solo si espera una decisión). */
  atencionOrbe: number;
  idle: Idle;
  idleDesde: number;
  plan: PlanParpadeo;
  planDesde: number;
  estadoVisto: AgenteOficina['estado'];
  caraFijaVista: string | null;
  cara: string;
  mirYaw: number;
  mirPitch: number;
  columna: number;
  brazos: [BrazoSuave, BrazoSuave];
  ajuste: AjusteIdle;
  /**
   * Cómo atiende al enfoque: `aqui` donde está (sentado gira el torso), o `costado` (se pone de
   * pie y da un paso al lado libre de su silla). Se decide al empezar el enfoque.
   */
  modoAtento: 'ninguno' | 'aqui' | 'costado';
  /** Punto de pie junto a su silla, del modo `costado`. */
  costado: PuntoXZ;
  /** Ya está donde va a atender (el gesto del enfoque espera a esto). */
  atentoListo: boolean;
  /** Identidad numérica estable (`semillaDe(agente.id) | 0`): la de `Candidatos.id`. */
  idNum: number;
  /** Locomoción con peso (`animacion/locomocion.ts`); `x`, `z` y `yaw` de arriba siguen siendo la verdad. */
  loco: Locomocion;
  /** Resortes de cabeza, brazos, torso y escala (aplastar y estirar). */
  sec: Secundario;
  /** Resortes de los accesorios de `Rig.secundarios` (x y z de cada uno); se crean al primer uso. */
  resortesAcc: Resorte[];
  /** Fase de la marcha por distancia, en CICLOS [0, 1) (`fase` es la senoidal antigua, en radianes). */
  ciclo: number;
  /** Velocidad real del cuadro (m/s), de lo recorrido. */
  vel: number;
  /** Contador de pisadas de la locomoción ya atendido. */
  pisadaVista: number;
  /** Pies en el terreno (peldaños): memoria de la altura de cada pie. */
  pies: EstadoPies;
  /** Progreso de sentarse (0..1) y sentido vigente (1 sentándose, -1 levantándose). */
  sitProg: { valor: number };
  sitDir: 1 | -1;
  /** Ya sonó el impulso de asentarse (se rearma al levantarse). */
  asentado: boolean;
  vida: Vida;
  ajusteVida: AjusteVida;
  /** Cuánto de la vida en reposo (deriva, peso, gestos) se aplica: sube y baja suave. */
  pesoVida: { valor: number };
  /** Último gesto de vida visto y cuánto de él se aplica (sigue bajando si la vida lo corta). */
  gestoVida: number;
  gestoVidaProgreso: number;
  pesoGestoVida: { valor: number };
  ajusteGesto: AjusteIdle;
  interes: Interes;
  salidaInteres: SalidaInteres;
  /** Mirada de interés vigente (yaw y pitch respecto del cuerpo); se conserva al bajar su peso. */
  interesYaw: number;
  interesPitch: number;
  reaccion: Reaccion;
  /** Desde cuándo saluda (-1 si no) y cuánto del saludo se aplica. */
  saludoDesde: number;
  pesoSaludo: { valor: number };
}

/** Gestos que puede pedir la aplicación anfitriona. */
export type GestoAgente = 'saludo' | 'asentir' | 'explicar';

/** Con quién está y qué hace con esa persona; lo rellena `Personas` antes de cada persona. */
export interface Relacion {
  mirada?: Vec3;
  gesto?: GestoAgente;
  interaccion: Interaccion | null;
  socio: Sim | null;
  puestoSocio: Puesto | null;
  /** Atención al enfoque de la cámara (`animacion/atencion.ts`); `null` si no aplica. */
  atencion: AtencionPersona | null;
  /** Rol `sala`: la simulación de quien mira (el enfocado). */
  foco: Sim | null;
  /**
   * Las demás personas, para la mirada por interés (`animacion/interes.ts`): `n` válidas en `c`. Su
   * `id` es `semillaDe(agente.id) | 0` (`Sim.idNum`), así cada quien se descarta a sí mismo.
   */
  candidatos?: { c: Candidatos; n: number } | null;
}

export interface ContextoFrame {
  t: number;
  dt: number;
  /** 1 normal, 0,35 con `prefers-reduced-motion`. */
  movimiento: number;
  paseos: boolean;
  azar: Azar;
  /** Posición del asistente y de la cámara en el mundo (hacia quien miran). */
  asistente: Vector3;
  camara: Vector3;
  /** Nadie sale de su sala: sin paseos al café, y quien está fuera vuelve a su lugar a paso ligero. */
  retenerEnSala?: boolean;
  /** Suelo con altura del escenario: al subir una escalera cada pie se apoya en su peldaño. */
  suelo?: Suelo | null;
}

/** Velocidad de paseo (m/s). */
/** Velocidad de paseo de los agentes (m/s): la de caminar del juego. */
export const VELOCIDAD_PASEO = PARAMETROS_LOCOMOCION.velMax;
/** La de antes (ciclo por poses apagado), para comparar con la marcha de main. */
const VELOCIDAD_PASEO_ANTES = 1.15;
const velocidadPaseo = () => (OPCIONES.caminataPoses ? VELOCIDAD_PASEO : VELOCIDAD_PASEO_ANTES);
/** Largo de la pierna de la cadera al suelo (m), para que el pie de apoyo no deslice. */
const LARGO_PIERNA = 0.6;
const UMBRAL_LLEGADA = 0.03;
/** Cuánto baja la raíz del cuerpo al sentarse (m): la pelvis queda a `0,62 - BAJA_SENTADO`. */
export const BAJA_SENTADO = 0.17;
const DISTANCIA_MIRA_ASISTENTE = 13;
/** Retardo (s) de la cabeza al seguir su objetivo. */
const TAU_MIRADA = 0.25;
const IDLE_QUIETO: Idle = { variante: 'respirar', duracion: 1, fase: 0 };
/** Idles que fuerzan la pausa y las interacciones (no los sortea el azar). */
const IDLE_LUZ: Idle = { variante: 'probar_luz', duracion: 1, fase: 0 };
const IDLE_TELEFONO: Idle = { variante: 'telefono', duracion: 1, fase: 0 };
const IDLE_SENALAR: Idle = { variante: 'senalar', duracion: 1, fase: 0 };
const IDLE_ASENTIR: Idle = { variante: 'asentir', duracion: 1, fase: 0 };
/** Progreso de un idle forzado: en el centro de su envolvente (peso pleno). */
const PLENO = 0.5;
/** Quien camina en círculo hablando por teléfono: radio (m) y velocidad angular (rad/s). */
const RADIO_CIRCULO = 0.5;
const GIRO_CIRCULO = 2.6;
/** Un turno de palabra en una conversación (s). */
const TURNO = 2.6;
/** El colega sentado mira al visitante cuando éste está a menos de esto (m). */
const DISTANCIA_RECIBE = 2;
/** Altura (m sobre el piso) de la pantalla que mira quien trabaja sentado. */
const PANTALLA_Y = 1.0;
const BRAZO_DE_PIE: BrazoSuave = { hombro: 0, abduccion: 0.05, codo: 0.15 };

/** Un cuadro más largo que esto (LOD: cuadros saltados) se integra en subpasos de este tamaño. */
const SUBPASO_MAX = 0.1;
/** Lo máximo que un cuadro acumulado hace avanzar la simulación (s). */
const DT_MAX_CUADRO = 0.25;
/** Segundos que tarda sentarse o levantarse (valor inicial parametrizable). */
const DURACION_SENTARSE = 1;
/** Saludo: duración de la envolvente (s) y fracción de ella que es ataque (anticipación y rebase). */
const DURACION_SALUDO = 1.2;
const ATAQUE_SALUDO = 0.45 * DURACION_SALUDO;
const ANTICIPACION_SALUDO = 0.06;
const ANTICIPACION_ASENTIR = 0.15;
const SUELTA_SALUDO = 0.4;
/** Cuánto baja la pelvis (m) por unidad de impacto al sentarse y por unidad de escala aplastada. */
const IMPACTO_PELVIS = 0.015;
const APLASTAR_PELVIS = 0.12;
/** Cuánto retrocede la pelvis (m) a mitad de sentarse. */
const PELVIS_ATRAS = 0.05;
/** Suavizado de la vida en reposo y de sus gestos (s). */
const SEGUNDOS_PESO_VIDA = 0.5;
const SEGUNDOS_PESO_GESTO = 0.4;
/** Resortes de accesorios: frecuencia base (rad/s), razón de amortiguación y topes (rad). */
const FRECUENCIA_ACCESORIO = 8;
const AMORTIGUACION_ACCESORIO = 0.35;
const GANANCIA_ACCESORIO = 0.05;
const TOPE_ACCESORIO = 0.35;
/** Por debajo de esto (m/s) la locomoción se da por parada. */
const VELOCIDAD_PARADA = 0.02;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** `lerp(a, b, min(1, dt·k))`, o su equivalente exponencial (media vida ln 2 / k) con `suavizadoExp`. */
const suave = (a: number, b: number, dt: number, k: number): number =>
  OPCIONES.suavizadoExp ? suavizarExp(a, b, Math.LN2 / k, dt) : lerp(a, b, Math.min(1, dt * k));

function lerpAngulo(a: number, b: number, k: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/** Como `suave`, para ángulos (camino corto). */
const suaveAngulo = (a: number, b: number, dt: number, k: number): number =>
  OPCIONES.suavizadoExp
    ? suavizarAnguloExp(a, b, Math.LN2 / k, dt)
    : lerpAngulo(a, b, Math.min(1, dt * k));

const limitar = (valor: number, limite: number) => Math.max(-limite, Math.min(limite, valor));

/** Nodo de la cadena de ruta al que lleva cada objetivo de la máquina de estados. */
function nodoDe(objetivo: 'asiento' | 'de_pie' | 'cafe', cadena: readonly Nodo[]): number {
  if (objetivo === 'asiento') return NODO_ASIENTO;
  return objetivo === 'de_pie' ? NODO_SALIDA : cadena.length - 1;
}

/** ¿Pausa en el aro de luz? Su perfil lo pide y su ambiente lo tiene; si no, va al café. */
const vaALaLuz = (puesto: Puesto, perfil: PerfilIdle): boolean =>
  perfil.destinoPaseo === 'luz' && puesto.luz !== null;

function rutaDelPuesto(puesto: Puesto, aLaLuz: boolean): Nodo[] {
  return puesto.rutas.crearRuta(
    puesto.lugar,
    aLaLuz && puesto.luz ? puesto.luz : puesto.cafe,
    aLaLuz,
  );
}

/** Crea la simulación de una persona: sentada en su puesto, o de pie si espera una decisión. */
export function crearSim(agente: AgenteOficina, puesto: Puesto, t: number, azar: Azar): Sim {
  const espera = agente.estado === 'esperando_decision';
  const inicio = espera ? puesto.parado : puesto.asiento;
  const caraEstado = caraPorEstado(agente.estado, azar);
  const perfil = perfilDeRol(agente.rol);
  const aLaLuz = vaALaLuz(puesto, perfil);
  const semilla = semillaDe(agente.id);
  return {
    x: inicio.x,
    z: inicio.z,
    y: puesto.y,
    yaw: espera ? Math.PI / 4 : puesto.yawSentado,
    sit: espera || !puesto.sentado ? 0 : 1,
    marcha: 0,
    fase: 0,
    fasePropia: azar() * Math.PI * 2,
    maquina: crearMaquina(t, azar),
    meta: espera ? NODO_SALIDA : NODO_ASIENTO,
    nav: { nodo: espera ? NODO_SALIDA : NODO_ASIENTO, hacia: -1 },
    cadena: rutaDelPuesto(puesto, aLaLuz),
    claveRuta: puesto.clave,
    aLaLuz,
    tramoVisita: false,
    destino: { x: inicio.x, z: inicio.z },
    rol: agente.rol,
    perfil,
    atencionOrbe: 0,
    idle: nuevoIdle(azar, perfil.pesos),
    idleDesde: t - azar() * 3,
    plan: planParpadeo(azar),
    planDesde: t - azar() * 3,
    estadoVisto: agente.estado,
    caraFijaVista: null,
    cara: caraEstado,
    mirYaw: 0,
    mirPitch: 0,
    columna: 0,
    brazos: [{ ...BRAZO_DE_PIE }, { ...BRAZO_DE_PIE }],
    ajuste: ajusteNeutro(),
    modoAtento: 'ninguno',
    costado: { x: 0, z: 0 },
    atentoListo: true,
    idNum: semilla | 0,
    loco: crearLocomocion(inicio.x, inicio.z, espera ? Math.PI / 4 : puesto.yawSentado),
    sec: crearSecundario(),
    resortesAcc: [],
    ciclo: 0,
    vel: 0,
    pisadaVista: 0,
    pies: crearEstadoPies(),
    sitProg: { valor: espera || !puesto.sentado ? 0 : 1 },
    sitDir: 1,
    asentado: !espera && puesto.sentado,
    vida: crearVida(semilla, perfil),
    ajusteVida: crearAjusteVida(),
    pesoVida: { valor: 0 },
    gestoVida: -1,
    gestoVidaProgreso: 0,
    pesoGestoVida: { valor: 0 },
    ajusteGesto: ajusteNeutro(),
    interes: crearInteres(semilla),
    salidaInteres: crearSalidaInteres(),
    interesYaw: 0,
    interesPitch: 0,
    reaccion: crearReaccion(),
    saludoDesde: -1,
    pesoSaludo: { valor: 0 },
  };
}

// Objetos reutilizados entre llamadas: el bucle no crea vectores ni entradas por cuadro.
const cabezaMundo: Vec3 = { x: 0, y: 0, z: 0 };
const objetivoSocio: Vec3 = { x: 0, y: 0, z: 0 };
const entradaMirada = { posCabeza: cabezaMundo, yawCuerpo: 0, objetivo: cabezaMundo as Vec3 };
const entradaPose: EntradaPose = { fase: 0, postura: 'de_pie', velocidad: 0, t: 0 };
const pose = crearPose();
const poseDePie = crearPose();
const poseSentada = crearPose();
const piernasMezcla = crearPose().piernas;
const miradaHaciaObjetivo: Mirada = { yaw: 0, pitch: 0 };
const miradaAlOrbe: Mirada = { yaw: 0, pitch: 0 };
const puntoCirculo: PuntoXZ = { x: 0, z: 0 };
const puntoAqui: PuntoXZ = { x: 0, z: 0 };
const zancada = crearSalidaZancada();
/** Ciclo por poses del agente que se está animando (con `OPCIONES.caminataPoses`). */
const ciclo = crearSalidaCaminata();
/** Si el agente de este cuadro camina con el ciclo por poses (giro de pelvis, contragiro, cabeza). */
let conCiclo = false;
const poseSaludo = crearPose();
const salidaSentarse = crearSalidaSentarse();
const envolventeSaludo = crearSalidaEnvolvente();
const envolventeAsentir = crearSalidaEnvolvente();
const salidaReaccion = crearSalidaReaccion();
const entradaSec: EntradasSecundario = {
  aceleracionLong: 0,
  aceleracionLat: 0,
  giro: 0,
  velocidad: 0,
};
/** Parámetros de la locomoción de esta persona en este cuadro (se escriben antes de cada uso). */
const parametrosLoco: ParametrosLocomocion = { ...PARAMETROS_LOCOMOCION };
const yoInteres = { x: 0, z: 0, id: 0 };
const SIN_CANDIDATOS = crearCandidatos(0);
const objetivoInteres: Vec3 = { x: 0, y: 0, z: 0 };
const miradaInteres: Mirada = { yaw: 0, pitch: 0 };

/** Mezcla las piernas de dos poses (de pie → sentado) según `peso`, en `salida`. */
function mezclarPiernas(de: Pose, a: Pose, peso: number, salida: Pose['piernas']): Pose['piernas'] {
  for (let i = 0; i < 2; i++) {
    const lado = i as 0 | 1;
    salida[lado].cadera = lerp(de.piernas[lado].cadera, a.piernas[lado].cadera, peso);
    salida[lado].rodilla = lerp(de.piernas[lado].rodilla, a.piernas[lado].rodilla, peso);
  }
  return salida;
}

/** Mezcla dos poses completas (de pie → sentado) según `peso`, en `salida` (que no es `de` ni `a`). */
function mezclarPoses(de: Pose, a: Pose, peso: number, salida: Pose): void {
  mezclarPiernas(de, a, peso, salida.piernas);
  for (let i = 0; i < 2; i++) {
    const lado = i as 0 | 1;
    const b0 = de.brazos[lado];
    const b1 = a.brazos[lado];
    const s = salida.brazos[lado];
    s.hombro = lerp(b0.hombro, b1.hombro, peso);
    s.abduccion = lerp(b0.abduccion, b1.abduccion, peso);
    s.codo = lerp(b0.codo, b1.codo, peso);
    s.muneca = lerp(b0.muneca, b1.muneca, peso);
  }
  salida.columna = lerp(de.columna, a.columna, peso);
  salida.pelvisY = lerp(de.pelvisY, a.pelvisY, peso);
  salida.cabezaPitch = lerp(de.cabezaPitch, a.cabezaPitch, peso);
  salida.cabezaYaw = lerp(de.cabezaYaw, a.cabezaYaw, peso);
}

/** Escala un ajuste de idle por `peso` (gesto que entra o sale); el objeto en mano sale por debajo de 0,5. */
function escalarAjuste(ajuste: AjusteIdle, peso: number): void {
  ajuste.cabezaYaw *= peso;
  ajuste.cabezaPitch *= peso;
  ajuste.columna *= peso;
  ajuste.mezcla[0] *= peso;
  ajuste.mezcla[1] *= peso;
  if (peso < 0.5) ajuste.prop = 'ninguno';
}

/** Altura de la cabeza de una persona (m) que pisa el piso `y`, según cuánto esté sentada. */
const alturaCabeza = (y: number, sit: number) => y - BAJA_SENTADO * sit + 0.62 + 0.83;

/** Escribe en `parametrosLoco` los de este cuadro: la velocidad manda, el resto escala con ella. */
function prepararLocomocion(velocidad: number): void {
  const p = parametrosLoco;
  const escala = velocidad / velocidadPaseo();
  p.velMax = velocidad;
  p.aceleracion = PARAMETROS_LOCOMOCION.aceleracion * escala;
  p.frenado = PARAMETROS_LOCOMOCION.frenado * escala;
  p.radioLlegada = UMBRAL_LLEGADA;
  // Sin rebase el cuerpo vuelve de su inclinación sin pasarse (resorte crítico).
  p.amortiguacionResorte = OPCIONES.resorteRebase ? PARAMETROS_LOCOMOCION.amortiguacionResorte : 1;
}

/**
 * Un paso de la locomoción hacia `destino`: la locomoción parte de donde está la persona (`sim`
 * manda) y deja ahí su posición y su rumbo. Con `conLlegada` frena para detenerse en el punto
 * (y, ya parada, se acomoda a él); sin ella cruza el punto a su velocidad (nodo intermedio).
 */
function caminarConPeso(sim: Sim, destino: PuntoXZ, conLlegada: boolean, dt: number): void {
  const l = sim.loco;
  l.x = sim.x;
  l.z = sim.z;
  l.rumbo = envolverAngulo(sim.yaw);
  l.fase = sim.ciclo;
  if (conLlegada) {
    if (irHacia(l, destino.x, destino.z, parametrosLoco, dt)) {
      l.x = destino.x;
      l.z = destino.z;
    }
  } else {
    conducir(l, destino.x - l.x, destino.z - l.z, 1, parametrosLoco, dt);
  }
  sim.x = l.x;
  sim.z = l.z;
  sim.yaw = l.rumbo;
}

/**
 * Sentarse y levantarse con curvas (anticipación, rebote al asentar): el progreso avanza a ritmo
 * constante y `sim.sit` es la altura de la curva del sentido vigente.
 */
function avanzarSentado(sim: Sim, sentarse: boolean, dt: number): void {
  const progreso = sim.sitProg;
  const meta = sentarse ? 1 : 0;
  if (meta > progreso.valor) sim.sitDir = 1;
  else if (meta < progreso.valor) sim.sitDir = -1;
  avanzarPeso(progreso, meta, dt, DURACION_SENTARSE);
  if (sim.sitDir > 0) curvaSentarse(progreso.valor, salidaSentarse);
  else curvaLevantarse(1 - progreso.valor, salidaSentarse);
  sim.sit = salidaSentarse.altura;
}

/**
 * Marcha por distancia: piernas, brazos, pelvis y columna salen de `calcularZancada` con la fase
 * (en ciclos) y la velocidad real. El brazo que lleva la taza se queda como lo dejó `calcularPose`.
 */
function aplicarZancada(sim: Sim, salida: Pose, c: ContextoFrame): void {
  if (OPCIONES.caminataPoses) {
    calcularCaminata(sim.ciclo, sim.vel, ciclo);
    if (c.suelo) {
      const l = sim.loco;
      ajustarAlTerreno(
        sim.pies,
        c.suelo,
        ciclo,
        sim.x,
        sim.z,
        sim.yaw,
        l.giro,
        sim.y,
        sim.vel,
        sim.ciclo,
        c.dt,
      );
    }
    conCiclo = true;
    for (let i = 0; i < 2; i++) {
      const lado = i as 0 | 1;
      salida.piernas[lado].cadera = ciclo.cadera[lado];
      salida.piernas[lado].rodilla = ciclo.rodilla[lado];
      if (lado === 1 && entradaPose.llevaTaza) continue;
      const brazo = salida.brazos[lado];
      brazo.hombro = ciclo.hombro[lado];
      brazo.abduccion = ciclo.abduccion[lado];
      brazo.codo = ciclo.codo[lado];
      brazo.muneca = 0;
    }
    salida.pelvisY = ciclo.pelvisY;
    salida.columna = ciclo.inclinacion;
    return;
  }
  calcularZancada(sim.ciclo, sim.vel, zancada);
  for (let i = 0; i < 2; i++) {
    const lado = i as 0 | 1;
    salida.piernas[lado].cadera = zancada.cadera[lado];
    salida.piernas[lado].rodilla = zancada.rodilla[lado];
    if (lado === 1 && entradaPose.llevaTaza) continue;
    const brazo = salida.brazos[lado];
    brazo.hombro = zancada.brazo[lado];
    brazo.abduccion = 0.05;
    brazo.codo = 0.3 + 0.8 * Math.max(0, -brazo.hombro);
    brazo.muneca = 0;
  }
  salida.pelvisY = zancada.pelvisY;
  salida.columna = 0.06 * Math.min(1, sim.vel / velocidadPaseo());
}

/**
 * Movimiento secundario: aplastar y estirar con pisadas y al asentarse, cabeza, brazos y torso
 * con retraso, y un resorte por cada accesorio de `Rig.secundarios`.
 */
function actualizarSecundario(sim: Sim, rig: Rig, dt: number): void {
  const l = sim.loco;
  const conPeso = OPCIONES.resorteCritico;
  if (l.ultimaPisada !== sim.pisadaVista) {
    sim.pisadaVista = l.ultimaPisada;
    impulsoPisada(sim.sec, Math.min(1, sim.vel / velocidadPaseo()));
  }
  if (sim.sit > 0.95) {
    if (!sim.asentado) {
      sim.asentado = true;
      impulsoSentarse(sim.sec, 1);
    }
  } else if (sim.sit < 0.5) {
    sim.asentado = false;
  }
  entradaSec.aceleracionLong = conPeso ? l.aceleracionLong : 0;
  entradaSec.aceleracionLat = conPeso ? l.aceleracionLat : 0;
  entradaSec.giro = conPeso ? l.giro : 0;
  entradaSec.velocidad = sim.vel;
  avanzarSecundario(sim.sec, entradaSec, dt);

  const accesorios = rig.secundarios;
  if (!accesorios || accesorios.length === 0) return;
  // Se crean al primer uso (una vez por persona); después no se asigna nada.
  while (sim.resortesAcc.length < 2 * accesorios.length) sim.resortesAcc.push(crearResorte());
  for (let i = 0; i < accesorios.length; i++) {
    const resorteX = sim.resortesAcc[2 * i] as Resorte;
    const resorteZ = sim.resortesAcc[2 * i + 1] as Resorte;
    // Cada accesorio con su frecuencia, para que mochila, capa y audífonos no vayan al unísono.
    const frecuencia = FRECUENCIA_ACCESORIO + 1.7 * i;
    const meta = conPeso ? l.aceleracionLong : 0;
    const lateral = conPeso ? l.aceleracionLat : 0;
    resorteSub(
      resorteX,
      limitar(-GANANCIA_ACCESORIO * meta, TOPE_ACCESORIO),
      frecuencia,
      AMORTIGUACION_ACCESORIO,
      dt,
    );
    resorteSub(
      resorteZ,
      limitar(0.8 * GANANCIA_ACCESORIO * lateral, TOPE_ACCESORIO),
      frecuencia,
      AMORTIGUACION_ACCESORIO,
      dt,
    );
    const grupo = accesorios[i];
    if (grupo) {
      grupo.rotation.x = resorteX.x;
      grupo.rotation.z = resorteZ.x;
    }
  }
}

/**
 * Cuánto del saludo se aplica (0..1): al empezar, anticipación, subida rápida y rebase
 * (`envolventeGesto`); mientras dura se mantiene, y al terminar baja suave. Dispara además la
 * reacción de cabeceo que lo acompaña.
 */
function pesoDeSaludo(sim: Sim, saludando: boolean, t: number, dt: number): number {
  const peso = sim.pesoSaludo;
  if (saludando) {
    if (sim.saludoDesde < 0) {
      sim.saludoDesde = t;
      dispararSaludo(sim.reaccion, t, 1);
    }
    const s = t - sim.saludoDesde;
    if (s < ATAQUE_SALUDO) {
      envolventeGesto(s, DURACION_SALUDO, envolventeSaludo);
      peso.valor =
        envolventeSaludo.pico +
        envolventeSaludo.rebase -
        ANTICIPACION_SALUDO * envolventeSaludo.anticipacion;
    } else {
      peso.valor = 1;
    }
    return peso.valor;
  }
  sim.saludoDesde = -1;
  avanzarPeso(peso, 0, dt, SUELTA_SALUDO);
  return suavizarPaso(peso.valor);
}

/** Idle que se arma al vuelo con el gesto de vida vigente (se reutiliza: no asigna). */
const idleVida: Idle = { variante: 'respirar', duracion: 1, fase: 0 };

/** El gesto de vida (rascarse, estirarse, mirar el teléfono…) como ajuste, con su peso suave. */
function ajusteDeGestoVida(sim: Sim, tm: number, ajuste: AjusteIdle): void {
  const peso = suavizarPaso(sim.pesoGestoVida.valor);
  if (peso <= 0 || sim.gestoVida < 0) {
    ajusteIdle(IDLE_QUIETO, 0, tm, ajuste);
    return;
  }
  idleVida.variante = GESTOS_VIDA[sim.gestoVida] ?? 'respirar';
  idleVida.fase = sim.vida.temperamento.faseRespiracion * Math.PI * 2;
  ajusteIdle(idleVida, sim.gestoVidaProgreso, tm, ajuste);
  escalarAjuste(ajuste, peso);
}

/**
 * Un cuadro de una persona: máquina de estados → ruta e interacciones → movimiento → pose
 * (ángulos de `calcularPose`) → transformaciones del rig. Solo asigna números (incluidas las
 * celdas de atlas de la cara y el globo); no dibuja texturas ni crea objetos de three.
 * Sin `c.paseos` (prefers-reduced-motion) no hay paseos, interacciones ni idles: solo
 * respiración y parpadeo.
 */
export function actualizarPersona(
  sim: Sim,
  rig: Rig,
  agente: AgenteOficina,
  puesto: Puesto,
  enfocado: boolean,
  seleccionado: boolean,
  c: ContextoFrame,
  relacion: Relacion,
): void {
  if (!OPCIONES.presupuestoLod || c.dt <= SUBPASO_MAX) {
    actualizarCuadro(sim, rig, agente, puesto, enfocado, seleccionado, c, relacion);
    return;
  }
  // Cuadros saltados por el LOD: `c.dt` trae lo acumulado. Se limita y se integra en subpasos,
  // cada uno con su reloj, para que la ruta, la locomoción y la máquina de estados no den saltos.
  const tFinal = c.t;
  const dtTotal = Math.min(c.dt, DT_MAX_CUADRO);
  const pasos = Math.ceil(dtTotal / SUBPASO_MAX);
  const dtPaso = dtTotal / pasos;
  const dtOriginal = c.dt;
  c.dt = dtPaso;
  for (let i = 1; i <= pasos; i++) {
    c.t = tFinal - dtTotal + i * dtPaso;
    actualizarCuadro(sim, rig, agente, puesto, enfocado, seleccionado, c, relacion);
  }
  c.t = tFinal;
  c.dt = dtOriginal;
}

function actualizarCuadro(
  sim: Sim,
  rig: Rig,
  agente: AgenteOficina,
  puesto: Puesto,
  enfocado: boolean,
  seleccionado: boolean,
  c: ContextoFrame,
  relacion: Relacion,
): void {
  const { t, dt } = c;
  const tm = t * c.movimiento + sim.fasePropia;

  if (sim.rol !== agente.rol) {
    sim.rol = agente.rol;
    sim.perfil = perfilDeRol(agente.rol);
    sim.vida = crearVida(sim.vida.semilla, sim.perfil);
  }
  const perfil = sim.perfil;
  const aLaLuz = vaALaLuz(puesto, perfil);
  if (sim.claveRuta !== puesto.clave || sim.aLaLuz !== aLaLuz) {
    // Cambió su lugar o su destino de pausa: se rehace la ruta (rara vez; no es del bucle normal).
    sim.cadena = rutaDelPuesto(puesto, aLaLuz);
    sim.claveRuta = puesto.clave;
    sim.aLaLuz = aLaLuz;
    sim.tramoVisita = false;
    sim.nav.nodo = Math.min(sim.nav.nodo, sim.cadena.length - 1);
    sim.nav.hacia = sim.nav.hacia >= sim.cadena.length ? -1 : sim.nav.hacia;
  }

  // --- interacción vigente (nunca con prefers-reduced-motion) ---
  const inter = c.paseos ? relacion.interaccion : null;
  const socio = relacion.socio;
  const conversando = inter?.tipo === 'conversa' && socio !== null;
  const visita = inter?.tipo === 'visita' && socio !== null ? inter : null;
  const mostrando = visita?.fase === 'mostrar';
  const yendoAVisitar = visita !== null && visita.fase !== 'volver';
  // --- atención al enfoque: quien lo es (o comparte su sala) se detiene y mira ---
  const atencion = relacion.atencion;
  const rolAtencion = atencion?.rol ?? 'ninguno';
  const atento = rolAtencion === 'enfocado' || rolAtencion === 'sala';
  if (rolAtencion !== 'enfocado') {
    sim.modoAtento = 'ninguno';
    sim.atentoListo = true;
  } else if (sim.modoAtento === 'ninguno') {
    // Al empezar el enfoque: si la cámara pide girar la silla más de 45°, se para al costado.
    const sentadoAhora = puesto.sentado && sim.sit > 0.5;
    const pide = sentadoAhora && debePararse(giroHacia(puesto.lugar, c.camara.x, c.camara.z));
    sim.modoAtento =
      pide && costadoLibre(puesto.lugar, c.camara.x, c.camara.z, sim.costado) ? 'costado' : 'aqui';
    sim.atentoListo = sim.modoAtento === 'aqui';
  }
  const alCostado = sim.modoAtento === 'costado';
  const retener = conversando || inter?.tipo === 'visita' || atento;

  // --- ruta: los nodos de visita apuntan al colega mientras dura la visita y el regreso ---
  if (visita && !sim.tramoVisita && sim.nav.nodo <= NODO_PASILLO && relacion.puestoSocio) {
    puesto.rutas.escribirVisita(sim.cadena, relacion.puestoSocio.lugar);
    sim.tramoVisita = true;
  } else if (sim.tramoVisita && !visita && sim.nav.nodo <= NODO_PASILLO) {
    puesto.rutas.quitarVisita(sim.cadena);
    sim.tramoVisita = false;
  }

  // --- decisión: máquina de estados y movimiento ---
  const enDestino = llegoANodo(
    sim.nav,
    sim.meta,
    sim.cadena[sim.meta] ?? puesto.asiento,
    sim.x,
    sim.z,
    UMBRAL_LLEGADA,
  );
  const { maquina, salida } = avanzarMaquina(
    sim.maquina,
    {
      t,
      estado: agente.estado,
      actividad: agente.actividad,
      reduceMotion: !c.paseos,
      enfocado,
      enDestino,
      retener,
      ritmo: rolAtencion === 'ambiente' ? 0.5 : 1,
      sinPaseo: c.retenerEnSala === true,
    },
    c.azar,
  );
  sim.maquina = maquina;
  const ultimo = sim.cadena.length - 1;
  sim.meta = yendoAVisitar ? NODO_VISITA : nodoDe(salida.objetivo, sim.cadena);
  // Quien atiende al enfoque se queda donde está; al soltarlo retoma la ruta desde ahí.
  // Un nodo intermedio se da por pasado dentro del radio de giro (v / giro máximo): a velocidad de
  // juego, con 3 cm, la persona orbitaría el nodo sin alcanzarlo.
  const umbralNodo = OPCIONES.caminataPoses
    ? (1.2 * sim.loco.velocidad) / PARAMETROS_LOCOMOCION.giroMax
    : 0;
  if (!atento) avanzarNav(sim.nav, sim.cadena, sim.meta, sim.x, sim.z, UMBRAL_LLEGADA, umbralNodo);

  const enPausa = salida.paseando && salida.postura === 'de_pie';
  const quieto = sim.nav.hacia < 0 && sim.nav.nodo === sim.meta;
  let destino = destinoNav(sim.nav, sim.cadena) ?? puesto.asiento;
  if (atento) {
    puntoAqui.x = alCostado ? sim.costado.x : sim.x;
    puntoAqui.z = alCostado ? sim.costado.z : sim.z;
    destino = puntoAqui;
  }
  if (quieto) {
    if (conversando && inter && enPausa) destino = inter;
    else if (enPausa && perfil.pausa === 'telefono_circulo' && sim.meta === ultimo) {
      const angulo = tm * GIRO_CIRCULO;
      puntoCirculo.x = puesto.cafe.x + Math.cos(angulo) * RADIO_CIRCULO;
      puntoCirculo.z = puesto.cafe.z + Math.sin(angulo) * RADIO_CIRCULO;
      destino = puntoCirculo;
    }
  }
  sim.destino.x = destino.x;
  sim.destino.z = destino.z;
  const dx = destino.x - sim.x;
  const dz = destino.z - sim.z;
  const distancia = Math.hypot(dx, dz);

  const sentadoEnSuSitio = quieto && sim.meta === NODO_ASIENTO && distancia <= UMBRAL_LLEGADA;
  let yawDeseado = salida.sentarse ? puesto.yawSentado : Math.PI / 4;
  if (salida.paseando && salida.postura === 'de_pie') {
    yawDeseado = Math.PI / 4 + Math.sin(tm * 0.4) * 0.5;
    if (perfil.pausa === 'probar_luz') yawDeseado = 0.35;
  }
  // Retenido en su sala, quien estaba fuera vuelve al doble de ritmo.
  const velocidad = velocidadPaseo() * c.movimiento * (c.retenerEnSala ? 2 : 1);
  // Con locomoción sigue «caminando» hasta frenar del todo, aunque ya esté a menos del umbral.
  const caminaAhora =
    sim.sit < 0.08 &&
    (distancia > UMBRAL_LLEGADA ||
      (OPCIONES.resorteCritico && sim.loco.velocidad >= VELOCIDAD_PARADA));
  const x0 = sim.x;
  const z0 = sim.z;
  let yawPorLocomocion = false;
  if (OPCIONES.resorteCritico) {
    prepararLocomocion(velocidad);
    if (caminaAhora) {
      // Un nodo intermedio se cruza sin frenar; solo el destino final (quieto) tiene llegada.
      const conLlegada =
        destino !== puntoCirculo && (atento || sim.nav.hacia < 0 || sim.nav.hacia === sim.meta);
      caminarConPeso(sim, destino, conLlegada, dt);
      yawPorLocomocion = true;
      yawDeseado = sim.yaw;
    } else {
      conducir(sim.loco, 0, 0, 0, parametrosLoco, dt);
    }
  } else if (caminaAhora) {
    const paso = Math.min(distancia, dt * velocidad + 0.0001);
    sim.x += (dx / distancia) * paso;
    sim.z += (dz / distancia) * paso;
    yawDeseado = Math.atan2(dx, dz);
  }
  if (caminaAhora && !OPCIONES.marchaPorDistancia) {
    sim.fase += frecuenciaPaso(velocidad, LARGO_PIERNA) * dt;
  }
  sim.vel = dt > 0 ? Math.hypot(sim.x - x0, sim.z - z0) / dt : 0;
  if (OPCIONES.marchaPorDistancia)
    sim.ciclo = OPCIONES.caminataPoses
      ? avanzarFaseCaminata(sim.ciclo, sim.vel, dt)
      : avanzarFase(sim.ciclo, sim.vel, dt);
  if (!caminaAhora && quieto && socio && (conversando || mostrando)) {
    // Quieto frente al otro: de cara a quien conversa, o a la pantalla que va a señalar.
    const haciaX = mostrando ? socio.x + Math.sin(socio.yaw) * 0.75 : socio.x;
    const haciaZ = mostrando ? socio.z + Math.cos(socio.yaw) * 0.75 : socio.z;
    yawDeseado = Math.atan2(haciaX - sim.x, haciaZ - sim.z);
  }
  if (atento && !caminaAhora && atencion) {
    // De cara a la cámara (el enfocado) o a quien presentan (el resto de la sala).
    const aAsistente = rolAtencion === 'sala' && atencion.objetivo === ASISTENTE;
    const aFoco = rolAtencion === 'sala' && !aAsistente && relacion.foco !== null;
    const haciaX = aAsistente ? c.asistente.x : aFoco ? (relacion.foco?.x ?? 0) : c.camara.x;
    const haciaZ = aAsistente ? c.asistente.z : aFoco ? (relacion.foco?.z ?? 0) : c.camara.z;
    yawDeseado = yawObjetivoAtento(
      sim.sit > 0.5 && !alCostado,
      puesto.yawSentado,
      rolAtencion === 'enfocado' ? GIRO_SILLA_ENFOCADO : GIRO_SILLA_SALA,
      sim.x,
      sim.z,
      haciaX,
      haciaZ,
    );
  }
  sim.marcha = suave(sim.marcha, caminaAhora ? 1 : 0, dt, 8);
  const sentarseAhora = salida.sentarse && puesto.sentado && sentadoEnSuSitio && !alCostado;
  if (OPCIONES.transiciones) {
    avanzarSentado(sim, sentarseAhora, dt);
  } else {
    sim.sit = suave(sim.sit, sentarseAhora ? 1 : 0, dt, 3);
  }
  if (relacion.mirada && !caminaAhora) {
    yawDeseado = Math.atan2(relacion.mirada.x - sim.x, relacion.mirada.z - sim.z);
  }
  if (!yawPorLocomocion) {
    const yawAntes = sim.yaw;
    sim.yaw = suaveAngulo(sim.yaw, yawDeseado, dt, 6);
    if (OPCIONES.resorteCritico) {
      // Con peso, el cuerpo tampoco gira parado más rápido que su velocidad angular máxima.
      const tope = PARAMETROS_LOCOMOCION.giroMax * dt;
      sim.yaw = yawAntes + limitar(envolverAngulo(sim.yaw - yawAntes), tope);
    }
  }
  // La altura del piso sigue la ruta (en una escalera sube o baja con la distancia recorrida);
  // si la meta cambió a mitad de tramo, alcanza el nodo a la velocidad del paseo, sin saltos.
  const dy = alturaNav(sim.nav, sim.cadena, sim.x, sim.z) - sim.y;
  const tope = dt * velocidad * 1.5 + 0.0001;
  sim.y += Math.abs(dy) <= tope ? dy : Math.sign(dy) * tope;
  if (alCostado) {
    sim.atentoListo = !caminaAhora && sim.sit < 0.1 && Math.hypot(dx, dz) <= UMBRAL_LLEGADA;
  }
  rig.raiz.position.set(sim.x, sim.y - BAJA_SENTADO * sim.sit, sim.z);
  rig.raiz.rotation.y = sim.yaw;
  if (OPCIONES.aplastarEstirar) actualizarSecundario(sim, rig, dt);

  // --- pose: ángulos de la lógica pura ---
  const caminando = sim.marcha > 0.03 && sim.sit < 0.5;
  const tazaVisible = enPausa || (salida.paseando && salida.postura === 'volviendo');
  const conTaza = tazaVisible && perfil.pausa === 'cafe';
  // En una conversación se alternan los turnos: quien habla gesticula, quien escucha asiente.
  const turnoPropio =
    conversando && inter
      ? (Math.floor((t - inter.inicio) / TURNO) % 2 === 0) === inter.primerTurno
      : false;
  // Gesto de quien es enfocado: una vez por enfoque (sin gestos amplios con reduced-motion).
  const gestoActivo =
    c.paseos &&
    rolAtencion === 'enfocado' &&
    atencion !== null &&
    atencion.gesto !== 'ninguno' &&
    t - atencion.gestoDesde < SEGUNDOS_GESTO;
  const asintiendo = gestoActivo && atencion?.gesto === 'asentir';
  const saludando =
    !caminando &&
    (relacion.gesto === 'saludo' ||
      (!salida.sentarse &&
        !salida.paseando &&
        (agente.estado === 'esperando_decision' || enfocado)) ||
      (gestoActivo && atencion?.gesto === 'saludo' && sim.sit < 0.5));
  const postura: PosturaCuerpo = caminando ? 'caminando' : sim.sit > 0.5 ? 'sentado' : 'de_pie';
  entradaPose.fase = sim.fase;
  entradaPose.postura = postura;
  entradaPose.velocidad = sim.marcha;
  entradaPose.actividad =
    (turnoPropio || relacion.gesto === 'explicar') && !caminando ? 'hablando' : salida.actividad;
  entradaPose.t = tm;
  entradaPose.llevaTaza = conTaza && !turnoPropio;
  // Con transiciones el saludo no se cuelga de un corte: entra y sale con su envolvente.
  entradaPose.saludando = OPCIONES.transiciones ? false : saludando;
  calcularPose(entradaPose, pose);
  conCiclo = false;
  if (OPCIONES.marchaPorDistancia && caminando) aplicarZancada(sim, pose, c);

  let piernas = pose.piernas;
  if (!caminando && sim.sit > 0.02 && sim.sit < 0.98) {
    entradaPose.postura = 'de_pie';
    calcularPose(entradaPose, poseDePie);
    entradaPose.postura = 'sentado';
    calcularPose(entradaPose, poseSentada);
    if (OPCIONES.transiciones) mezclarPoses(poseDePie, poseSentada, sim.sit, pose);
    else piernas = mezclarPiernas(poseDePie, poseSentada, sim.sit, piernasMezcla);
  }
  let pelvisY = 0.62 + pose.pelvisY;
  let pelvisZ = 0;
  if (OPCIONES.transiciones) {
    pose.columna += salidaSentarse.inclinacionTorso;
    pelvisY -= IMPACTO_PELVIS * salidaSentarse.impacto;
    pelvisZ = -PELVIS_ATRAS * Math.sin(Math.PI * salidaSentarse.pelvisAtras);
  }
  if (OPCIONES.aplastarEstirar) pelvisY += (sim.sec.escalaY.x - 1) * APLASTAR_PELVIS;
  const pesoSalud = OPCIONES.transiciones ? pesoDeSaludo(sim, saludando, t, dt) : 0;
  if (pesoSalud > 0) {
    entradaPose.saludando = true;
    calcularPose(entradaPose, poseSaludo);
    entradaPose.saludando = false;
    const de = pose.brazos[1];
    const a = poseSaludo.brazos[1];
    de.hombro = lerp(de.hombro, a.hombro, pesoSalud);
    de.abduccion = lerp(de.abduccion, a.abduccion, pesoSalud);
    de.codo = lerp(de.codo, a.codo, pesoSalud);
    de.muneca = lerp(de.muneca, a.muneca, pesoSalud);
  }
  rig.pelvis.position.y = pelvisY;
  rig.pelvis.position.z = pelvisZ;
  for (let i = 0; i < 2; i++) {
    const pierna = piernas[i as 0 | 1];
    const articulacion = rig.piernas[i as 0 | 1];
    articulacion.cadera.rotation.x = pierna.cadera;
    articulacion.rodilla.rotation.x = pierna.rodilla;
    // Ciclo por poses: la pierna deshace el giro y el ladeo de la pelvis (orden YXZ).
    if (articulacion.cadera.rotation.order !== 'YXZ') articulacion.cadera.rotation.order = 'YXZ';
    articulacion.cadera.rotation.y = conCiclo ? -ciclo.pelvisGiro : 0;
    articulacion.cadera.rotation.z = conCiclo ? -ciclo.pelvisLadeo : 0;
  }
  rig.pelvis.rotation.y = conCiclo ? ciclo.pelvisGiro : 0;
  rig.columna.rotation.y = conCiclo ? ciclo.torsoGiro : 0;
  rig.columna.position.x = conCiclo ? ciclo.pelvisX : 0;

  // --- vida en reposo: respiración, parpadeo y (quieto, sin trabajo) peso, deriva y gestos ---
  const vidaQuieto =
    c.paseos &&
    !caminando &&
    !saludando &&
    !atento &&
    !conversando &&
    !mostrando &&
    !asintiendo &&
    !(enPausa && perfil.pausa !== 'cafe') &&
    salida.actividad === undefined;
  const vida = sim.ajusteVida;
  let pesoVida = 0;
  if (OPCIONES.vida) {
    avanzarVida(sim.vida, dt, vidaQuieto, t, c.azar, vida);
    avanzarPeso(sim.pesoVida, vidaQuieto ? 1 : 0, dt, SEGUNDOS_PESO_VIDA);
    pesoVida = suavizarPaso(sim.pesoVida.valor);
    // `avanzarVida` corta el gesto de golpe al dejar de estar quieto: el último se desvanece.
    if (vida.gestoVariante >= 0) {
      sim.gestoVida = vida.gestoVariante;
      sim.gestoVidaProgreso = vida.gestoProgreso;
    }
    avanzarPeso(sim.pesoGestoVida, vida.gestoVariante >= 0 ? 1 : 0, dt, SEGUNDOS_PESO_GESTO);
    // Peso, rodillas y ladeo de la cadera: solo de pie o sentándose, no con la silla ya tomada.
    const pesoPie = pesoVida * (1 - sim.sit);
    rig.pelvis.position.x = vida.pesoCadera * pesoPie;
    rig.pelvis.rotation.z = vida.alabeoPelvis * pesoPie + (conCiclo ? ciclo.pelvisLadeo : 0);
    rig.piernas[0].rodilla.rotation.x += vida.rodillaIzq * pesoPie;
    rig.piernas[1].rodilla.rotation.x += vida.rodillaDer * pesoPie;
  } else {
    rig.pelvis.position.x = 0;
    rig.pelvis.rotation.z = conCiclo ? ciclo.pelvisLadeo : 0;
  }

  // --- idle: de personalidad (libre y sentado), de pausa o de interacción ---
  if (c.paseos && t - sim.idleDesde > sim.idle.duracion) {
    sim.idle = nuevoIdle(c.azar, perfil.pesos);
    sim.idleDesde = t;
  }
  const ajuste = sim.ajuste;
  if (relacion.gesto === 'asentir' && !caminando) {
    ajusteIdle(IDLE_ASENTIR, PLENO, tm, ajuste);
  } else if (!c.paseos || caminando || saludando) {
    ajusteIdle(IDLE_QUIETO, 0, tm, ajuste);
  } else if (asintiendo && atencion) {
    if (OPCIONES.transiciones) {
      // Cabeceo con anticipación y rebase en vez del seno simple.
      envolventeGesto(t - atencion.gestoDesde, SEGUNDOS_GESTO, envolventeAsentir);
      ajusteIdle(IDLE_ASENTIR, PLENO, tm, ajuste);
      escalarAjuste(
        ajuste,
        envolventeAsentir.pico +
          envolventeAsentir.rebase -
          ANTICIPACION_ASENTIR * envolventeAsentir.anticipacion,
      );
    } else {
      ajusteIdle(IDLE_ASENTIR, (t - atencion.gestoDesde) / SEGUNDOS_GESTO, tm, ajuste);
    }
  } else if (atento) {
    // Atento: solo respira y parpadea.
    ajusteIdle(IDLE_QUIETO, 0, tm, ajuste);
  } else if (conversando) {
    ajusteIdle(turnoPropio ? IDLE_QUIETO : IDLE_ASENTIR, PLENO, tm, ajuste);
  } else if (mostrando && quieto) {
    ajusteIdle(IDLE_SENALAR, PLENO, tm, ajuste);
  } else if (enPausa && perfil.pausa !== 'cafe') {
    ajusteIdle(perfil.pausa === 'probar_luz' ? IDLE_LUZ : IDLE_TELEFONO, PLENO, tm, ajuste);
  } else if (agente.estado === 'libre' && !conTaza && (!inter || inter.tipo === 'ninguna')) {
    if (OPCIONES.vida) ajusteDeGestoVida(sim, tm, ajuste);
    else ajusteIdle(sim.idle, (t - sim.idleDesde) / sim.idle.duracion, tm, ajuste);
  } else {
    ajusteIdle(IDLE_QUIETO, 0, tm, ajuste);
  }
  sim.columna = suave(sim.columna, pose.columna + ajuste.columna, dt, 6);
  rig.columna.rotation.x = OPCIONES.resorteCritico
    ? sim.columna + sim.loco.inclinacion.x
    : sim.columna;
  // Alabeo hacia la curva (z negativa en el rig) y contracurva del peso en reposo.
  rig.columna.rotation.z =
    (OPCIONES.resorteCritico ? -sim.loco.alabeo.x : 0) +
    (OPCIONES.vida ? vida.alabeoColumna * pesoVida * (1 - sim.sit) : 0);

  // --- brazos: del objetivo de la pose (o del idle) al ángulo suavizado ---
  for (let i = 0; i < 2; i++) {
    const lado = i as 0 | 1;
    const objetivoBrazo = pose.brazos[lado];
    const estado = sim.brazos[lado];
    const mezcla = ajuste.mezcla[lado];
    // Con el ciclo por poses el brazo sigue al ciclo tal cual: suavizarlo le quita amplitud y lo atrasa.
    const directo = conCiclo && !(lado === 1 && entradaPose.llevaTaza);
    estado.hombro = directo
      ? objetivoBrazo.hombro
      : suave(estado.hombro, lerp(objetivoBrazo.hombro, ajuste.hombro[lado], mezcla), dt, 6);
    estado.codo = directo
      ? objetivoBrazo.codo
      : suave(estado.codo, lerp(objetivoBrazo.codo, ajuste.codo[lado], mezcla), dt, 6);
    estado.abduccion = directo
      ? objetivoBrazo.abduccion
      : suave(estado.abduccion, objetivoBrazo.abduccion, dt, 6);
    const brazo = rig.brazos[lado];
    brazo.hombro.rotation.x = OPCIONES.aplastarEstirar
      ? estado.hombro + sim.sec.brazo[lado].x
      : estado.hombro;
    brazo.hombro.rotation.z = (lado === 0 ? -1 : 1) * estado.abduccion;
    brazo.codo.rotation.x = -(estado.codo + objetivoBrazo.muneca);
  }
  rig.taza.ancla.visible = rig.tazaEquipada || conTaza || ajuste.prop === 'taza';
  rig.hoja.ancla.visible = ajuste.prop === 'hoja';
  rig.telefono.ancla.visible = ajuste.prop === 'telefono';

  // --- respiración (con vida, de frecuencia propia y centrada en 0) y aplastar-estirar del torso ---
  const respiro = OPCIONES.vida
    ? 2 * vida.respiracion - sim.vida.temperamento.ampRespiracion
    : Math.sin(tm * 1.7);
  if (OPCIONES.aplastarEstirar) {
    rig.torso.scale.set(
      (1 + respiro * 0.008) * sim.sec.escalaXZ,
      (1 + respiro * 0.012) * sim.sec.escalaY.x,
      (1 + respiro * 0.012) * sim.sec.escalaXZ,
    );
    rig.torso.rotation.z = -sim.sec.torsoRoll.x;
  } else {
    rig.torso.scale.set(1 + respiro * 0.008, 1 + respiro * 0.012, 1 + respiro * 0.012);
    rig.torso.rotation.z = 0;
  }

  // --- mirada: al otro en una interacción; si no, hacia Asistente o la cámara ---
  cabezaMundo.x = sim.x;
  cabezaMundo.y = alturaCabeza(sim.y, sim.sit);
  cabezaMundo.z = sim.z;
  const esperandoDePie = agente.estado === 'esperando_decision' && sim.sit < 0.5;
  const jx = c.asistente.x - sim.x;
  const jy = c.asistente.y - cabezaMundo.y;
  const jz = c.asistente.z - sim.z;
  const distanciaAsistente2 = jx * jx + jy * jy + jz * jz;
  // Quien espera una decisión mira al usuario; solo sigue al orbe cuando pasa cerca.
  sim.atencionOrbe = atencionOrbe(
    sim.atencionOrbe,
    esperandoDePie && c.paseos && !atento ? Math.sqrt(distanciaAsistente2) : Infinity,
    dt,
  );
  const cercaDeAsistente =
    !esperandoDePie && distanciaAsistente2 < DISTANCIA_MIRA_ASISTENTE * DISTANCIA_MIRA_ASISTENTE;

  let miraAlOtro = false;
  if (socio && (conversando || mostrando || inter?.tipo === 'recibe')) {
    const haciaPantalla = mostrando;
    const recibe =
      inter?.tipo === 'recibe' &&
      Math.hypot(socio.x - sim.x, socio.z - sim.z) < DISTANCIA_RECIBE &&
      socio.sit < 0.5;
    if (conversando || haciaPantalla || recibe) {
      objetivoSocio.x = haciaPantalla ? socio.x + Math.sin(socio.yaw) * 0.75 : socio.x;
      objetivoSocio.z = haciaPantalla ? socio.z + Math.cos(socio.yaw) * 0.75 : socio.z;
      objetivoSocio.y = haciaPantalla ? socio.y + 1.1 : alturaCabeza(socio.y, socio.sit);
      miraAlOtro = true;
    }
  }
  // Atención al enfoque: el enfocado mira a cámara; su sala, a él o al asistente; sin enfoque, quien
  // está sentado en el ambiente de la cámara mira su pantalla, no la pared.
  let objetivoMirada: Vec3 = miraAlOtro ? objetivoSocio : cercaDeAsistente ? c.asistente : c.camara;
  let mirandoAtencion = false;
  if (atento && atencion) {
    mirandoAtencion = true;
    if (rolAtencion === 'enfocado') objetivoMirada = c.camara;
    else if (atencion.objetivo === ASISTENTE || !relacion.foco) objetivoMirada = c.asistente;
    else {
      objetivoSocio.x = relacion.foco.x;
      objetivoSocio.z = relacion.foco.z;
      objetivoSocio.y = alturaCabeza(relacion.foco.y, relacion.foco.sit);
      objetivoMirada = objetivoSocio;
    }
  } else if (rolAtencion === 'ambiente' && sim.sit > 0.5 && !miraAlOtro) {
    mirandoAtencion = true;
    objetivoSocio.x = puesto.escritorio.x;
    objetivoSocio.z = puesto.escritorio.z;
    objetivoSocio.y = sim.y + PANTALLA_Y;
    objetivoMirada = objetivoSocio;
  }
  if (relacion.mirada) {
    objetivoMirada = relacion.mirada;
    mirandoAtencion = true;
  }
  entradaMirada.yawCuerpo = sim.yaw;
  entradaMirada.objetivo = objetivoMirada;
  const mirada = calcularMirada(entradaMirada, miradaHaciaObjetivo);
  let miradaYaw = mirada.yaw;
  let miradaPitch = mirada.pitch;
  if (sim.atencionOrbe > 0 && !atento && !relacion.mirada) {
    entradaMirada.objetivo = c.asistente;
    calcularMirada(entradaMirada, miradaAlOrbe);
    miradaYaw = lerp(miradaYaw, miradaAlOrbe.yaw, sim.atencionOrbe);
    miradaPitch = lerp(miradaPitch, miradaAlOrbe.pitch, sim.atencionOrbe);
  }
  if (OPCIONES.interes && c.paseos && !miraAlOtro && !mirandoAtencion) {
    // A quien habla o pasa cerca (con la latencia propia de cada persona); al soltarlo, la
    // mirada vuelve despacio con el último punto que miraba.
    const candidatos = relacion.candidatos;
    yoInteres.x = sim.x;
    yoInteres.z = sim.z;
    yoInteres.id = sim.idNum;
    elegirInteres(
      sim.interes,
      candidatos ? candidatos.c : SIN_CANDIDATOS,
      candidatos ? candidatos.n : 0,
      yoInteres,
      t,
      dt,
      sim.salidaInteres,
    );
    const indice = sim.salidaInteres.objetivoIndice;
    if (candidatos && indice >= 0) {
      objetivoInteres.x = candidatos.c.x[indice] as number;
      objetivoInteres.z = candidatos.c.z[indice] as number;
      objetivoInteres.y = cabezaMundo.y;
      entradaMirada.objetivo = objetivoInteres;
      calcularMirada(entradaMirada, miradaInteres);
      sim.interesYaw = miradaInteres.yaw;
      sim.interesPitch = miradaInteres.pitch;
    }
    miradaYaw = lerp(miradaYaw, sim.interesYaw, sim.salidaInteres.peso);
    miradaPitch = lerp(miradaPitch, sim.interesPitch, sim.salidaInteres.peso);
  }
  const trabajandoSentado = agente.estado === 'trabajando' && sim.sit > 0.5;
  // Trabajando mira sobre todo su pantalla: solo echa un vistazo hacia Asistente (o recibe a quien llega).
  const peso = trabajandoSentado && !miraAlOtro && !mirandoAtencion ? 0.3 : 1;
  let yawObjetivo = miradaYaw * peso + ajuste.cabezaYaw + pose.cabezaYaw;
  let pitchObjetivo = miradaPitch * peso + ajuste.cabezaPitch + pose.cabezaPitch;
  if (trabajandoSentado && !miraAlOtro && !mirandoAtencion) {
    yawObjetivo += Math.sin(tm * 0.7) * 0.12;
    pitchObjetivo -= 0.1 + Math.sin(tm * 2.3) * 0.04;
  }
  if (OPCIONES.vida) {
    // Deriva de la cabeza en reposo.
    yawObjetivo += vida.cabezaYaw * pesoVida;
    pitchObjetivo += vida.cabezaPitch * pesoVida;
  }
  if (OPCIONES.transiciones) {
    // Cabeceo que acompaña al saludo, con su envolvente.
    avanzarReaccion(sim.reaccion, t, salidaReaccion);
    pitchObjetivo -= 0.2 * salidaReaccion.cabezaAsentir;
  }
  sim.mirYaw = suavizar(sim.mirYaw, limitar(yawObjetivo, LIMITE_YAW), dt, TAU_MIRADA);
  sim.mirPitch = suavizar(sim.mirPitch, pitchObjetivo, dt, TAU_MIRADA);
  rig.cabeza.rotation.y = sim.mirYaw + (conCiclo ? ciclo.cabezaYaw : 0);
  // calcularMirada: pitch positivo = arriba; en three rotation.x positivo inclina hacia abajo.
  rig.cabeza.rotation.x =
    (OPCIONES.aplastarEstirar ? -(sim.mirPitch + sim.sec.cabezaPitch.x) : -sim.mirPitch) -
    (conCiclo ? ciclo.cabezaPitch : 0);
  rig.cabeza.rotation.z =
    (OPCIONES.aplastarEstirar ? -sim.sec.cabezaRoll.x : 0) +
    (OPCIONES.vida ? vida.cabezaRoll * pesoVida : 0);

  // --- cara: estilo según estado, parpadeo entre dos celdas del atlas de caras ---
  if (sim.estadoVisto !== agente.estado || sim.caraFijaVista !== rig.caraFija) {
    sim.estadoVisto = agente.estado;
    sim.caraFijaVista = rig.caraFija;
    sim.cara = caraPorEstado(agente.estado, c.azar);
  }
  if (rig.cara) {
    const estilo = rig.caraFija ?? sim.cara;
    const celdas = celdasCara(estilo);
    if (OPCIONES.vida) {
      // Parpadeo con el reloj propio de cada persona.
      rig.cara.celda = vida.parpadeo ? celdas[1] : celdas[0];
    } else {
      let transcurrido = t - sim.planDesde;
      if (transcurrido > sim.plan.espera + 0.6) {
        sim.plan = planParpadeo(c.azar);
        sim.planDesde = t;
        transcurrido = 0;
      }
      rig.cara.celda = estaParpadeando(sim.plan, transcurrido) ? celdas[1] : celdas[0];
    }
  }

  // --- globo de estado y aro ---
  if (agente.estado === 'libre') {
    rig.icono.ancla.visible = false;
  } else {
    rig.icono.celda = celdaIcono(agente.estado);
    rig.icono.ancla.visible = true;
    rig.icono.ancla.position.y = rig.alturaIcono + Math.sin(tm * 3) * 0.03;
  }
  const conAro = agente.estado === 'esperando_decision' || seleccionado;
  rig.anillo.visible = conAro;
  if (conAro) {
    rig.anillo.position.set(sim.x, sim.y + 0.01, sim.z);
    rig.anillo.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
  }
}
