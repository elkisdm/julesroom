/**
 * Avatar propio: el mando (teclas o clic) se convierte en movimiento con colisión, y el avatar
 * responde EN EL MISMO CUADRO en que llega la orden (predicción local, A6 de
 * `investigacion-videojuegos.md`, Gambetta: el cliente aplica su propia entrada sin esperar a la
 * red). Con `OPCIONES.prediccionAvatar` apagado la orden se aplica con un retardo simulado
 * (`retardoEntrada`) para poder comparar cómo se siente.
 *
 * - Teclas: `adelante` (arriba +1) y `lateral` (derecha +1) son relativos a la cámara; se giran
 *   con el azimut de la cámara (`atan2(cámara.x − mira.x, cámara.z − mira.z)`, el de
 *   `OrbitControls` y de `EstadoCamara`) a una dirección de mundo y se conduce con `conducir`.
 * - Clic: `fijarDestino` pide ir a un punto; se busca la ruta con `buscarRuta` (rodea muebles) y
 *   se la sigue: `conducir` hacia cada punto intermedio sin frenar e `irHacia` en el último. Una
 *   tecla pulsada cancela la ruta.
 * - Movimiento: la locomoción integra la posición libre y `moverConColision` (radio `RADIO_AVATAR`)
 *   la corrige: desliza por las paredes y no atraviesa muros ni muebles.
 * - Altura (mapa con `suelo`, `colision.crearMapaDeSuelo`): `y` son los pies. En el suelo siguen la
 *   superficie con `alturaEn` (suben un peldaño o una tarima de hasta un paso y bajan cualquier escalón
 *   de hasta un paso), en trozos de `TROZO` m para no saltarse peldaños aunque el cuadro sea largo. Si
 *   lo de abajo queda a más de un paso, cae con la gravedad del salto. Un salto despega con la velocidad
 *   del salto (`PARAMETROS_SALTO`) y aterriza sobre lo que haya debajo al bajar (tarima, sofá, mesa
 *   baja o el piso). La colisión lateral es la del mapa a la altura de los pies.
 * - Dibujo: la raíz del rig va en `ySuelo` (el apoyo, suavizado peldaño a peldaño; en el aire queda en
 *   el del despegue salvo que el cuerpo baje de él) y la pelvis sube `loc.salto.y = yCuerpo − ySuelo`
 *   sobre ella (el arco del salto). `yCuerpo` es la altura visible de los pies: el apoyo suavizado en el
 *   suelo y la física exacta en el aire. Así el salto no se suma dos veces y la cámara que sigue la
 *   raíz no salta con el arco. Sin `suelo`, `y` queda fija (el plano de un nivel de siempre).
 *
 * - Sentarse (`sentarEn` / `levantarse` del mando; E o clic en un asiento): la máquina de `sentarse.ts`. Va por
 *   la ruta a la aproximación del asiento, gira, se sienta y queda sentado (`estado`, `asiento`; `yRaiz` es
 *   la altura de la raíz del rig, que baja hasta la pelvis sentada). Teclas, salto o un clic al piso lo
 *   levantan (el clic se atiende al terminar de levantarse). Sentado no hay física ni colisión.
 *
 * REGLA DE ORO: `avanzarAvatar` no asigna memoria (la cola de entrada, la ruta y las salidas están
 * preasignadas). Solo `fijarDestino` crea un objeto, y es por clic.
 */

import { alturaEn, SIN_SUELO } from '../escenarios/suelo';
import type { Suelo } from '../escenarios/suelo';
import type { AccionSentarse } from '../escenarios/tipos';
import { moverConColision, techoSobre } from './colision';
import type { MapaColision, SalidaMovimiento } from './colision';
import { conducir, crearLocomocion, irHacia, PARAMETROS_LOCOMOCION } from './locomocion';
import {
  aterrizar,
  caer,
  despegar,
  gravedadSalto,
  PARAMETROS_SALTO,
  pedirSalto,
  velocidadDespegue,
} from './salto';
import type { Locomocion, ParametrosLocomocion } from './locomocion';
import { buscarRuta } from './navegacion';
import type { Navegacion } from './navegacion';
import { OPCIONES } from './opciones';
import {
  avanzarSentarse,
  crearSentarse,
  levantar,
  llegar,
  ocupado,
  pedirSentarse,
  PELVIS_DE_PIE,
  posturaDe,
} from './sentarse';
import type { Sentarse } from './sentarse';
import { PARAMETROS_SEPARACION, separacionDeAvatar } from './separacion';
import type { Otros, ParametrosSeparacion, SalidaSeparacion } from './separacion';

