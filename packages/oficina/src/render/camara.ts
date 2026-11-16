import { ESPESOR_LOSA } from '../mansion/plano';
import type { Ambiente } from '../mansion/plano';
import { OPCIONES } from '../animacion/opciones';
import type { Vistas } from '../escenarios/tipos';
import { crearResorte, resorteCritico, suavizarExp } from '../animacion/resorte';
import type { Resorte } from '../animacion/resorte';
import {
  AZIMUT_AMBIENTE,
  ELEVACION_AMBIENTE_MAX,
  ELEVACION_AMBIENTE_MIN,
  ELEVACION_GENERAL_MAX,
  ELEVACION_GENERAL_MIN,
  ELEVACION_INICIAL,
} from './orbita';
import { lineaLibre } from './visual';
import { separarObstaculos } from './camaraObstaculos';
import { distanciaLibreVolumen } from './camaraColision';

export interface Punto3 {
  x: number;
  y: number;
  z: number;
}

/** Lente larga: FOV vertical de la casa de muñecas, en grados. */
export const FOV_VERTICAL = 28;
const TAN_MEDIO_FOV = Math.tan((FOV_VERTICAL * Math.PI) / 360);

/** Caja que debe caber entera en pantalla. */
interface Caja3 {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/** La casa entera: 32 m de ancho, del terreno cortado (y -4) a la cima de la torre, y la piscina al frente. */
const CAJA_CASA: Caja3 = { x0: -16, x1: 16, y0: -4, y1: 15.5, z0: -4, z1: 10 };
const MARGEN_CASA = 0.9;
const MARGEN_AMBIENTE = 0.95;
/** Alto con que se encuadra un ambiente sin techo (la terraza). */
const ALTO_SIN_TECHO = 2.5;

/** Una vista: dónde está la cámara, a qué mira y a cuántos metros. */
export interface Encuadre {
  posicion: Punto3;
  objetivo: Punto3;
  distancia: number;
}

/**
 * Cámara de frente y elevada que mira el centro de `caja` desde la distancia justa para que
 * sus 8 esquinas queden dentro de la pantalla (con `margen` = fracción útil del medio-ancho
 * y medio-alto). Cerrada: no itera; cada esquina pide una distancia mínima y gana la mayor.
 */
function encuadrarCaja(
  caja: Caja3,
  ancho: number,
  alto: number,
  margen: number,
  elevacion = ELEVACION_INICIAL,
): Encuadre {
  const objetivo = {
    x: (caja.x0 + caja.x1) / 2,
    y: (caja.y0 + caja.y1) / 2,
    z: (caja.z0 + caja.z1) / 2,
  };
  const tanV = TAN_MEDIO_FOV * margen;
  const tanH = tanV * (ancho / alto);
  const seno = Math.sin(elevacion);
  const coseno = Math.cos(elevacion);
  let distancia = 0;
  for (const x of [caja.x0, caja.x1]) {
    for (const y of [caja.y0, caja.y1]) {
      for (const z of [caja.z0, caja.z1]) {
        const dy = y - objetivo.y;
        const dz = z - objetivo.z;
        // Ejes de la cámara: adelante = (0, -seno, -coseno); arriba = (0, coseno, -seno).
        const lateral = Math.abs(x - objetivo.x);
        const vertical = Math.abs(dy * coseno - dz * seno);
        const profundidad = -dy * seno - dz * coseno;
        distancia = Math.max(
          distancia,
          lateral / tanH - profundidad,
          vertical / tanV - profundidad,
        );
      }
    }
  }
  return {
    posicion: {
      x: objetivo.x,
      y: objetivo.y + distancia * seno,
      z: objetivo.z + distancia * coseno,
    },
    objetivo,
    distancia,
  };
}

/** La casa completa de frente. En retrato el ancho manda y la casa se ve entera. */
export function encuadreCasa(ancho: number, alto: number): Encuadre {
  return encuadrarCaja(CAJA_CASA, ancho, alto, MARGEN_CASA);
}

/** Pantallas más altas que esto (alto/ancho) se encuadran por planta y no por la casa entera. */
const ASPECTO_VERTICAL = 1.2;
/** Mitad del ancho (m) de la zona que se ve en vertical: el atrio y sus vecinos. */
const SEMIANCHO_PLANTA = 8;
const ALTO_PLANTA = 9;
const MARGEN_PLANTA = 0.95;
/** Base de la casa por el frente (m), donde empieza el terreno visible, y su altura en pantalla (NDC). */
const BASE_CASA = { y: -2, z: 9 };
const NDC_BASE_CASA = -0.72;
const GRADOS = Math.PI / 180;

/** Lo que fija una vista general: la caja entera, la de pantallas verticales, la base a bajar y la elevación (rad). */
interface ParametrosGeneral {
  general: Caja3;
  vertical: Caja3;
  base?: { y: number; z: number };
  elevacion: number;
  /** Elevación (rad) en pantallas verticales; por defecto `elevacion`. */
  elevacionVertical?: number;
  margen?: number;
}

/**
 * Encuadre según la proporción de la pantalla. En horizontal, `general` entera. En vertical la caja
 * ocupa un tercio y el resto sería vacío: se encuadra `vertical` (más angosta, subida `nivelY` metros) y,
 * si hay `base`, el punto de mira se corre hacia arriba hasta que esa base caiga a `NDC_BASE_CASA` y el
 * terreno de delante no ocupe más de ~15 % del alto.
 */
function encuadrarGeneral(p: ParametrosGeneral, ancho: number, alto: number, nivelY: number) {
  if (alto <= ancho * ASPECTO_VERTICAL) {
    return encuadrarCaja(p.general, ancho, alto, p.margen ?? MARGEN_CASA, p.elevacion);
  }
  const elevacion = p.elevacionVertical ?? p.elevacion;
  const base = encuadrarCaja(
    { ...p.vertical, y0: p.vertical.y0 + nivelY, y1: p.vertical.y1 + nivelY },
    ancho,
    alto,
    MARGEN_PLANTA,
    elevacion,
  );
  if (!p.base) return base;
  // La distancia la manda el ancho; la altura del punto de mira se corre hacia arriba.
  const seno = Math.sin(elevacion);
  const coseno = Math.cos(elevacion);
  const k = NDC_BASE_CASA * TAN_MEDIO_FOV;
  const b = p.base.z - base.objetivo.z;
  const a = (b * (seno - k * coseno) + k * base.distancia) / (coseno + k * seno);
  const y = p.base.y - a + nivelY;
  return {
    posicion: {
      x: base.objetivo.x,
      y: y + base.distancia * seno,
      z: base.objetivo.z + base.distancia * coseno,
    },
    objetivo: { x: base.objetivo.x, y, z: base.objetivo.z },
    distancia: base.distancia,
  };
}

const PARAMETROS_CASA: ParametrosGeneral = {
  general: CAJA_CASA,
  vertical: {
    x0: -SEMIANCHO_PLANTA,
    x1: SEMIANCHO_PLANTA,
    y0: 0,
    y1: ALTO_PLANTA,
    z0: CAJA_CASA.z0,
    z1: CAJA_CASA.z1,
  },
  base: BASE_CASA,
  elevacion: ELEVACION_INICIAL,
};

/**
 * Encuadre inicial de la casa según la proporción de la pantalla. En horizontal, la casa entera. En
 * vertical se acerca y se centra en la planta de `nivelY` (la del avatar o la de más gente; por
 * defecto la baja), a lo ancho del atrio.
 */
export function encuadreInicial(ancho: number, alto: number, nivelY = 0): Encuadre {
  return encuadrarGeneral(PARAMETROS_CASA, ancho, alto, nivelY);
}

/** Mitad central (en x) de una caja: lo que se encuadra en vertical si el escenario no trae `generalVertical`. */
const recorteCentral = (c: Caja3): Caja3 => {
  const medio = (c.x0 + c.x1) / 2;
  const mitad = (c.x1 - c.x0) / 4;
  return { ...c, x0: medio - mitad, x1: medio + mitad };
};

/**
 * Vista general de un escenario: `vistas.general` entera en horizontal; en vertical,
 * `vistas.generalVertical` (o el recorte central de `general`), con la elevación `elevacionGeneral`.
 * Para la mansión da lo mismo que `encuadreInicial`.
 */
export function encuadreGeneral(vistas: Vistas, ancho: number, alto: number, nivelY = 0): Encuadre {
  return encuadrarGeneral(
    {
      general: vistas.general,
      vertical: vistas.generalVertical ?? recorteCentral(vistas.general),
      base: vistas.baseVertical,
      elevacion: vistas.elevacionGeneral * GRADOS,
      elevacionVertical:
        vistas.elevacionVertical === undefined ? undefined : vistas.elevacionVertical * GRADOS,
      margen: vistas.margenGeneral,
    },
    ancho,
    alto,
    nivelY,
  );
}

/** Elevación (rad) de la vista general según la pantalla: la vertical si es más alta que ancha en proporción. */
export function elevacionGeneralPara(vistas: Vistas, ancho: number, alto: number): number {
  const grados =
    alto > ancho * ASPECTO_VERTICAL
      ? (vistas.elevacionVertical ?? vistas.elevacionGeneral)
      : vistas.elevacionGeneral;
  return grados * GRADOS;
}

/** El escenario entero de frente, también en vertical (el alejamiento máximo de la órbita). */
export function encuadreEntero(vistas: Vistas, ancho: number, alto: number): Encuadre {
  return encuadrarCaja(
    vistas.general,
    ancho,
    alto,
    MARGEN_CASA,
    elevacionGeneralPara(vistas, ancho, alto),
  );
}

/** Una zona del escenario vista de frente desde fuera del corte, llenando la pantalla. */
export function encuadreZona(caja: Caja3, ancho: number, alto: number, vistas: Vistas): Encuadre {
  return encuadrarCaja(
    caja,
    ancho,
    alto,
    MARGEN_AMBIENTE,
    elevacionGeneralPara(vistas, ancho, alto),
  );
}

/** Ambiente visto de frente desde fuera del corte, llenando la pantalla. */
export function encuadreAmbiente(
  a: Pick<Ambiente, 'x0' | 'x1' | 'z0' | 'z1' | 'y' | 'alto'>,
  ancho: number,
  alto: number,
): Encuadre {
  return encuadrarCaja(
    {
      x0: a.x0,
      x1: a.x1,
      y0: a.y - ESPESOR_LOSA,
      y1: a.y + (a.alto > 0 ? a.alto : ALTO_SIN_TECHO),
      z0: a.z0,
      z1: a.z1,
    },
    ancho,
    alto,
    MARGEN_AMBIENTE,
  );
}

/** Distancia de seguimiento (m): en vertical el ancho visible es poco, así que se aleja (con tope). */
export function distanciaSeguirPara(
  aspecto: number,
  base = PARAMETROS_SEGUIMIENTO.distanciaSeguir,
): number {
  if (!(aspecto > 0) || aspecto >= 1) return base;
  return base * Math.min(2.2, 0.9 / aspecto);
}

/** Cámara en reposo: `avanzarCamara` muta este estado; no crea objetos. */
export interface EstadoCamara extends Punto3 {
  /** Hay una transición en curso (o una persona enfocada que seguir). */
  activo: boolean;
  /** Metros entre la cámara y su punto de mira. */
  distancia: number;
  /** Dirección de la cámara vista desde su punto de mira: 0 mira desde el frente (z+), π/2 desde el este. */
  azimut: number;
  /** Elevación de la cámara sobre el horizonte. */
  elevacion: number;
  /** Último destino atendido (persona, punto, ambiente o casa); si cambia, arranca otra transición. */
  clave: object | null;
  /** Pide volver también a la dirección inicial (vista general), no solo al encuadre. */
  reorientar: boolean;
}

export interface EntradaCamara {
  dt: number;
  casa: Encuadre;
  /** Ambiente activo, o `null` para la casa completa. */
  ambiente: Encuadre | null;
  /** Punto elegido con doble toque (la misma referencia mientras valga), o `null`. */
  foco: Punto3 | null;
  /** Posición de la persona enfocada (la misma referencia cada cuadro), o `null`. */
  enfocado: Punto3 | null;
  /** Movimiento reducido: llega al destino en un solo paso. */
  instantaneo?: boolean;
  /** Vista elegida para la persona enfocada (ángulo y distancia que dejan su cara a la vista). */
  vista?: { azimut: number; elevacion: number; distancia: number } | null;
  /** Elevación (rad) de la vista general del escenario; por defecto la de la mansión. */
  elevacionGeneral?: number;
}

/** Distancia (m) a la que la cámara mira a una persona enfocada. */
export const DISTANCIA_PERSONA = 5;
/** Distancia (m) a la que se acerca la cámara a un punto enfocado con doble toque. */
export const DISTANCIA_FOCO = 12;
/** Altura sobre los pies a la que apunta la cámara (la cabeza). */
const ALTURA_CABEZA = 1.1;
/** Rapidez de la transición (1/s). */
const VELOCIDAD = 2.5;
/** Metros de diferencia bajo los cuales la transición se da por terminada. */
const TOLERANCIA = 0.02;
const TOLERANCIA_ANGULO = 0.005;

const VUELTA = 2 * Math.PI;
/** El ángulo equivalente en (-π, π]: así el giro elige siempre el camino corto. */
export function normalizarAngulo(a: number): number {
  const r = a % VUELTA;
  return r > Math.PI ? r - VUELTA : r <= -Math.PI ? r + VUELTA : r;
}
const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Lee la órbita actual de la cámara (su posición respecto del punto de mira) al estado. */
export function leerOrbita(e: EstadoCamara, dx: number, dy: number, dz: number): void {
  const d = Math.hypot(dx, dy, dz) || 1;
  e.distancia = d;
  e.elevacion = Math.asin(dy / d);
  if (Math.hypot(dx, dz) > 1e-6) e.azimut = Math.atan2(dx, dz);
}

/** Posición de la cámara (relativa al punto de mira) que describe el estado. */
export function desplazamientoDe(e: EstadoCamara, salida: Punto3): Punto3 {
  const horizontal = e.distancia * Math.cos(e.elevacion);
  salida.x = horizontal * Math.sin(e.azimut);
  salida.y = e.distancia * Math.sin(e.elevacion);
  salida.z = horizontal * Math.cos(e.azimut);
  return salida;
}

/**
 * Un paso de la cámara hacia su destino con un lerp suave: persona enfocada > punto enfocado >
 * ambiente activo > casa completa. Mueve el punto de mira, la distancia y la dirección. La
 * dirección solo cambia para entrar en los límites del modo (dentro de un ambiente la órbita es
 * corta, así que quien miraba desde atrás da la vuelta) o al pedir `reorientar`; fuera de eso
 * la órbita sigue siendo del usuario. Al llegar se desactiva; con una persona enfocada sigue
 * activa para seguirla. Devuelve si movió el estado en este paso (también en el último), para
 * que quien llama aplique la posición.
 */
export function avanzarCamara(e: EstadoCamara, entrada: EntradaCamara): boolean {
  const { enfocado, foco, ambiente, casa } = entrada;
  const clave = enfocado ?? foco ?? ambiente ?? casa;
  if (clave !== e.clave || e.reorientar) {
    e.clave = clave;
    e.activo = true;
  }
  if (!e.activo) return false;
  const destino = ambiente ?? casa;
  const objetivo = enfocado ?? foco;
  const tx = objetivo ? objetivo.x : destino.objetivo.x;
  const ty = enfocado ? enfocado.y + ALTURA_CABEZA : objetivo ? objetivo.y : destino.objetivo.y;
  const tz = objetivo ? objetivo.z : destino.objetivo.z;
  const vista = enfocado ? entrada.vista : null;
  const td = vista
    ? vista.distancia
    : enfocado
      ? DISTANCIA_PERSONA
      : foco
        ? Math.min(e.distancia, DISTANCIA_FOCO)
        : destino.distancia;
  const enAmbiente = ambiente !== null && enfocado === null;
  const limiteAzimut = enAmbiente ? AZIMUT_AMBIENTE : Infinity;
  const ta = vista
    ? vista.azimut
    : e.reorientar
      ? 0
      : acotar(normalizarAngulo(e.azimut), -limiteAzimut, limiteAzimut);
  const te = vista
    ? vista.elevacion
    : e.reorientar
      ? (entrada.elevacionGeneral ?? ELEVACION_INICIAL)
      : acotar(
          e.elevacion,
          enAmbiente ? ELEVACION_AMBIENTE_MIN : ELEVACION_GENERAL_MIN,
          enAmbiente ? ELEVACION_AMBIENTE_MAX : ELEVACION_GENERAL_MAX,
        );
  const k = entrada.instantaneo ? 1 : Math.min(1, entrada.dt * VELOCIDAD);
  e.x += (tx - e.x) * k;
  e.y += (ty - e.y) * k;
  e.z += (tz - e.z) * k;
  e.distancia += (td - e.distancia) * k;
  e.azimut += normalizarAngulo(ta - e.azimut) * k;
  e.elevacion += (te - e.elevacion) * k;
  if (enfocado) return true;
  e.activo =
    Math.hypot(tx - e.x, ty - e.y, tz - e.z) >= TOLERANCIA ||
    Math.abs(td - e.distancia) >= TOLERANCIA ||
    Math.abs(normalizarAngulo(ta - e.azimut)) >= TOLERANCIA_ANGULO ||
    Math.abs(te - e.elevacion) >= TOLERANCIA_ANGULO;
  if (!e.activo) e.reorientar = false;
  return true;
}

/** Frecuencia (rad/s) con que la deriva invierte su sentido: con velocidad v, barre ±v/0,5 rad. */
export const FRECUENCIA_DERIVA = 0.5;

/**
 * Azimut tras `dt` segundos de deriva lenta y senoidal (`velocidad` en rad/s de pico): la
 * cámara se mece alrededor de su dirección sin pararse. Con `velocidad` 0 no cambia nada, y si
 * el modo limita el azimut (`limite` finito, p. ej. `AZIMUT_AMBIENTE`) nunca lo sobrepasa.
 */
export function derivarAzimut(
  azimut: number,
  t: number,
  dt: number,
  velocidad: number,
  limite: number,
): number {
  if (!(velocidad > 0)) return azimut;
  const siguiente = azimut + velocidad * Math.cos(FRECUENCIA_DERIVA * t) * dt;
  return Number.isFinite(limite) ? acotar(siguiente, -limite, limite) : siguiente;
}

/** Posición del orbe en pantalla (-1..1 a cada lado del centro): tercio derecho, arriba. */
const ORBE_NDC_X = 0.62;
const ORBE_NDC_Y = 0.4;
/** A qué profundidad del sujeto queda el orbe: más lejos lo metería detrás de paredes y pantallas. */
const ORBE_PROFUNDIDAD = 1;

/**
 * Dónde flota Asistente mientras la cámara mira `objetivo` (una persona enfocada o el punto de mira
 * dentro de un ambiente): en el tercio derecho y alto del encuadre, a la profundidad del
 * objetivo, nunca sobre la línea cámara→objetivo ni en el centro del plano. Se calcula con
 * el campo de visión real (`fovVertical` en grados y `aspecto` ancho/alto), así que vale desde
 * cualquier ángulo de órbita y de zoom.
 */
export function puntoOrbeEncuadre(
  objetivo: Punto3,
  camara: Punto3,
  fovVertical: number,
  aspecto: number,
): Punto3 {
  const dx = objetivo.x - camara.x;
  const dy = objetivo.y - camara.y;
  const dz = objetivo.z - camara.z;
  const distancia = Math.hypot(dx, dy, dz) || 1;
  const fx = dx / distancia;
  const fy = dy / distancia;
  const fz = dz / distancia;
  // derecha = adelante × arriba(0,1,0), normalizada; arriba de pantalla = derecha × adelante.
  const horizontal = Math.hypot(fx, fz) || 1;
  const rx = -fz / horizontal;
  const rz = fx / horizontal;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  const profundo = distancia * ORBE_PROFUNDIDAD;
  const medioAlto = profundo * Math.tan((fovVertical * Math.PI) / 360);
  const lateral = ORBE_NDC_X * medioAlto * aspecto;
  const vertical = ORBE_NDC_Y * medioAlto;
  return {
    x: camara.x + fx * profundo + rx * lateral + ux * vertical,
    y: camara.y + fy * profundo + uy * vertical,
    z: camara.z + fz * profundo + rz * lateral + uz * vertical,
  };
}

/** Valores iniciales parametrizables de la cámara que sigue al avatar. */
export interface ParametrosSeguimiento {
  /** Radio (m) de la ventana en que el avatar puede moverse sin que el punto de mira lo haga. */
  zonaMuerta: number;
  /** Segundos de velocidad que se anticipan (look-ahead por lo que ya se mueve). */
  anticipacionVelocidad: number;
  /** Metros que se anticipan en la dirección que pide el mando. */
  anticipacionEntrada: number;
  /** Tope (m) de la anticipación total: a 0,7 s de velocidad llega a pleno corriendo (4,8 m/s). */
  anticipacionMax: number;
  /** Bajo esta rapidez (m/s) no hay anticipación; sube a pleno en `+ rampaAnticipacion`. */
  rapidezMinAnticipacion: number;
  rampaAnticipacion: number;
  /** Media vida (s) del resorte crítico del punto de mira. */
  mediaVida: number;
  /** Media vida (s) del resorte crítico de su altura (más lenta: absorbe los peldaños). */
  mediaVidaAltura: number;
  /** Segundos quieto antes de empezar a realinear la ventana con el avatar, y su media vida (s). */
  esperaRealineacion: number;
  mediaVidaRealineacion: number;
  /** Rapidez máxima (m/s) del punto de mira: ninguna sacudida lo lanza (holgada sobre la carrera). */
  velocidadMaxMira: number;
  /** Rapidez (m/s) a la que empieza a alejarse la cámara (la marcha) y a la que llega a pleno (la carrera). */
  rapidezCaminar: number;
  rapidezCorrer: number;
  /** Metros extra de distancia a pleno correr y media vida (s) con que entran y salen. */
  distanciaCorrer: number;
  vidaCorrer: number;
  /** Salto (m) del avatar en un cuadro desde el que se asume teletransporte y el mira salta. */
  saltoMax: number;
  /** Distancia (m) de la cámara al avatar al entrar en el modo. */
  distanciaSeguir: number;
  /** Altura (m) sobre los pies a la que mira la cámara. */
  alturaMira: number;
  /** Distancia mínima cómoda (m): por debajo se prioriza buscar un rodeo. */
  distanciaMinBrazo: number;
  /** Medias vidas (s) del brazo al acortar (rápido: nunca atravesar) y al alargar (lento). */
  vidaBrazoCorto: number;
  vidaBrazoLargo: number;
  /** Holgura (m) con que el brazo libre supera la distancia pedida, para que mande la pedida. */
  holguraBrazo: number;
  /** Búsqueda y margen de visibilidad (radianes), incluyendo el ancho del personaje. */
  pasoAzimutBrazo: number;
  giroMaxBrazo: number;
  margenAngularBrazo: number;
  margenSalidaBrazo: number;
  radioVistaBrazo: number;
  alturasVistaBrazo: readonly number[];
  /** Histéresis temporal (s) y rapidez máxima de giro y distancia (rad/s, m/s). */
  esperaEntradaBrazo: number;
  esperaSalidaBrazo: number;
  velocidadAzimutBrazo: number;
  vidaAzimutBrazo: number;
  velocidadDistanciaBrazo: number;
  /** Volumen de seguridad (m), margen numérico y horizonte predictivo (s). */
  toleranciaZoomUsuario: number;
  vidaZoom: number;
  velocidadZoom: number;
  /** Multiplicador de la rueda y del gesto de pellizco del trackpad sobre el zoom de OrbitControls. */
  rapidezRueda: number;
  pausaManual: number;
  inerciaManual: number;
  umbralFrenadoCamara: number;
  distanciaOcultarAvatar: number;
  radioCamara: number;
  margenColision: number;
  anticipacionColision: number;
  velocidadOrbitaPrediccion: number;
  /** Retención del radio corto tras liberar un canto (s). */
  retencionBrazo: number;
  /** Media vida (s) con que la distancia llega a `distanciaSeguir` al entrar. */
  vidaAcercamiento: number;
  /** Ancho máximo (m) de la huella de un obstáculo angosto (columna, mueble alto): se desvanece en vez de acercar la cámara. */
  anchoAngosto: number;
  /** Holgura (m) con que el rayo cámara→avatar «toca» un obstáculo angosto para desvanecerlo. */
  margenDesvanecer: number;
  /** Medias vidas (s) del desvanecimiento (rápida: no tapa) y de la reaparición (lenta). */
  vidaDesvanecer: number;
  vidaReaparecer: number;
  /** Segundos que el obstáculo deja de tapar antes de empezar a reaparecer (histéresis temporal). */
  esperaReaparecer: number;
  /** Cuerpo del asistente (m): radio que tapa al avatar, radio de su anillo (lo que se desvanece) y alto desde los pies. */
  radioAsistente: number;
  radioAnilloAsistente: number;
  altoAsistente: number;
  /**
   * Si la cámara no sube más allá del cielo del piso del avatar (mansión). Apagado: con la cámara baja la
   * vista de seguir se llena de terreno y de muros al orbitar hacia afuera (ADR-0016, encargo U3).
   */
  limitarAlTecho: boolean;
  /** Holgura (m) bajo el cielo del piso del avatar a la que se detiene la cámara al subir. */
  margenTecho: number;
  /** Rapidez máxima (rad/s) con que baja el tope de elevación al pasar a un piso más bajo o alejar el zoom. */
  velocidadTecho: number;
  /** Alto (m) de los muros de la envolvente exterior que solo se desvanecen y espesor de su caja. */
  altoEnvolvente: number;
  espesorEnvolvente: number;
  /** Barrido de la órbita manual: paso angular máximo (rad) con que se busca un muro por delante. */
  pasoBarrido: number;
  /** Bajo esta rapidez angular (rad/s) no hay barrido: el rayo actual basta. */
  velocidadMinBarrido: number;
}

export const PARAMETROS_SEGUIMIENTO: ParametrosSeguimiento = {
  zonaMuerta: 0.3,
  anticipacionVelocidad: 0.28,
  anticipacionEntrada: 0.2,
  anticipacionMax: 1.4,
  rapidezMinAnticipacion: 0.15,
  rampaAnticipacion: 0.35,
  mediaVida: 0.16,
  mediaVidaAltura: 0.3,
  esperaRealineacion: 0.6,
  mediaVidaRealineacion: 1.2,
  velocidadMaxMira: 9,
  rapidezCaminar: 2.3,
  rapidezCorrer: 4.8,
  distanciaCorrer: 2.5,
  vidaCorrer: 0.4,
  saltoMax: 4,
  distanciaSeguir: 8,
  alturaMira: 1.5,
  distanciaMinBrazo: 2.2,
  vidaBrazoCorto: 0.06,
  vidaBrazoLargo: 0.5,
  holguraBrazo: 6,
  pasoAzimutBrazo: Math.PI / 90,
  giroMaxBrazo: Math.PI,
  margenAngularBrazo: Math.PI / 30,
  margenSalidaBrazo: Math.PI / 18,
  radioVistaBrazo: 0.22,
  alturasVistaBrazo: [0.2, 0.85, 1.5],
  esperaEntradaBrazo: 0.1,
  esperaSalidaBrazo: 1,
  velocidadAzimutBrazo: 1.8,
  vidaAzimutBrazo: 0.12,
  velocidadDistanciaBrazo: 6,
  toleranciaZoomUsuario: 0.001,
  vidaZoom: 0.04,
  velocidadZoom: 10,
  rapidezRueda: 3,
  pausaManual: 1.5,
  inerciaManual: 0.15,
  umbralFrenadoCamara: 0.2,
  distanciaOcultarAvatar: 1.6,
  radioCamara: 0.18,
  margenColision: 0.01,
  anticipacionColision: 0.35,
  velocidadOrbitaPrediccion: 3,
  retencionBrazo: 0.25,
  vidaAcercamiento: 0.5,
  anchoAngosto: 1.2,
  margenDesvanecer: 0.2,
  vidaDesvanecer: 0.03,
  vidaReaparecer: 0.2,
  esperaReaparecer: 0.4,
  radioAsistente: 0.4,
  radioAnilloAsistente: 0.85,
  altoAsistente: 2.1,
  limitarAlTecho: false,
  margenTecho: 0.15,
  velocidadTecho: 0.5,
  altoEnvolvente: 8,
  espesorEnvolvente: 0.5,
  pasoBarrido: 0.04,
  velocidadMinBarrido: 0.05,
};

/**
 * Estado de la cámara que sigue al avatar (A5 de `investigacion-videojuegos.md`, Keren: zona
 * muerta y look-ahead). Conserva el azimut del usuario y un destino de rodeo independiente:
 * despejar el rayo actual no cancela el compromiso con el lado elegido.
 */
export interface EstadoSeguimiento {
  iniciado: boolean;
  /** Punto de mira vigente (lo que debe apuntar la cámara). */
  mira: Punto3;
  /** Distancia (m) que debe tener la cámara al punto de mira (ya con el brazo aplicado). */
  distancia: number;
  /** Resortes del punto de mira en x y z. */
  rx: Resorte;
  rz: Resorte;
  /** Resorte crítico de la altura del punto de mira: sube con el piso sin seguir cada peldaño. */
  ry: Resorte;
  /** Centro de la ventana de zona muerta. */
  cx: number;
  cz: number;
  /** Última posición del avatar (para su velocidad) y segundos que lleva quieto. */
  px: number;
  pz: number;
  quieto: number;
  /** Distancia pedida (por el usuario o por la entrada al modo) y si aún se está acercando. */
  deseada: number;
  zoomElegido: number;
  /** Metros que se suman a `deseada` por correr (suavizados) y su factor 0..1. */
  extra: number;
  correr: number;
  rcorrer: Resorte;
  acercando: boolean;
  /** Distancia hasta donde llega libre la cámara (suavizada). */
  brazo: number;
  /** Último brazo libre calculado (sin suavizar). */
  brazoObjetivo: number;
  /** Puntos de trabajo del brazo (no asignan). */
  camara: Punto3;
  puntoMira: Punto3;
  azimut: number;
  azimutBase: number;
  azimutObjetivo: number;
  ladoBrazo: number;
  tapadoBrazo: number;
  libreBrazo: number;
  rodeando: boolean;
  recuperandoBrazo: boolean;
  retencionBrazo: number;
  azimutAnterior: number;
  /**
   * Cajas de la casa y su opacidad (1 = a la vista, 0 = invisible), alineadas por índice. Bajan solo
   * con el usuario orbitando: un obstáculo angosto que queda entre la cámara y el avatar, o uno ancho
   * que la cámara aún no logró dejar atrás porque su distancia cambia a lo más al ritmo del tope.
   */
  obstaculos: readonly Caja3[];
  opacidadObstaculos: number[];
  esperaObstaculos: number[];
  /** Elevación (rad) con que queda la cámara: la pedida, acotada por el techo del piso del avatar. */
  elevacion: number;
  /** Tope de elevación vigente (baja a ritmo acotado, sube de inmediato); Infinity sin techo. */
  elevacionMax: number;
  /**
   * El asistente (Jules) se desvanece cuando tapa al avatar, sin mover la cámara: `cajaAsistente` es lo que
   * se dibuja desvanecido (cuerpo y anillo) y `cuerpoAsistente` lo que tapa. Inactivo si la entrada no lo trae.
   */
  asistenteActivo: boolean;
  cajaAsistente: Caja3;
  cuerpoAsistente: Caja3;
  opacidadAsistente: number;
  esperaAsistente: number;
  /** Lista de `cajas` y `fantasmas` de la que salen `obstaculos` (para rearmarla solo si cambian). */
  fuenteCajas: readonly Caja3[];
  fuenteFantasmas: readonly Caja3[];
}

/** Misma lista vacía siempre: la identidad decide si hay que rearmar las cajas que se desvanecen. */
const SIN_FANTASMAS: readonly Caja3[] = [];

/** Tope numérico (m) del brazo libre. */
const TOPE_DISTANCIA = 1e4;

export const crearSeguimiento = (): EstadoSeguimiento => ({
  iniciado: false,
  mira: { x: 0, y: 0, z: 0 },
  distancia: DISTANCIA_PERSONA,
  rx: crearResorte(),
  rz: crearResorte(),
  ry: crearResorte(),
  cx: 0,
  cz: 0,
  px: 0,
  pz: 0,
  quieto: 0,
  deseada: DISTANCIA_PERSONA,
  zoomElegido: DISTANCIA_PERSONA,
  extra: 0,
  correr: 0,
  rcorrer: crearResorte(),
  acercando: false,
  brazo: Infinity,
  brazoObjetivo: TOPE_DISTANCIA,
  camara: { x: 0, y: 0, z: 0 },
  puntoMira: { x: 0, y: 0, z: 0 },
  azimut: 0,
  azimutBase: 0,
  azimutObjetivo: 0,
  ladoBrazo: 0,
  tapadoBrazo: 0,
  libreBrazo: 0,
  rodeando: false,
  recuperandoBrazo: false,
  retencionBrazo: 0,
  azimutAnterior: 0,
  obstaculos: [],
  opacidadObstaculos: [],
  esperaObstaculos: [],
  elevacion: 0,
  elevacionMax: Infinity,
  asistenteActivo: false,
  cajaAsistente: { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 },
  cuerpoAsistente: { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 },
  opacidadAsistente: 1,
  esperaAsistente: 0,
  fuenteCajas: [],
  fuenteFantasmas: SIN_FANTASMAS,
});

export interface EntradaSeguimiento {
  dt: number;
  /**
   * Pies del avatar sobre el PISO (el salto no entra: el cuerpo sube dentro del rig, así que el punto
   * de mira no se sacude y el encuadre deja margen arriba con `alturaMira`).
   */
  x: number;
  y: number;
  z: number;
  /** Mando del avatar (teclas relativas a la cámara) para anticipar hacia donde quiere ir. */
  adelante: number;
  lateral: number;
  azimut: number;
  elevacion: number;
  /** Distancia a la que está ahora la cámara (la lee de OrbitControls tras el usuario). */
  distanciaActual: number;
  /** Máximo real del control orbital; evita que su recorte se confunda con un zoom del usuario. */
  distanciaMax?: number;
  /** Muros y muebles altos que no debe atravesar la cámara. */
  cajas: Caja3[];
  /** z del borde abierto del piso por el frente (más allá hay vacío): el encuadre no lo muestra. Por defecto, ninguno. */
  frente?: number;
  /** Incluye la pausa tras soltar la órbita manual. Ausente: consumidor radial, sin aplicar azimut. */
  orbitando?: boolean;
  /** Preferencia del sistema: sin anticipación ni apertura automática por carrera. */
  reducirMovimiento?: boolean;
  /** Pies del asistente: si se interpone entre la cámara y el avatar se desvanece (la cámara no se mueve). */
  asistente?: Punto3 | null;
  /**
   * Altura (m) del cielo del piso del avatar (donde empieza la losa de arriba), o ausente si no hay losa
   * encima: la cámara no sube de ahí (`margenTecho` más abajo) y baja su elevación en vez de acortar la distancia.
   */
  techo?: number;
  /** Muros que nunca acortan la cámara (la envolvente exterior): solo se desvanecen si quedan entre ella y el avatar. */
  fantasmas?: readonly Caja3[];
}

/**
 * Metros que el borde inferior del cuadro llega más allá del punto de mira, hacia la cámara (en el
 * suelo, a `alturaMira` bajo el punto de mira): con el punto de mira a `frente - esto`, el borde del
 * piso queda justo en el borde inferior y no se ve el vacío de abajo.
 */
export function alcanceInferior(distancia: number, elevacion: number, alturaMira: number): number {
  const rayo = elevacion + (FOV_VERTICAL * Math.PI) / 360;
  const alturaCamara = alturaMira + distancia * Math.sin(elevacion);
  return distancia * Math.cos(elevacion) - alturaCamara / Math.tan(rayo);
}

const TOLERANCIA_ZOOM = 0.05;

/** Abanico angular y hombros: un rayo central libre no garantiza ver al personaje entero. */
function vistaBrazoLibre(
  s: EstadoSeguimiento,
  e: EntradaSeguimiento,
  azimut: number,
  distancia: number,
  margen: number,
  p: ParametrosSeguimiento,
): boolean {
  for (const delta of [-margen, 0, margen]) {
    const a = azimut + delta;
    const horizontal = distancia * Math.cos(s.elevacion);
    const camara = {
      x: s.mira.x + horizontal * Math.sin(a),
      y: s.mira.y + distancia * Math.sin(s.elevacion),
      z: s.mira.z + horizontal * Math.cos(a),
    };
    for (const altura of p.alturasVistaBrazo) {
      for (const lado of [-p.radioVistaBrazo, 0, p.radioVistaBrazo]) {
        const objetivo = {
          x: e.x + lado * Math.cos(a),
          y: e.y + altura,
          z: e.z - lado * Math.sin(a),
        };
        if (!lineaLibre(camara, objetivo, e.cajas)) return false;
      }
    }
    if (!lineaLibre(camara, s.mira, e.cajas)) return false;
  }
  return true;
}

/** El primer rodeo busca el lado más corto; los siguientes solo amplían el lado comprometido. */
function destinoBrazo(
  s: EstadoSeguimiento,
  e: EntradaSeguimiento,
  distancia: number,
  p: ParametrosSeguimiento,
): number | null {
  for (let giro = p.pasoAzimutBrazo; giro <= p.giroMaxBrazo; giro += p.pasoAzimutBrazo) {
    for (const lado of s.ladoBrazo ? [s.ladoBrazo] : [1, -1]) {
      const candidato = s.azimutBase + lado * giro;
      // No se vuelve hacia el canto mientras el obstáculo sigue tapando el azimut del usuario.
      if (s.rodeando && lado * normalizarAngulo(candidato - s.azimutObjetivo) < 0) continue;
      if (vistaBrazoLibre(s, e, candidato, distancia, p.margenAngularBrazo, p)) return candidato;
    }
  }
  return null;
}

/**
 * Un paso de la cámara de seguimiento. Con `OPCIONES.camaraSeguimiento` apagada el punto de mira
 * va rígido en la cabeza del avatar y no hay brazo. Encendida: ventana de zona muerta, anticipación
 * por velocidad y por mando (acotada), resorte crítico con velocidad máxima y brazo que acorta la
 * cámara si un muro o mueble alto queda entre ella y el avatar. Deja el resultado en `s.mira` y
 * `s.distancia`.
 */
export function avanzarSeguimiento(
  s: EstadoSeguimiento,
  e: EntradaSeguimiento,
  p: ParametrosSeguimiento = PARAMETROS_SEGUIMIENTO,
): void {
  const dt = e.dt > 0 ? e.dt : 0;
  s.elevacion = e.elevacion;
  const maxima = e.distanciaMax ?? Infinity;
  const distanciaSeguir = Math.min(p.distanciaSeguir, maxima);
  const mx = e.x;
  const mz = e.z;
  const my = e.y + p.alturaMira;
  const salto = s.iniciado && Math.hypot(mx - s.px, mz - s.pz) > p.saltoMax;
  if (!s.iniciado || salto) {
    s.iniciado = true;
    s.mira.x = s.cx = s.px = mx;
    s.mira.y = my;
    s.mira.z = s.cz = s.pz = mz;
    s.rx.x = mx;
    s.rx.v = 0;
    s.rz.x = mz;
    s.rz.v = 0;
    s.ry.x = my;
    s.ry.v = 0;
    s.quieto = 0;
    s.azimut = s.azimutBase = s.azimutObjetivo = e.azimut;
    s.ladoBrazo = s.tapadoBrazo = s.libreBrazo = 0;
    s.rodeando = false;
    s.azimutAnterior = e.azimut;
    s.retencionBrazo = 0;
    s.recuperandoBrazo = false;
    if (!salto) {
      s.deseada = s.zoomElegido = Math.min(e.distanciaActual, maxima);
      s.distancia = e.distanciaActual;
      s.extra = 0;
      s.correr = 0;
      s.rcorrer.x = s.rcorrer.v = 0;
      s.acercando = true;
      s.brazo = Infinity;
    }
  }

  // Distancia pedida: si el usuario hizo zoom, manda; si no, se acerca a `distanciaSeguir`.
  const toleranciaZoom = e.orbitando ? p.toleranciaZoomUsuario : TOLERANCIA_ZOOM;
  if (Math.abs(e.distanciaActual - s.distancia) > toleranciaZoom) {
    s.zoomElegido = Math.min(maxima, Math.max(p.distanciaMinBrazo, e.distanciaActual - s.extra));
    s.acercando = false;
  } else if (s.acercando) {
    s.zoomElegido = distanciaSeguir;
    s.deseada = suavizarExp(s.deseada, distanciaSeguir, p.vidaAcercamiento, dt);
    if (Math.abs(s.deseada - distanciaSeguir) < TOLERANCIA_ZOOM) s.acercando = false;
  }

  s.deseada = Math.min(s.deseada, maxima);
  if (!s.acercando) {
    const zoom = suavizarExp(s.deseada, s.zoomElegido, p.vidaZoom, dt);
    s.deseada += acotar(zoom - s.deseada, -p.velocidadZoom * dt, p.velocidadZoom * dt);
  }

  if (!OPCIONES.camaraSeguimiento) {
    s.mira.x = s.cx = mx;
    s.mira.y = my;
    s.mira.z = s.cz = mz;
    s.rx.x = mx;
    s.rx.v = 0;
    s.rz.x = mz;
    s.rz.v = 0;
    s.ry.x = my;
    s.ry.v = 0;
    s.px = mx;
    s.pz = mz;
    s.distancia = s.deseada;
    s.extra = s.correr = s.rcorrer.x = s.rcorrer.v = 0;
    s.azimut = s.azimutBase = s.azimutObjetivo = e.azimut;
    s.rodeando = false;
    s.recuperandoBrazo = false;
    s.ladoBrazo = s.tapadoBrazo = s.libreBrazo = 0;
    return;
  }
  if (dt <= 0) return;

  // Velocidad real del avatar (la cámara no depende de que el motor la publique).
  const vx = (mx - s.px) / dt;
  const vz = (mz - s.pz) / dt;
  s.px = mx;
  s.pz = mz;
  const rapidez = Math.hypot(vx, vz);
  // Correr aleja la cámara un poco, con transición suave al empezar y al dejar de correr.
  resorteCritico(
    s.rcorrer,
    Math.min(1, Math.max(0, (rapidez - p.rapidezCaminar) / (p.rapidezCorrer - p.rapidezCaminar))),
    0,
    p.vidaCorrer,
    dt,
  );
  s.correr = acotar(s.rcorrer.x, 0, 1);
  s.extra = e.reducirMovimiento ? 0 : p.distanciaCorrer * s.correr;
  const pedida = Math.min(maxima, s.deseada + s.extra);

  // Ventana de zona muerta: el centro solo se mueve si el avatar se sale de ella.
  const dx = mx - s.cx;
  const dz = mz - s.cz;
  const fuera = Math.hypot(dx, dz);
  if (fuera > p.zonaMuerta) {
    const k = (fuera - p.zonaMuerta) / fuera;
    s.cx += dx * k;
    s.cz += dz * k;
  }
  // Realineación lenta con el avatar cuando lleva un rato quieto.
  s.quieto = rapidez < p.rapidezMinAnticipacion ? s.quieto + dt : 0;
  if (s.quieto > p.esperaRealineacion) {
    s.cx = suavizarExp(s.cx, mx, p.mediaVidaRealineacion, dt);
    s.cz = suavizarExp(s.cz, mz, p.mediaVidaRealineacion, dt);
  }

  // Anticipación hacia donde va (velocidad) y hacia donde pide ir (mando), acotada. Nace con la
  // rapidez real: moverse un poco dentro de la ventana no mueve el punto de mira.
  const rampa = e.reducirMovimiento
    ? 0
    : Math.min(1, Math.max(0, (rapidez - p.rapidezMinAnticipacion) / p.rampaAnticipacion));
  const seno = Math.sin(e.azimut);
  const coseno = Math.cos(e.azimut);
  const ex = -seno * e.adelante + coseno * e.lateral;
  const ez = -coseno * e.adelante - seno * e.lateral;
  const norma = Math.hypot(ex, ez);
  const escalaEntrada = norma > 1 ? p.anticipacionEntrada / norma : p.anticipacionEntrada;
  let ax = (vx * p.anticipacionVelocidad + ex * escalaEntrada) * rampa;
  let az = (vz * p.anticipacionVelocidad + ez * escalaEntrada) * rampa;
  const largo = Math.hypot(ax, az);
  if (largo > p.anticipacionMax) {
    ax *= p.anticipacionMax / largo;
    az *= p.anticipacionMax / largo;
  }

  // Al frenar la mira termina sobre los pies, sin volver desde un adelanto lejano.
  const frenado = rapidez < p.rapidezMinAnticipacion;
  if (frenado && s.correr > p.umbralFrenadoCamara) {
    s.cx = mx;
    s.cz = mz;
  }
  // Resorte crítico hacia (centro + anticipación), con rapidez máxima del punto de mira.
  const antesX = s.rx.x;
  const antesZ = s.rz.x;
  resorteCritico(s.rx, s.cx + ax, 0, p.mediaVida, dt);
  resorteCritico(s.rz, s.cz + az, 0, p.mediaVida, dt);
  if (frenado) {
    s.rx.x = acotar(s.rx.x, Math.min(antesX, mx), Math.max(antesX, mx));
    s.rz.x = acotar(s.rz.x, Math.min(antesZ, mz), Math.max(antesZ, mz));
    if (s.rx.x === mx) s.rx.v = 0;
    if (s.rz.x === mz) s.rz.v = 0;
  }
  const paso = Math.hypot(s.rx.x - antesX, s.rz.x - antesZ);
  const maxPaso = p.velocidadMaxMira * dt;
  if (paso > maxPaso) {
    const f = maxPaso / paso;
    s.rx.x = antesX + (s.rx.x - antesX) * f;
    s.rz.x = antesZ + (s.rz.x - antesZ) * f;
    s.rx.v *= f;
    s.rz.v *= f;
  }
  // El vacío bajo el borde abierto del piso no entra en el cuadro; si no cabe y el avatar con él
  // (corriendo hacia el borde), manda el avatar: sus pies quedan a la vista, con margen, y solo
  // asoma una franja del vacío.
  if (e.frente !== undefined && Math.cos(e.azimut) > 0.2) {
    const alcance = alcanceInferior(s.distancia, e.elevacion, p.alturaMira) * Math.cos(e.azimut);
    const tope = Math.max(e.frente - alcance, mz - 0.65 * alcance);
    if (s.rz.x > tope) {
      s.rz.x = tope;
      if (s.rz.v > 0) s.rz.v = 0;
    }
  }
  s.mira.x = s.rx.x;
  s.mira.z = s.rz.x;
  // La altura sigue al piso (el apoyo suavizado del avatar, no la pelvis) con un resorte crítico: en una
  // escalera, que sube de a un peldaño, la mira sube pareja y sin trepidar; al saltar o caer no la sigue.
  resorteCritico(s.ry, my, 0, p.mediaVidaAltura, dt);
  s.mira.y = s.ry.x;
  limitarElevacionBajoTecho(s, e, pedida, dt, p);

  const distanciaAnterior = s.distancia;
  // La anticipación no puede poner el punto de mira dentro de una columna al caminar junto a ella.
  if (
    e.cajas.some(
      (c) =>
        s.mira.x >= c.x0 &&
        s.mira.x <= c.x1 &&
        s.mira.z >= c.z0 &&
        s.mira.z <= c.z1 &&
        s.mira.y >= c.y0 &&
        s.mira.y <= c.y1,
    )
  ) {
    s.mira.x = s.rx.x = s.cx = mx;
    s.mira.z = s.rz.x = s.cz = mz;
    s.rx.v = s.rz.v = 0;
  }
  if (e.orbitando !== false) {
    s.azimut = s.azimutBase = s.azimutObjetivo = e.azimut;
    s.ladoBrazo = s.tapadoBrazo = s.libreBrazo = 0;
    s.rodeando = false;
  } else {
    const baseLibre = vistaBrazoLibre(
      s,
      e,
      s.azimutBase,
      pedida,
      s.rodeando ? p.margenSalidaBrazo : p.margenAngularBrazo,
      p,
    );
    s.tapadoBrazo = baseLibre ? 0 : s.tapadoBrazo + dt;
    s.libreBrazo = baseLibre ? s.libreBrazo + dt : 0;
    if (s.rodeando && s.libreBrazo >= p.esperaSalidaBrazo) {
      s.rodeando = false;
      s.ladoBrazo = 0;
      s.azimutObjetivo = s.azimutBase;
    }
    if (
      (!s.rodeando && s.tapadoBrazo >= p.esperaEntradaBrazo) ||
      (s.rodeando && !vistaBrazoLibre(s, e, s.azimutObjetivo, pedida, p.margenAngularBrazo, p))
    ) {
      const candidato = destinoBrazo(s, e, pedida, p);
      if (candidato !== null) {
        s.azimutObjetivo = candidato;
        s.ladoBrazo = Math.sign(normalizarAngulo(candidato - s.azimutBase));
        s.rodeando = true;
      }
    }
    const delta = normalizarAngulo(s.azimutObjetivo - s.azimut);
    const giro = suavizarExp(0, delta, p.vidaAzimutBrazo, dt);
    s.azimut += acotar(giro, -p.velocidadAzimutBrazo * dt, p.velocidadAzimutBrazo * dt);
  }

  // Contacto continuo con volumen: el rayo central no representa el plano cercano.
  const horizontal = Math.cos(s.elevacion);
  const situarCamara = (mira: Punto3, azimut: number) => {
    s.camara.x = mira.x + horizontal * Math.sin(azimut) * pedida;
    s.camara.y = mira.y + Math.sin(s.elevacion) * pedida;
    s.camara.z = mira.z + horizontal * Math.cos(azimut) * pedida;
  };
  // Con el usuario orbitando, lo angosto no acerca la cámara: se desvanece (más abajo). Quien no informa
  // `orbitando` (consumidor radial) no dibuja ese desvanecimiento: conserva la colisión y el rescate de siempre.
  const manual = e.orbitando === true;
  const { macizas } = separarObstaculos(e.cajas, p);
  const colisionables = manual ? macizas : e.cajas;
  situarCamara(s.mira, s.azimut);
  const seguro = distanciaLibreVolumen(s.mira, s.camara, colisionables, p.radioCamara);
  const giroReal = normalizarAngulo(s.azimut - s.azimutAnterior) / dt;
  const velocidadOrbita = acotar(
    giroReal,
    -p.velocidadOrbitaPrediccion,
    p.velocidadOrbitaPrediccion,
  );
  s.azimutAnterior = s.azimut;
  s.puntoMira.x = s.mira.x + vx * p.anticipacionColision;
  s.puntoMira.y = s.mira.y;
  s.puntoMira.z = s.mira.z + vz * p.anticipacionColision;
  situarCamara(s.puntoMira, s.azimut + velocidadOrbita * p.anticipacionColision);
  const previsto = distanciaLibreVolumen(s.puntoMira, s.camara, colisionables, p.radioCamara);
  let limite = Math.min(seguro, previsto);
  if (manual) {
    limite = Math.min(limite, limiteBarrido(s, e, colisionables, pedida, giroReal, vx, vz, p));
  }
  if (Number.isFinite(limite)) limite = Math.max(0, limite - p.margenColision);
  else limite = pedida + p.holguraBrazo;
  // Antes del compromiso angular tampoco se comprime el radio si hay salida por
  // azimut. Comprimir primero puede bajar una cámara libre hasta el propio muro.
  const puedeRodear =
    e.orbitando === false &&
    (s.rodeando
      ? vistaBrazoLibre(s, e, s.azimutObjetivo, pedida, p.margenAngularBrazo, p)
      : (Number.isFinite(seguro) || limite < p.distanciaMinBrazo) &&
        destinoBrazo(s, e, pedida, p) !== null);
  if (puedeRodear) limite = pedida + p.holguraBrazo;
  if (limite <= s.brazoObjetivo + p.margenColision) {
    s.brazoObjetivo = limite;
    s.retencionBrazo = p.retencionBrazo;
  } else if ((s.retencionBrazo = Math.max(0, s.retencionBrazo - dt)) === 0) {
    s.brazoObjetivo = limite;
  }
  const objetivo = s.brazoObjetivo;
  s.brazo = Number.isFinite(s.brazo)
    ? suavizarExp(s.brazo, objetivo, objetivo < s.brazo ? p.vidaBrazoCorto : p.vidaBrazoLargo, dt)
    : Math.min(objetivo, TOPE_DISTANCIA);
  s.distancia = Math.min(pedida, s.brazo);
  // El tope solo pertenece al bloqueo y su recuperación; una caja lejana no debe
  // cambiar el acercamiento inicial, el zoom ni la distancia extra al correr. Viniendo de más
  // lejos que la pedida (vista general → seguimiento, p. ej. al salir de construir junto a una
  // columna) manda el acercamiento normal aunque el rodeo ya esté activo.
  const llegando = distanciaAnterior > pedida + TOLERANCIA_ZOOM;
  if (!llegando && (s.rodeando || s.distancia < pedida || s.recuperandoBrazo)) {
    const cambio = s.distancia - distanciaAnterior;
    const maxCambio = p.velocidadDistanciaBrazo * dt;
    s.recuperandoBrazo = Math.abs(cambio) > maxCambio;
    s.distancia = distanciaAnterior + acotar(cambio, -maxCambio, maxCambio);
  }
  if (llegando && manual) {
    // Llegando desde la general: nunca baja más rápido que la propia llegada ni que el tope. Si un muro
    // aparece, la cámara lo cruza unos cuadros y el muro se desvanece (más abajo).
    const bajada = Math.max(p.velocidadDistanciaBrazo * dt, distanciaAnterior - pedida);
    s.distancia = Math.max(s.distancia, distanciaAnterior - bajada);
  } else if (
    Number.isFinite(seguro) &&
    ((llegando && e.orbitando !== false) || e.orbitando === undefined)
  ) {
    // Sin desvanecimiento posible (consumidor radial, o llegada sin órbita) la seguridad manda de inmediato.
    s.distancia = Math.min(s.distancia, Math.max(0, seguro - p.margenColision));
  }
  desvanecerObstaculos(s, e, manual, p);
}

/**
 * Distancia máxima que la cámara puede tener ahora para poder frenar a tiempo ante un muro que su
 * órbita va a barrer: por cada azimut que alcanzará en `t` s, el hueco libre `L` más lo que el tope de
 * cambio de distancia permite recorrer en ese tiempo (`L + velocidadDistanciaBrazo · t`). Así el brazo se
 * acorta con anticipación y nunca necesita un rescate más rápido que el tope. Infinity si el barrido está libre.
 */
function limiteBarrido(
  s: EstadoSeguimiento,
  e: EntradaSeguimiento,
  cajas: readonly Caja3[],
  pedida: number,
  giro: number,
  vx: number,
  vz: number,
  p: ParametrosSeguimiento,
): number {
  const rapidez = Math.abs(giro);
  if (rapidez < p.velocidadMinBarrido) return Infinity;
  const horizontal = Math.cos(s.elevacion);
  const seno = Math.sin(s.elevacion);
  const paso = p.pasoBarrido / rapidez;
  // Horizonte: lo que tarda el tope en llevar la cámara desde `pedida` hasta el avatar, sin pasar de una vuelta.
  const hasta = Math.min(pedida / p.velocidadDistanciaBrazo, Math.PI / rapidez);
  const mira = s.puntoMira;
  const camara = s.camara;
  let limite = Infinity;
  for (let t = paso; t <= hasta + 1e-9; t += paso) {
    const azimut = s.azimut + giro * t;
    mira.x = s.mira.x + vx * t;
    mira.y = s.mira.y;
    mira.z = s.mira.z + vz * t;
    camara.x = mira.x + horizontal * Math.sin(azimut) * pedida;
    camara.y = mira.y + seno * pedida;
    camara.z = mira.z + horizontal * Math.cos(azimut) * pedida;
    const libre = distanciaLibreVolumen(mira, camara, cajas, p.radioCamara);
    if (Number.isFinite(libre)) limite = Math.min(limite, libre + p.velocidadDistanciaBrazo * t);
  }
  return limite;
}

/** Un paso de la opacidad de algo que se desvanece al taparle la vista al avatar: baja rápido, reaparece tras una espera. */
function pasoOpacidad(
  actual: number,
  espera: number,
  tapa: boolean,
  dt: number,
  p: ParametrosSeguimiento,
): number {
  const meta = tapa ? 0 : espera >= p.esperaReaparecer ? 1 : actual;
  const nueva = suavizarExp(actual, meta, meta < actual ? p.vidaDesvanecer : p.vidaReaparecer, dt);
  return Math.abs(nueva - meta) < 1e-3 ? meta : nueva;
}

/**
 * Opacidad de cada caja de la casa y del asistente. Un obstáculo angosto que tapa al avatar desde la
 * cámara se desvanece (la cámara conserva su distancia); uno ancho solo si la cámara quedó más allá de su
 * primer contacto, porque el tope de cambio de distancia no le dejó acortar a tiempo. Los `fantasmas`
 * (envolvente exterior) y el asistente se desvanecen en cuanto quedan entre la cámara y el avatar, con o
 * sin órbita manual. Todo reaparece tras una espera.
 */
function desvanecerObstaculos(
  s: EstadoSeguimiento,
  e: EntradaSeguimiento,
  manual: boolean,
  p: ParametrosSeguimiento,
): void {
  const dt = e.dt;
  const cajas = e.cajas;
  const fantasmas = e.fantasmas ?? SIN_FANTASMAS;
  if (s.fuenteCajas !== cajas || s.fuenteFantasmas !== fantasmas) {
    s.fuenteCajas = cajas;
    s.fuenteFantasmas = fantasmas;
    s.obstaculos = fantasmas.length ? [...cajas, ...fantasmas] : cajas;
    s.opacidadObstaculos = s.obstaculos.map(() => 1);
    s.esperaObstaculos = s.obstaculos.map(() => 0);
  }
  const horizontal = Math.cos(s.elevacion);
  const camara = {
    x: s.mira.x + horizontal * Math.sin(s.azimut) * s.distancia,
    y: s.mira.y + Math.sin(s.elevacion) * s.distancia,
    z: s.mira.z + horizontal * Math.cos(s.azimut) * s.distancia,
  };
  const pecho = { x: e.x, y: e.y + p.alturasVistaBrazo[1]!, z: e.z };
  for (let i = 0; i < s.obstaculos.length; i++) {
    const caja = s.obstaculos[i]!;
    let tapa = false;
    if (i >= cajas.length) {
      tapa = distanciaLibreVolumen(pecho, camara, [caja], p.margenDesvanecer) < Infinity;
    } else if (
      manual &&
      distanciaLibreVolumen(pecho, camara, [caja], p.margenDesvanecer) < Infinity
    ) {
      tapa =
        Math.max(caja.x1 - caja.x0, caja.z1 - caja.z0) <= p.anchoAngosto ||
        distanciaLibreVolumen(s.mira, camara, [caja], p.radioCamara) <
          s.distancia - p.margenColision;
    }
    const espera = (s.esperaObstaculos[i] = tapa ? 0 : s.esperaObstaculos[i]! + dt);
    s.opacidadObstaculos[i] = pasoOpacidad(s.opacidadObstaculos[i]!, espera, tapa, dt, p);
  }
  desvanecerAsistente(s, e, camara, p);
}

/** El asistente tapa al avatar si el rayo de la cámara a su cabeza, pecho o pies cruza su cuerpo (con holgura). */
function desvanecerAsistente(
  s: EstadoSeguimiento,
  e: EntradaSeguimiento,
  camara: Punto3,
  p: ParametrosSeguimiento,
): void {
  const a = e.asistente;
  s.asistenteActivo = Boolean(a);
  if (!a) {
    s.opacidadAsistente = 1;
    s.esperaAsistente = 0;
    return;
  }
  const anillo = s.cajaAsistente;
  anillo.x0 = a.x - p.radioAnilloAsistente;
  anillo.x1 = a.x + p.radioAnilloAsistente;
  anillo.z0 = a.z - p.radioAnilloAsistente;
  anillo.z1 = a.z + p.radioAnilloAsistente;
  anillo.y0 = a.y;
  anillo.y1 = a.y + p.altoAsistente;
  const cuerpo = s.cuerpoAsistente;
  cuerpo.x0 = a.x - p.radioAsistente;
  cuerpo.x1 = a.x + p.radioAsistente;
  cuerpo.z0 = a.z - p.radioAsistente;
  cuerpo.z1 = a.z + p.radioAsistente;
  cuerpo.y0 = anillo.y0;
  cuerpo.y1 = anillo.y1;
  const lista = [cuerpo];
  let tapa = false;
  for (const altura of p.alturasVistaBrazo) {
    if (
      distanciaLibreVolumen(
        { x: e.x, y: e.y + altura, z: e.z },
        camara,
        lista,
        p.margenDesvanecer,
      ) < Infinity
    ) {
      tapa = true;
      break;
    }
  }
  s.esperaAsistente = tapa ? 0 : s.esperaAsistente + e.dt;
  s.opacidadAsistente = pasoOpacidad(s.opacidadAsistente, s.esperaAsistente, tapa, e.dt, p);
}

/**
 * Tope de elevación bajo la losa del piso del avatar: la cámara no sube más allá de `techo - margenTecho`,
 * así que baja su elevación y conserva la distancia (acortarla dejaría la cámara a pocos metros del avatar
 * o, al entrar a la sala, la haría saltar). El tope sube de inmediato (la cámara no se mueve sola) y baja a
 * `velocidadTecho`: al pasar a un piso más bajo la cámara desciende en vez de saltar. No baja de la
 * elevación mínima de la órbita.
 */
function limitarElevacionBajoTecho(
  s: EstadoSeguimiento,
  e: EntradaSeguimiento,
  pedida: number,
  dt: number,
  p: ParametrosSeguimiento,
): void {
  if (e.techo === undefined) {
    s.elevacionMax = Infinity;
    return;
  }
  const libre = e.techo - p.margenTecho - s.mira.y;
  const tope = Math.max(ELEVACION_GENERAL_MIN, Math.asin(acotar(libre / pedida, -1, 1)));
  s.elevacionMax =
    Number.isFinite(s.elevacionMax) && tope < s.elevacionMax
      ? Math.max(tope, s.elevacionMax - p.velocidadTecho * dt)
      : tope;
  s.elevacion = Math.min(e.elevacion, s.elevacionMax);
}