/** Radio (m) del cuerpo del avatar contra muros y muebles. */
export const RADIO_AVATAR = 0.3;
/** Retardo de red simulado (s) con la predicción apagada. */
export const RETARDO_ENTRADA = 0.15;

/**
 * Locomoción del avatar: sin anticipación del arranque (la respuesta tiene que verse al instante) y
 * con giro algo más vivo que el de los personajes autónomos. Valores iniciales parametrizables.
 */
export const PARAMETROS_AVATAR: ParametrosLocomocion = {
  ...PARAMETROS_LOCOMOCION,
  anticipacion: 0,
  giroMax: 18,
  fraccionGiroCerrado: 0.3,
  frenado: 40,
  frenadoCorrer: 48,
  inclinacionPorAceleracion: 0.02,
  amortiguacionResorte: 0.7,
};

/** Una ruta por clic más larga que esto (m) se recorre corriendo. Valor inicial parametrizable. */
export const DISTANCIA_CORRER_RUTA = { metros: 7 };

/**
 * Física vertical del avatar en el mundo con alturas. Valores iniciales parametrizables.
 * - `suavizado` (1/s): rapidez con que la altura visible sigue al peldaño (subir y bajar sin saltos).
 * - `velocidadCaidaMax` (m/s): tope de la caída.
 * - `tiempoCaidaMax` (s): cayendo sin suelo más que esto, vuelve al último apoyo (fuera del mundo).
 */
export const PARAMETROS_ALTURA_AVATAR = {
  suavizado: 30,
  velocidadCaidaMax: 30,
  tiempoCaidaMax: 3,
  /** Segundos de tolerancia para saltar tras abandonar un borde. */
  margenBorde: 0.1,
  /** Segundos que se recuerda una pulsación antes de aterrizar. */
  memoriaSalto: 0.12,
};

/** Lo que el jugador pide. Lo escribe la interfaz (teclado, clic); lo lee `avanzarAvatar`. */
export interface Mando {
  /** Arriba/abajo (W/↑ = +1, S/↓ = −1), relativo a la cámara. */
  adelante: number;
  /** Derecha/izquierda (D/→ = +1, A/← = −1), relativo a la cámara. */
  lateral: number;
  /** Punto del mundo al que ir por clic, o `null`. `y`: el piso que se tocó (varios niveles). */
  destino: { x: number; z: number; y?: number } | null;
  /** Sube con cada `fijarDestino` y `cancelar`: así un mismo punto pedido dos veces es una orden nueva. */
  idDestino: number;
  /** Mantener Shift: corre con las teclas. */
  correr: boolean;
  /** El destino por clic se pidió con doble clic: va corriendo. */
  destinoCorriendo: boolean;
  /** Sube con cada pulsación de salto (espacio). */
  saltos: number;
  /** Asiento al que ir a sentarse (`sentarEn`), o `null` (`levantarse`). */
  sentar: AccionSentarse | null;
  /** Sube con cada `sentarEn` y `levantarse`. */
  idSentar: number;
  /** Presencia vigente: también protege las órdenes por clic, fuera del alcance de E. */
  asientosOcupados?: ReadonlySet<string>;
  /** Pulsaciones del botón táctil; las consume el motor como la tecla E. */
  acciones?: number;
  /** Objetivo de la mirada del cuerpo mientras hay un panel o una persona a mano. */
  mirar?: { x: number; z: number } | null;
}

export const crearMando = (): Mando => ({
  adelante: 0,
  lateral: 0,
  destino: null,
  idDestino: 0,
  correr: false,
  destinoCorriendo: false,
  saltos: 0,
  sentar: null,
  idSentar: 0,
});

/**
 * Pide ir a (x, z); con `corriendo` (doble clic) va corriendo aunque la ruta sea corta. `y` es la
 * altura del piso que se tocó (un clic en otra planta); sin ella, el destino se busca en la planta del
 * avatar si la hay.
 */
export function fijarDestino(
  m: Mando,
  x: number,
  z: number,
  corriendo = false,
  y = Number.NaN,
): void {
  m.destino = Number.isFinite(y) ? { x, z, y } : { x, z };
  m.destinoCorriendo = corriendo;
  m.idDestino++;
}

/** Pide un salto. */
export function saltar(m: Mando): void {
  m.saltos++;
}

/** Pide ir a sentarse en `accion` (camina a su aproximación, gira y se sienta). */
export function sentarEn(m: Mando, accion: AccionSentarse): void {
  if (m.asientosOcupados?.has(accion.id)) return;
  m.sentar = accion;
  m.idSentar++;
}

/** Pide levantarse (o cancelar el camino al asiento). */
export function levantarse(m: Mando): void {
  m.sentar = null;
  m.idSentar++;
}

/** Cancela el destino por clic. */
export function cancelar(m: Mando): void {
  m.destino = null;
  m.idDestino++;
}

/** Entradas de la cola de retardo (anillo de cambios del mando). */
const CAPACIDAD_COLA = 64;
/** Campos por entrada: t, adelante, lateral, id, destinoX, destinoZ, destinoY (NaN = sin destino). */
const CAMPOS = 7;
/** Máximo de puntos de la ruta por clic. */
const MAX_RUTA = 64;
/** Un punto intermedio de la ruta se da por alcanzado a esta distancia (m). */
const RADIO_PUNTO_RUTA = 0.3;
/** Magnitud mínima de las teclas para contarlas como entrada. */
const UMBRAL_TECLAS = 0.01;
/** Bajo esta fracción de lo avanzado (choque de frente) el cuerpo pierde la velocidad. */
const FRACCION_CHOQUE = 0.25;
/** Tolerancias de llegada: no se baja mientras todavía camina o está desalineado. */
export const PARAMETROS_APOYO_ASIENTO = {
  distanciaLlegada: 0.16,
  radioCasiLlegado: 0.08,
  velocidadLlegada: 0.1,
};
/** Largo máximo (m) de cada trozo del avance en el mundo con alturas: menor que una huella de peldaño. */
const TROZO = 0.1;

export interface Avatar {
  loc: Locomocion;
  /** Copias de la locomoción para el motor: se refrescan al final de cada `avanzarAvatar`. */
  x: number;
  z: number;
  rumbo: number;
  velocidad: number;
  fase: number;
  /** Retardo (s) de la orden con `prediccionAvatar` apagado. */
  retardoEntrada: number;
  /** Segundos de simulación acumulados. */
  reloj: number;
  /** Mando que se está aplicando este cuadro (el actual, o el retardado). */
  efAdelante: number;
  efLateral: number;
  /** Última orden de destino atendida (`Mando.idDestino`). */
  idAtendido: number;
  ruta: Float64Array;
  nRuta: number;
  iRuta: number;
  /** Anillo de cambios del mando, para el retardo simulado. */
  cola: Float64Array;
  colaIni: number;
  colaN: number;
  salida: SalidaMovimiento;
  separacion: SalidaSeparacion;
  /** La ruta vigente se recorre corriendo (larga o pedida con doble clic). */
  rutaCorriendo: boolean;
  /** Último `Mando.saltos` atendido. */
  saltosAtendidos: number;
  /** Vencimiento de la última pulsación pendiente y momento del último apoyo. */
  saltoPendienteHasta: number;
  ultimoApoyo: number;
  /** Se consume al saltar; vuelve solo al aterrizar (nunca permite doble salto). */
  saltoDisponible: boolean;
  /** Pies (m): la superficie bajo el avatar en el suelo; la altura física en el aire. */
  y: number;
  /** Velocidad vertical (m/s, > 0 sube) en el aire. */
  vy: number;
  /** Apoyado en una superficie (no saltando ni cayendo). */
  enSuelo: boolean;
  /** Altura de la raíz del rig: el apoyo suavizado (ver cabecera). */
  ySuelo: number;
  /** Altura visible de los pies: el apoyo suavizado en el suelo, la física en el aire. */
  yCuerpo: number;
  /** Último `loc.salto.saltos` visto: si sube, el salto despegó en este cuadro. */
  saltosVistos: number;
  /** Último apoyo (para volver si cae fuera del mundo) y segundos en el aire. */
  apoyoX: number;
  apoyoZ: number;
  apoyoY: number;
  tAire: number;
  /** Sentarse y levantarse (ver `sentarse.ts`). */
  sentarse: Sentarse;
  /** Último `Mando.idSentar` atendido. */
  sentarAtendido: number;
  /** Postura que viaja en la presencia y id de la acción del asiento (`null` de pie). */
  estado: 'de-pie' | 'sentado';
  asiento: string | null;
  /** Altura de la raíz del rig: `ySuelo`, y al sentarse baja hasta la pelvis del asiento. */
  yRaiz: number;
}

/** Avatar en (x, z) mirando a `rumbo`, con los pies a la altura `y` (en el mundo con alturas se asienta solo). */
export function crearAvatar(x: number, z: number, rumbo: number, y = 0): Avatar {
  const cola = new Float64Array(CAPACIDAD_COLA * CAMPOS);
  cola[0] = Number.NEGATIVE_INFINITY;
  cola[4] = Number.NaN;
  cola[5] = Number.NaN;
  cola[6] = Number.NaN;
  return {
    loc: crearLocomocion(x, z, rumbo),
    x,
    z,
    rumbo,
    velocidad: 0,
    fase: 0,
    retardoEntrada: RETARDO_ENTRADA,
    reloj: 0,
    efAdelante: 0,
    efLateral: 0,
    idAtendido: 0,
    ruta: new Float64Array(MAX_RUTA * 2),
    nRuta: 0,
    iRuta: 0,
    cola,
    colaIni: 0,
    colaN: 1,
    salida: { x: 0, z: 0 },
    separacion: { dx: 0, dz: 0 },
    rutaCorriendo: false,
    saltosAtendidos: 0,
    saltoPendienteHasta: Number.NEGATIVE_INFINITY,
    ultimoApoyo: 0,
    saltoDisponible: true,
    y,
    vy: 0,
    enSuelo: true,
    ySuelo: y,
    yCuerpo: y,
    saltosVistos: 0,
    apoyoX: x,
    apoyoZ: z,
    apoyoY: y,
    tAire: 0,
    sentarse: crearSentarse(),
    sentarAtendido: 0,
    estado: 'de-pie',
    asiento: null,
    yRaiz: y,
  };
}

/** Guarda el mando actual en la cola si cambió respecto de la última entrada. */
function encolar(a: Avatar, m: Mando): void {
  const c = a.cola;
  const ultimo = ((a.colaIni + a.colaN - 1) % CAPACIDAD_COLA) * CAMPOS;
  const dx = m.destino ? m.destino.x : Number.NaN;
  const dz = m.destino ? m.destino.z : Number.NaN;
  const dy = m.destino?.y ?? Number.NaN;
  if (
    c[ultimo + 1] === m.adelante &&
    c[ultimo + 2] === m.lateral &&
    c[ultimo + 3] === m.idDestino
  ) {
    return;
  }
  if (a.colaN === CAPACIDAD_COLA) {
    a.colaIni = (a.colaIni + 1) % CAPACIDAD_COLA;
    a.colaN--;
  }
  const o = ((a.colaIni + a.colaN) % CAPACIDAD_COLA) * CAMPOS;
  c[o] = a.reloj;
  c[o + 1] = m.adelante;
  c[o + 2] = m.lateral;
  c[o + 3] = m.idDestino;
  c[o + 4] = dx;
  c[o + 5] = dz;
  c[o + 6] = dy;
  a.colaN++;
}

/** Deja en `efAdelante`/`efLateral` el mando vigente tras el retardo, y devuelve el índice de su entrada. */
function entradaRetardada(a: Avatar): number {
  const c = a.cola;
  const madura = a.reloj - a.retardoEntrada;
  while (a.colaN >= 2 && (c[((a.colaIni + 1) % CAPACIDAD_COLA) * CAMPOS] as number) <= madura) {
    a.colaIni = (a.colaIni + 1) % CAPACIDAD_COLA;
    a.colaN--;
  }
  return a.colaIni * CAMPOS;
}

/**
 * Un paso del avatar de `dt` segundos. `azimutCamara` es el de la cámara (ver arriba). Con
 * `prediccionAvatar` encendido el mando de ESTE cuadro mueve al avatar ya en este cuadro.
 */
export function avanzarAvatar(
  a: Avatar,
  mando: Mando,
  azimutCamara: number,
  mapa: MapaColision,
  nav: Navegacion,
  p: ParametrosLocomocion,
  dt: number,
  otros?: Otros,
  sep: ParametrosSeparacion = PARAMETROS_SEPARACION,
): void {
  if (!(dt > 0)) return;
  a.reloj += dt;

  let adelante: number;
  let lateral: number;
  let id: number;
  let destX: number;
  let destZ: number;
  let destY: number;
  if (OPCIONES.prediccionAvatar) {
    adelante = mando.adelante;
    lateral = mando.lateral;
    id = mando.idDestino;
    destX = mando.destino ? mando.destino.x : Number.NaN;
    destZ = mando.destino ? mando.destino.z : Number.NaN;
    destY = mando.destino?.y ?? Number.NaN;
  } else {
    encolar(a, mando);
    const o = entradaRetardada(a);
    adelante = a.cola[o + 1] as number;
    lateral = a.cola[o + 2] as number;
    id = a.cola[o + 3] as number;
    destX = a.cola[o + 4] as number;
    destZ = a.cola[o + 5] as number;
    destY = a.cola[o + 6] as number;
  }
  a.efAdelante = adelante;
  a.efLateral = lateral;

  const l = a.loc;
  const suelo = mapa.suelo;
  l.salto.mundo = suelo !== undefined;
  const x0 = l.x;
  const z0 = l.z;
  const fase0 = l.fase;

  const magnitud = Math.hypot(adelante, lateral);
  const saltoPedido = mando.saltos !== a.saltosAtendidos;

  // Sentarse: orden de E o de un clic en el asiento, y cualquier otro mando lo deja (o cancela el camino).
  const sent = a.sentarse;
  if (
    sent.id &&
    mando.asientosOcupados?.has(sent.id) &&
    (sent.fase === 'yendo' || sent.fase === 'girando' || sent.fase === 'sentandose')
  )
    dejarAsiento(a);
  if (mando.idSentar !== a.sentarAtendido) {
    a.sentarAtendido = mando.idSentar;
    const pedida = mando.sentar;
    if (!pedida) dejarAsiento(a);
    else if (!mando.asientosOcupados?.has(pedida.id)) {
      // Otro asiento mientras va (o gira) hacia uno: cambia de destino.
      if (sent.id !== pedida.id && (sent.fase === 'yendo' || sent.fase === 'girando'))
        dejarAsiento(a);
      if (pedirSentarse(sent, pedida.id, pedida.asiento)) {
        const ap = pedida.asiento.aproximacion;
        iniciarRuta(a, nav, ap.x, ap.z, ap.y, false);
        // Sin camino hasta la aproximación (y lejos de ella): no hay a dónde ir.
        if (
          a.nRuta === 0 &&
          Math.hypot(ap.x - l.x, ap.z - l.z) > PARAMETROS_APOYO_ASIENTO.distanciaLlegada
        )
          dejarAsiento(a);
      }
    }
  }
  if (sent.fase !== 'libre' && (magnitud > UMBRAL_TECLAS || saltoPedido || id !== a.idAtendido)) {
    dejarAsiento(a);
  }

  // Sentándose, sentado o levantándose: la máquina mueve el cuerpo (sin física ni colisión).
  if (ocupado(sent)) {
    if (saltoPedido) a.saltosAtendidos = mando.saltos;
    conducir(l, 0, 0, 0, p, dt);
    avanzarSentarse(sent, l, dt);
    if (sent.fase !== 'girando') {
      l.velocidad = 0;
      l.giro = 0;
    }
    reflejar(a, l);
    return;
  }

  // Orden nueva de destino: calcula la ruta (o la descarta si se canceló).
  if (id !== a.idAtendido) {
    a.idAtendido = id;
    if (destX === destX && destZ === destZ) {
      iniciarRuta(a, nav, destX, destZ, destY, mando.destinoCorriendo);
    } else {
      a.nRuta = 0;
      a.iRuta = 0;
      a.rutaCorriendo = mando.destinoCorriendo;
    }
  }

  // Una pulsación puede adelantarse al aterrizaje o llegar justo después de un borde.
  if (saltoPedido) {
    a.saltosAtendidos = mando.saltos;
    a.saltoPendienteHasta = a.reloj + PARAMETROS_ALTURA_AVATAR.memoriaSalto;
  }
  atenderSalto(a, suelo !== undefined);

  if (magnitud > UMBRAL_TECLAS) {
    // Teclas relativas a la cámara: adelante = (−sen az, −cos az), derecha = (cos az, −sen az).
    a.nRuta = 0;
    l.correr = mando.correr;
    const s = Math.sin(azimutCamara);
    const c = Math.cos(azimutCamara);
    conducir(l, -s * adelante + c * lateral, -c * adelante - s * lateral, magnitud, p, dt);
  } else if (a.iRuta < a.nRuta) {
    l.correr = a.rutaCorriendo || mando.correr;
    // Consumir antes de conducir: no girar un cuadro hacia un punto que ya quedó atrás.
    while (
      a.iRuta < a.nRuta - 1 &&
      Math.hypot((a.ruta[a.iRuta * 2] as number) - l.x, (a.ruta[a.iRuta * 2 + 1] as number) - l.z) <
        RADIO_PUNTO_RUTA
    )
      a.iRuta++;
    const ultimo = a.iRuta === a.nRuta - 1;
    const px = a.ruta[a.iRuta * 2] as number;
    const pz = a.ruta[a.iRuta * 2 + 1] as number;
    if (ultimo) {
      if (irHacia(l, px, pz, p, dt)) a.iRuta++;
    } else {
      conducir(l, px - l.x, pz - l.z, 1, p, dt);
    }
  } else {
    conducir(l, 0, 0, 0, p, dt);
  }

  // Colisión: la locomoción movió libremente; se rehace ese desplazamiento contra el mapa.
  const dx = l.x - x0;
  const dz = l.z - z0;
  const pedido = Math.hypot(dx, dz);
  if (pedido > 0) {
    if (suelo) {
      // En trozos: los pies siguen cada peldaño y la colisión es la de su altura.
      const n = Math.ceil(pedido / TROZO);
      a.salida.x = x0;
      a.salida.z = z0;
      for (let k = 0; k < n; k++) {
        moverConColision(mapa, a.salida.x, a.salida.z, dx / n, dz / n, RADIO_AVATAR, a.salida, a.y);
        if (a.enSuelo) seguirSuelo(a, suelo, a.salida.x, a.salida.z);
      }
    } else {
      moverConColision(mapa, x0, z0, dx, dz, RADIO_AVATAR, a.salida);
    }
    l.x = a.salida.x;
    l.z = a.salida.z;
    const logrado = Math.hypot(l.x - x0, l.z - z0) / pedido;
    if (logrado < FRACCION_CHOQUE) l.velocidad *= logrado;
    // Los pies solo pisan lo que el cuerpo avanzó de verdad: contra un muro no caminan en el sitio.
    if (logrado < 1) {
      let dFase = l.fase - fase0;
      if (dFase < -0.5) dFase += 1;
      else if (dFase > 0.5) dFase -= 1;
      const f = fase0 + dFase * logrado;
      l.fase = f - Math.floor(f);
    }
  }

  // Separación suave de otras personas y agentes (nunca un muro): bordea o empuja hacia un lado.
  if (OPCIONES.separacion && otros && otros.n > 0) {
    const vel = l.velocidad;
    const dirX = vel > 0.05 ? Math.sin(l.rumbo) : 0;
    const dirZ = vel > 0.05 ? Math.cos(l.rumbo) : 0;
    separacionDeAvatar(l.x, l.z, vel, otros, sep, dt, a.separacion, dirX, dirZ);
    if (a.separacion.dx !== 0 || a.separacion.dz !== 0) {
      moverConColision(
        mapa,
        l.x,
        l.z,
        a.separacion.dx,
        a.separacion.dz,
        RADIO_AVATAR,
        a.salida,
        suelo ? a.y : Number.NaN,
      );
      l.x = a.salida.x;
      l.z = a.salida.z;
    }
  }

  if (suelo) avanzarAltura(a, l, suelo, mapa, dt);
  if (suelo && a.enSuelo) {
    a.ultimoApoyo = a.reloj;
    if (l.salto.fase === 'suelo' || l.salto.fase === 'aterrizaje') {
      a.saltoDisponible = true;
      atenderSalto(a, true);
    }
  }

  // Terminó el camino a la aproximación del asiento (o está casi en ella y quieto: alguien lo aparta de ese
  // punto exacto): gira y se sienta. Si el camino acabó lejos, no era alcanzable.
  if (sent.fase === 'yendo') {
    const ap = (sent.asiento as NonNullable<typeof sent.asiento>).aproximacion;
    const falta = Math.hypot(ap.x - l.x, ap.z - l.z);
    if (a.iRuta >= a.nRuta) {
      if (falta <= PARAMETROS_APOYO_ASIENTO.distanciaLlegada) llegar(sent);
      else dejarAsiento(a);
    } else if (
      a.iRuta === a.nRuta - 1 &&
      falta <= PARAMETROS_APOYO_ASIENTO.radioCasiLlegado &&
      l.velocidad < PARAMETROS_APOYO_ASIENTO.velocidadLlegada
    ) {
      llegar(sent);
    }
  }

  reflejar(a, l);
}

/** Consume una pulsación vigente una sola vez. En el borde no se espera agachado en el aire. */
function atenderSalto(a: Avatar, mundo: boolean): void {
  if (a.saltoPendienteHasta < a.reloj) return;
  if (!mundo || a.enSuelo) {
    if (!pedirSalto(a.loc.salto)) return;
  } else {
    if (!a.saltoDisponible || a.reloj - a.ultimoApoyo > PARAMETROS_ALTURA_AVATAR.margenBorde)
      return;
    despegarEnMundo(a);
  }
  a.saltoDisponible = false;
  a.saltoPendienteHasta = Number.NEGATIVE_INFINITY;
}

/** Conserva el salto al abandonar el apoyo, incluso durante la anticipación. */
function despegarEnMundo(a: Avatar): void {
  despegar(a.loc.salto, PARAMETROS_SALTO);
  a.saltosVistos = a.loc.salto.saltos;
  a.vy = velocidadDespegue(PARAMETROS_SALTO);
  a.tAire = 0;
}

/** Levanta (o cancela el camino al asiento: yendo, también descarta la ruta). */
function dejarAsiento(a: Avatar): void {
  if (a.sentarse.fase === 'yendo') {
    a.nRuta = 0;
    a.iRuta = 0;
  }
  levantar(a.sentarse);
}

/**
 * Calcula la ruta a (x, z, y) desde donde está y decide si se recorre corriendo (larga, o `corriendo`).
 * Sin camino deja `nRuta` en 0. No asigna.
 */
function iniciarRuta(
  a: Avatar,
  nav: Navegacion,
  x: number,
  z: number,
  y: number,
  corriendo: boolean,
): void {
  const l = a.loc;
  a.iRuta = 0;
  a.nRuta = buscarRuta(nav, l.x, l.z, x, z, a.ruta, MAX_RUTA, a.y, y);
  let largo = 0;
  let px = l.x;
  let pz = l.z;
  for (let i = 0; i < a.nRuta; i++) {
    const qx = a.ruta[i * 2] as number;
    const qz = a.ruta[i * 2 + 1] as number;
    largo += Math.hypot(qx - px, qz - pz);
    px = qx;
    pz = qz;
  }
  a.rutaCorriendo = corriendo || largo > DISTANCIA_CORRER_RUTA.metros;
}

/** Copia la locomoción y el estado de sentarse a los campos que lee el motor. */
function reflejar(a: Avatar, l: Locomocion): void {
  a.x = l.x;
  a.z = l.z;
  a.rumbo = l.rumbo;
  a.velocidad = l.velocidad;
  a.fase = l.fase;
  const s = a.sentarse;
  a.estado = posturaDe(s);
  a.asiento = s.id;
  const baja = s.asiento && ocupado(s) ? Math.min(1, s.salida.altura) : 0;
  a.yRaiz = s.asiento ? a.ySuelo + (s.asiento.y - PELVIS_DE_PIE - a.ySuelo) * baja : a.ySuelo;
}

/**
 * En el suelo, los pies toman la superficie bajo (x, z): suben o bajan hasta un paso; si lo de abajo
 * queda más lejos, empieza la caída.
 */
function seguirSuelo(a: Avatar, suelo: Suelo, x: number, z: number): void {
  const h = alturaEn(suelo, x, z, a.y);
  if (h !== SIN_SUELO && h >= a.y - suelo.paso) {
    a.y = h;
    return;
  }
  a.enSuelo = false;
  if (a.loc.salto.fase === 'impulso') despegarEnMundo(a);
  else {
    a.vy = 0;
    a.tAire = 0;
    caer(a.loc.salto);
  }
}

/** Despegue, gravedad, aterrizaje y alturas de dibujo del cuadro. No asigna. */
function avanzarAltura(
  a: Avatar,
  l: Locomocion,
  suelo: Suelo,
  mapa: MapaColision,
  dt: number,
): void {
  const salto = l.salto;
  // Despegó en este cuadro (el impulso terminó en la locomoción): sale con la velocidad del salto.
  if (salto.saltos !== a.saltosVistos) {
    a.saltosVistos = salto.saltos;
    if (a.enSuelo) {
      a.enSuelo = false;
      a.vy = velocidadDespegue(PARAMETROS_SALTO);
      a.tAire = 0;
    }
  } else if (!OPCIONES.caminataPoses && salto.fase === 'impulso') {
    // Sin poses la locomoción no avanza el salto: despega ya.
    despegar(salto, PARAMETROS_SALTO);
    a.saltosVistos = salto.saltos;
    a.enSuelo = false;
    a.vy = velocidadDespegue(PARAMETROS_SALTO);
    a.tAire = 0;
  }

  const P = PARAMETROS_ALTURA_AVATAR;
  if (a.enSuelo) {
    // Quieto o sin avanzar también se asienta (al crearlo, o si el suelo cambió).
    seguirSuelo(a, suelo, l.x, l.z);
  }
  if (!a.enSuelo) {
    const yAntes = a.y;
    a.vy -= gravedadSalto(PARAMETROS_SALTO) * dt;
    if (a.vy < -P.velocidadCaidaMax) a.vy = -P.velocidadCaidaMax;
    a.y += a.vy * dt;
    if (a.vy > 0) {
      // Golpe de cabeza: no atraviesa la losa de arriba ni un mueble volado.
      const techo =
        techoSobre(mapa, l.x, l.z, RADIO_AVATAR, yAntes + suelo.altoCuerpo) - suelo.altoCuerpo;
      if (a.y > techo) {
        a.y = techo;
        a.vy = 0;
      }
    }
    a.tAire += dt;
    const h = alturaEn(suelo, l.x, l.z, yAntes > a.y ? yAntes : a.y);
    if (a.vy <= 0 && h !== SIN_SUELO && a.y <= h) {
      const v0 = velocidadDespegue(PARAMETROS_SALTO);
      aterrizar(salto, Math.min(1, -a.vy / v0));
      a.y = h;
      a.vy = 0;
      a.enSuelo = true;
    } else if (a.tAire > P.tiempoCaidaMax) {
      // Fuera del mundo: vuelve al último apoyo.
      l.x = a.apoyoX;
      l.z = a.apoyoZ;
      l.velocidad = 0;
      a.y = a.ySuelo = a.yCuerpo = a.apoyoY;
      a.vy = 0;
      a.enSuelo = true;
      aterrizar(salto, 0);
    }
  }

  // A la altura nueva pueden bloquear cajas que antes no (el borde de la planta de arriba): sale de ellas.
  moverConColision(mapa, l.x, l.z, 0, 0, RADIO_AVATAR, a.salida, a.y);
  l.x = a.salida.x;
  l.z = a.salida.z;

  if (a.enSuelo) {
    a.apoyoX = l.x;
    a.apoyoZ = l.z;
    a.apoyoY = a.y;
    a.tAire = 0;
    const k = 1 - Math.exp(-P.suavizado * dt);
    a.yCuerpo += (a.y - a.yCuerpo) * k;
    a.ySuelo += (a.y - a.ySuelo) * k;
  } else {
    a.yCuerpo = a.y;
    if (a.y < a.ySuelo) a.ySuelo = a.y;
  }
  salto.y = a.yCuerpo - a.ySuelo;
  salto.vy = a.vy;
}
