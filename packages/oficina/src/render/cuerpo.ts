import type { Group } from 'three';
import type { Azar } from '../azar';
import { calcularPose, crearPose } from '../animacion/articulaciones';
import type { EntradaPose, Pose } from '../animacion/articulaciones';
import { elegirInteres, crearInteres, crearSalidaInteres } from '../animacion/interes';
import type { Candidatos, Interes, PosicionYo, SalidaInteres } from '../animacion/interes';
import {
  avanzarFaseCaminata,
  calcularCaminata,
  crearSalidaCaminata,
  mezclarPoseSalto,
} from '../animacion/caminata';
import type { SalidaCaminata } from '../animacion/caminata';
import {
  PARAMETROS_LOCOMOCION,
  alabeoDeseado,
  crearLocomocion,
  type Locomocion,
} from '../animacion/locomocion';
import { avanzarSalto, PARAMETROS_SALTO, velocidadDespegue } from '../animacion/salto';
import { ajustarAlTerreno, crearEstadoPies, inclinarEnPendiente } from '../animacion/pisada';
import type { EstadoPies } from '../animacion/pisada';
import type { Suelo } from '../escenarios/suelo';
import { LIMITE_YAW } from '../animacion/mirada';
import { OPCIONES } from '../animacion/opciones';
import { PERFIL_NEUTRO } from '../animacion/personalidad';
import type { PerfilIdle } from '../animacion/personalidad';
import {
  crearResorte,
  envolverAngulo,
  resorteCritico,
  resorteSub,
  suavizarExp,
} from '../animacion/resorte';
import type { Resorte } from '../animacion/resorte';
import { avanzarSecundario, crearSecundario, impulsoPisada } from '../animacion/secundario';
import type { EntradasSecundario, Secundario } from '../animacion/secundario';
import { crearAjusteVida, avanzarVida, crearVida, semillaDe } from '../animacion/vida';
import type { AjusteVida, Vida } from '../animacion/vida';
import { avanzarFase, calcularZancada, crearSalidaZancada } from '../animacion/zancada';
import type { SalidaZancada } from '../animacion/zancada';
import { avanzarMarchaRemota, crearMarchaRemota } from '../presencia/marcha-remota';
import type { MarchaRemota } from '../presencia/marcha-remota';
import type { Rig } from './animador';
import { celdasCara } from './texturas';

/**
 * Cuerpo de una persona: reúne la locomoción con peso, el movimiento secundario, la vida en reposo
 * y el interés (mirada), y los escribe en un `Rig`. Lo comparten el avatar propio y las personas
 * remotas. Quien lo usa solo mantiene `estado.loc` (con `irHacia`/`conducir` o con
 * `alimentarLocomocion`) y llama a `aplicarCuerpo` una vez por cuadro.
 *
 * Fuentes (investigacion-videojuegos.md): A1.2 (marcha por distancia), A2 (resortes), A4 (vida en
 * reposo, mirada) y A3 (aplastar y estirar). Cada técnica respeta su interruptor de `OPCIONES`:
 * apagada, vuelve al camino anterior (marcha senoidal con `calcularPose`, inclinación proporcional
 * a la velocidad, torso que solo respira, cabeza sin movimiento propio).
 *
 * Regla de oro: `aplicarCuerpo` y `alimentarLocomocion` corren por persona y por cuadro y NO
 * asignan memoria; todo vive en `EstadoCuerpo`.
 */

/** Valores iniciales parametrizables. */
export const PARAMETROS_CUERPO = {
  /** Alturas de la pelvis en reposo (m): pelvis del rig. */
  alturaPelvis: 0.62,
  /** Bajo esta velocidad (m/s) se considera quieto (vida, gestos, deriva de cabeza). */
  velocidadQuieto: 0.05,
  /** Velocidad (m/s) a partir de la cual la deriva de cabeza se apaga del todo al caminar. */
  velocidadSinDeriva: 0.5,
  /** Cuánto baja la pelvis (m) por unidad de aplastamiento de la escala (1 − escalaY). */
  descensoPisada: 0.15,
  /** Media vida (s) del suavizado de la mirada hacia su objetivo. */
  mediaVidaMirada: 0.12,
  /** Media vida (s) del resorte crítico de inclinación (cuando el rebase está apagado). */
  mediaVidaInclinacion: 0.06,
  /** Media vida (s) con que `alimentarLocomocion` sube y baja la velocidad derivada. */
  mediaVidaVelocidadSube: 0.03,
  mediaVidaVelocidadBaja: 0.1,
  /** Con las instantáneas apagadas la posición llega a escalones: se suaviza más. */
  mediaVidaVelocidadCruda: 0.15,
  /** Media vida (s) del giro derivado y topes de lo derivado (m/s², rad/s). */
  mediaVidaGiro: 0.08,
  aceleracionMax: 6,
  giroMax: 8,
  /** Rapidez (m/s) desde la que un desplazamiento se trata como teletransporte, no como caminata. */
  velocidadSalto: 6,
  /** Resortes de accesorios: frecuencia base (rad/s), razón y ganancias (rad por m/s² y por m/s). */
  frecuenciaAccesorio: 8,
  amortiguacionAccesorio: 0.35,
  gananciaAccesorioAcel: 0.1,
  gananciaAccesorioVel: 0.12,
  gananciaAccesorioLat: 0.05,
  /** Tope (rad) de la inclinación de un accesorio. */
  limiteAccesorio: 0.5,
};

const P = PARAMETROS_CUERPO;
const PL = PARAMETROS_LOCOMOCION;
const VELOCIDAD_PASEO = PL.velMax;
const DT_MAX = 0.25;

export interface EstadoCuerpo {
  id: string;
  /** Identidad numérica estable (Int32) para `Candidatos`. */
  idNum: number;
  loc: Locomocion;
  secundario: Secundario;
  vida: Vida;
  ajuste: AjusteVida;
  interes: Interes;
  salidaInteres: SalidaInteres;
  /** Rumbo dibujado: lo escribe `aplicarCuerpo` en `rig.raiz.rotation.y` (copia de `loc.rumbo`). */
  rumbo: number;
  /** Mirada deseada respecto del cuerpo (rad); la rellena `elegirMirada`. */
  objetivoYaw: number;
  objetivoPitch: number;
  /** Mirada suavizada que se aplica a la cabeza. */
  miradaYaw: number;
  miradaPitch: number;
  /** Estilo de cara para el parpadeo (el rig no lo guarda); lo fija quien crea la persona. */
  estiloCara: string;
  /** Caminata por poses (con `OPCIONES.caminataPoses`). */
  caminata: SalidaCaminata;
  /** Fase del salto vista el cuadro anterior (para el impulso de aterrizaje). */
  saltoVisto: string;
  /**
   * Terreno: con `suelo` cada pie se apoya en su peldaño (`ajustarAlTerreno`); `ySuelo` es la altura de la
   * raíz (la de `rig.raiz.position.y`) y `pendiente` la que se conoce de fuera (NaN: se mide del suelo;
   * sin suelo, con un número solo se inclina el torso). Los fija quien posiciona la raíz, cada cuadro.
   */
  suelo: Suelo | null;
  ySuelo: number;
  pendiente: number;
  pies: EstadoPies;
  /** Camino anterior: salida de la zancada por distancia. */
  zancada: SalidaZancada;
  /** Camino anterior: marcha senoidal y su pose. */
  marcha: MarchaRemota;
  pose: Pose;
  entradaPose: EntradaPose;
  /** Resortes críticos de inclinación y alabeo (rebase apagado). */
  inclinacionCritica: Resorte;
  alabeoCritico: Resorte;
  /** Un resorte por grupo de `rig.secundarios` (se dimensionan la primera vez que se ve el rig). */
  accesorios: Resorte[];
  accesoriosLat: Resorte[];
  /** Buffers reutilizables. */
  entradaSecundario: EntradasSecundario;
  yo: PosicionYo;
  hombro: Float64Array;
  codo: Float64Array;
  abduccion: Float64Array;
  azar: Azar;
  iniciado: boolean;
  pisadaVista: number;
  parpadeando: boolean;
}

/** Azar determinista (mulberry32) con la semilla de la identidad. */
function azarDeSemilla(semilla: number): Azar {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function crearEstadoCuerpo(id: string, perfil: PerfilIdle = PERFIL_NEUTRO): EstadoCuerpo {
  const semilla = semillaDe(id);
  const idNum = semilla | 0;
  return {
    id,
    idNum,
    loc: crearLocomocion(0, 0, 0),
    secundario: crearSecundario(),
    vida: crearVida(semilla, perfil),
    ajuste: crearAjusteVida(),
    interes: crearInteres(semilla),
    salidaInteres: crearSalidaInteres(),
    rumbo: 0,
    objetivoYaw: 0,
    objetivoPitch: 0,
    miradaYaw: 0,
    miradaPitch: 0,
    estiloCara: 'feliz',
    caminata: crearSalidaCaminata(),
    saltoVisto: 'suelo',
    suelo: null,
    ySuelo: 0,
    pendiente: Number.NaN,
    pies: crearEstadoPies(),
    zancada: crearSalidaZancada(),
    marcha: crearMarchaRemota(0, 0),
    pose: crearPose(),
    entradaPose: { fase: 0, postura: 'de_pie', velocidad: 0, t: 0 },
    inclinacionCritica: crearResorte(),
    alabeoCritico: crearResorte(),
    accesorios: [],
    accesoriosLat: [],
    entradaSecundario: { aceleracionLong: 0, aceleracionLat: 0, giro: 0, velocidad: 0 },
    yo: { x: 0, z: 0, id: idNum },
    hombro: new Float64Array(2),
    codo: new Float64Array(2),
    abduccion: new Float64Array(2),
    azar: azarDeSemilla(semilla),
    iniciado: false,
    pisadaVista: 0,
    parpadeando: false,
  };
}

const limitar = (valor: number, limite: number) => Math.max(-limite, Math.min(limite, valor));

/**
 * Para quien NO conduce la locomoción (personas remotas): deriva velocidad, giro, aceleraciones,
 * fase por distancia, pisadas e inclinación de la posición y el rumbo que se dibujan este cuadro.
 * Una rapidez de más de `velocidadSalto` (reconexión, teletransporte) no cuenta como caminata. In situ.
 */
export function alimentarLocomocion(
  l: Locomocion,
  x: number,
  z: number,
  rumbo: number,
  dt: number,
): void {
  if (!(dt > 0)) {
    l.x = x;
    l.z = z;
    l.rumbo = envolverAngulo(rumbo);
    return;
  }
  const distancia = Math.hypot(x - l.x, z - l.z);
  const bruta = distancia > P.velocidadSalto * dt ? 0 : distancia / dt;
  const anterior = l.velocidad;
  const media = !OPCIONES.snapshots
    ? P.mediaVidaVelocidadCruda
    : bruta > anterior
      ? P.mediaVidaVelocidadSube
      : P.mediaVidaVelocidadBaja;
  l.velocidad = suavizarExp(anterior, bruta, media, dt);
  if (l.velocidad < 1e-4) l.velocidad = 0;
  l.aceleracionLong = limitar((l.velocidad - anterior) / dt, P.aceleracionMax);
  const giroBruto = limitar(envolverAngulo(rumbo - l.rumbo) / dt, P.giroMax);
  l.giro = suavizarExp(l.giro, giroBruto, P.mediaVidaGiro, dt);
  l.aceleracionLat = l.velocidad * l.giro;
  l.rumbo = envolverAngulo(rumbo);
  l.x = x;
  l.z = z;

  const faseAnterior = l.fase;
  if (OPCIONES.caminataPoses) {
    avanzarSalto(l.salto, PARAMETROS_SALTO, dt);
    // En el aire las piernas no «caminan» (como en `locomocion`).
    if (l.salto.fase !== 'aire') l.fase = avanzarFaseCaminata(l.fase, l.velocidad, dt);
  } else {
    l.fase = avanzarFase(l.fase, l.velocidad, dt);
  }
  l.ultimaPisada +=
    (l.fase < faseAnterior ? 2 : 0) + Math.floor(2 * l.fase) - Math.floor(2 * faseAnterior);

  const incl = limitar(
    PL.inclinacionPorAceleracion * l.aceleracionLong + PL.inclinacionPorVelocidad * l.velocidad,
    PL.inclinacionMax,
  );
  resorteSub(l.inclinacion, incl, PL.frecuenciaResorte, PL.amortiguacionResorte, dt);
  resorteSub(l.alabeo, alabeoDeseado(l, PL), PL.frecuenciaResorte, PL.amortiguacionAlabeo, dt);
}

/**
 * Elige a quién mira (`elegirInteres`) entre los `n` candidatos y deja en el estado el yaw
 * deseado respecto del cuerpo. `aplicarCuerpo` lo aplica solo con `OPCIONES.interes`.
 */
export function elegirMirada(
  e: EstadoCuerpo,
  c: Candidatos,
  n: number,
  t: number,
  dt: number,
): void {
  e.yo.x = e.loc.x;
  e.yo.z = e.loc.z;
  elegirInteres(e.interes, c, n, e.yo, t, dt, e.salidaInteres);
  const i = e.salidaInteres.objetivoIndice;
  if (i >= 0) {
    const dx = (c.x[i] as number) - e.loc.x;
    const dz = (c.z[i] as number) - e.loc.z;
    e.objetivoYaw = limitar(envolverAngulo(Math.atan2(dx, dz) - e.loc.rumbo), LIMITE_YAW);
    e.objetivoPitch = 0;
  }
}

/** Mezcla `valor` hacia `meta` con peso `p` (0..1). */
const mezcla = (valor: number, meta: number, p: number) => valor + (meta - valor) * p;

/** Suavizado con el interruptor de `suavizadoExp`: apagado, el `lerp(k·dt)` de antes. */
function suavizar(actual: number, meta: number, mediaVida: number, dt: number): number {
  if (OPCIONES.suavizadoExp) return suavizarExp(actual, meta, mediaVida, dt);
  return actual + (meta - actual) * Math.min(1, dt * 8);
}

/** Suma al estado de brazos y cabeza el gesto en curso (índice de `GESTOS_VIDA`). */
const gestoPitchCabeza = { pitch: 0, yaw: 0, roll: 0, columna: 0 };
function aplicarGesto(e: EstadoCuerpo, indice: number, progreso: number, t: number): void {
  let env = Math.min(1, progreso * 5, (1 - progreso) * 5);
  env = env < 0 ? 0 : env * env * (3 - 2 * env);
  const g = gestoPitchCabeza;
  const h = e.hombro;
  const c = e.codo;
  const a = e.abduccion;
  switch (indice) {
    case 0: // rascarse la cabeza (brazo derecho)
      h[1] = mezcla(h[1] as number, -2.5 + 0.12 * Math.sin(t * 9), env);
      c[1] = mezcla(c[1] as number, 1.9, env);
      a[1] = mezcla(a[1] as number, 0.35, env);
      g.roll = 0.08 * env;
      break;
    case 1: // estirar el cuello
      g.pitch = 0.25 * env * Math.sin(Math.PI * progreso);
      g.roll = 0.22 * env * Math.sin(2 * Math.PI * progreso);
      break;
    case 2: // mirar el teléfono (brazo derecho)
      h[1] = mezcla(h[1] as number, -1, env);
      c[1] = mezcla(c[1] as number, 1.9, env);
      g.pitch = -0.3 * env;
      break;
    case 3: // mirar alrededor
      g.yaw = 0.5 * env * Math.sin(2 * Math.PI * progreso);
      break;
    case 4: // tamborilear (brazo derecho)
      h[1] = mezcla(h[1] as number, -0.7, env);
      c[1] = mezcla(c[1] as number, 1.3 + 0.1 * Math.sin(t * 17), env);
      break;
    default: // estirar la espalda: los dos brazos arriba
      for (let k = 0; k < 2; k++) {
        h[k] = mezcla(h[k] as number, -2.7, env);
        a[k] = mezcla(a[k] as number, 0.3, env);
      }
      g.columna = -0.12 * env;
      g.pitch = 0.2 * env;
  }
}

/** Escribe todas las piezas del rig según el estado del cuerpo. No toca la posición de `raiz`. */
export function aplicarCuerpo(rig: Rig, e: EstadoCuerpo, t: number, dt: number): void {
  const d = dt > 0 ? (dt > DT_MAX ? DT_MAX : dt) : 0;
  const l = e.loc;
  const v = l.velocidad;
  if (!e.iniciado) {
    e.iniciado = true;
    // Orden YXZ en las caderas: primero se deshace el giro de la pelvis, luego el paso y el ladeo.
    rig.piernas[0].cadera.rotation.order = 'YXZ';
    rig.piernas[1].cadera.rotation.order = 'YXZ';
    e.marcha.x = l.x;
    e.marcha.z = l.z;
    e.pisadaVista = l.ultimaPisada;
  }
  const quieto = v < P.velocidadQuieto;
  const quietud = 1 - Math.min(1, v / P.velocidadSinDeriva);

  // --- pisadas y movimiento secundario ---
  if (l.ultimaPisada !== e.pisadaVista) {
    e.pisadaVista = l.ultimaPisada;
    if (OPCIONES.aplastarEstirar) impulsoPisada(e.secundario, Math.min(1, v / VELOCIDAD_PASEO));
  }
  const fs = l.salto.fase;
  if (fs !== e.saltoVisto) {
    if (fs === 'aterrizaje' && OPCIONES.aplastarEstirar)
      impulsoPisada(e.secundario, 0.6 + l.salto.impacto);
    e.saltoVisto = fs;
  }
  const s = e.secundario;
  if (OPCIONES.resorteRebase || OPCIONES.aplastarEstirar) {
    const es = e.entradaSecundario;
    es.aceleracionLong = l.aceleracionLong;
    es.aceleracionLat = l.aceleracionLat;
    es.giro = l.giro;
    es.velocidad = v;
    avanzarSecundario(s, es, d);
  }

  // --- vida ---
  const va = e.ajuste;
  if (OPCIONES.vida) avanzarVida(e.vida, d, quieto, t, e.azar, va);

  // --- piernas, brazos, pelvis ---
  let pelvisY: number;
  let columnaX: number;
  const abd = e.abduccion;
  abd[0] = 0.05;
  abd[1] = 0.05;
  let cad0: number;
  let cad1: number;
  let rod0: number;
  let rod1: number;
  let pelvisX = 0;
  let pelvisGiro = 0;
  let pelvisLadeo = 0;
  let torsoGiro = 0;
  let inclinacionCiclo = 0;
  let cabezaCicloPitch = 0;
  let cabezaCicloYaw = 0;
  let alturaSalto = 0;
  const conPoses = OPCIONES.caminataPoses && OPCIONES.marchaPorDistancia;
  if (conPoses) {
    const c = calcularCaminata(l.fase, v, e.caminata);
    mezclarPoseSalto(
      c,
      l.salto,
      v,
      PARAMETROS_SALTO.impulso,
      PARAMETROS_SALTO.aterrizaje,
      velocidadDespegue(PARAMETROS_SALTO),
    );
    if (l.salto.fase === 'aire') {
      e.pies.iniciado = false;
    } else if (e.suelo) {
      ajustarAlTerreno(
        e.pies,
        e.suelo,
        c,
        l.x,
        l.z,
        l.rumbo,
        l.giro,
        e.ySuelo,
        v,
        l.fase,
        d,
        e.pendiente,
      );
    } else if (e.pendiente === e.pendiente) {
      inclinarEnPendiente(e.pies, c, e.pendiente, d);
      e.pies.iniciado = true;
    }
    cad0 = c.cadera[0];
    cad1 = c.cadera[1];
    rod0 = c.rodilla[0];
    rod1 = c.rodilla[1];
    pelvisY = c.pelvisY;
    e.hombro[0] = c.hombro[0];
    e.hombro[1] = c.hombro[1];
    e.codo[0] = c.codo[0];
    e.codo[1] = c.codo[1];
    abd[0] = c.abduccion[0];
    abd[1] = c.abduccion[1];
    pelvisX = c.pelvisX;
    pelvisGiro = c.pelvisGiro;
    pelvisLadeo = c.pelvisLadeo;
    torsoGiro = c.torsoGiro;
    inclinacionCiclo = c.inclinacion;
    cabezaCicloPitch = c.cabezaPitch;
    cabezaCicloYaw = c.cabezaYaw;
    alturaSalto = l.salto.y;
    columnaX = 0;
  } else if (OPCIONES.marchaPorDistancia) {
    const z = calcularZancada(l.fase, v, e.zancada);
    cad0 = z.cadera[0];
    cad1 = z.cadera[1];
    rod0 = z.rodilla[0];
    rod1 = z.rodilla[1];
    pelvisY = z.pelvisY;
    e.hombro[0] = z.brazo[0];
    e.hombro[1] = z.brazo[1];
    e.codo[0] = 0.15 + 0.8 * Math.max(0, -z.brazo[0]);
    e.codo[1] = 0.15 + 0.8 * Math.max(0, -z.brazo[1]);
    columnaX = 0;
  } else {
    avanzarMarchaRemota(e.marcha, l.x, l.z, d);
    const m = e.marcha;
    const ep = e.entradaPose;
    ep.fase = m.fase;
    ep.postura = m.marcha > 0.03 ? 'caminando' : 'de_pie';
    ep.velocidad = m.marcha;
    ep.t = t;
    const pose = calcularPose(ep, e.pose);
    cad0 = pose.piernas[0].cadera;
    cad1 = pose.piernas[1].cadera;
    rod0 = pose.piernas[0].rodilla;
    rod1 = pose.piernas[1].rodilla;
    pelvisY = pose.pelvisY;
    e.hombro[0] = pose.brazos[0].hombro;
    e.hombro[1] = pose.brazos[1].hombro;
    e.codo[0] = pose.brazos[0].codo + pose.brazos[0].muneca;
    e.codo[1] = pose.brazos[1].codo + pose.brazos[1].muneca;
    abd[0] = pose.brazos[0].abduccion;
    abd[1] = pose.brazos[1].abduccion;
    columnaX = pose.columna;
  }

  // --- inclinación y alabeo del cuerpo ---
  let alabeo = 0;
  if (OPCIONES.resorteCritico) {
    if (OPCIONES.resorteRebase) {
      columnaX = l.inclinacion.x;
      alabeo = l.alabeo.x;
    } else {
      resorteCritico(
        e.inclinacionCritica,
        limitar(
          PL.inclinacionPorAceleracion * l.aceleracionLong + PL.inclinacionPorVelocidad * v,
          PL.inclinacionMax,
        ),
        0,
        P.mediaVidaInclinacion,
        d,
      );
      resorteCritico(e.alabeoCritico, alabeoDeseado(l, PL), 0, P.mediaVidaInclinacion, d);
      columnaX = e.inclinacionCritica.x;
      alabeo = e.alabeoCritico.x;
    }
  } else {
    columnaX = 0.06 * Math.min(1, v / VELOCIDAD_PASEO);
  }
  columnaX += inclinacionCiclo;

  // --- cabeza (la misma suma de ángulos: mirada + deriva de vida + resortes + gestos) ---
  let cabYaw = cabezaCicloYaw;
  let cabPitch = cabezaCicloPitch;
  let cabRoll = 0;
  const g = gestoPitchCabeza;
  g.pitch = 0;
  g.yaw = 0;
  g.roll = 0;
  g.columna = 0;

  if (OPCIONES.vida) {
    cabYaw += va.cabezaYaw * quietud;
    cabPitch += va.cabezaPitch * quietud;
    cabRoll += va.cabezaRoll * quietud;
    rod0 += va.rodillaIzq * quietud;
    rod1 += va.rodillaDer * quietud;
    if (va.gestoVariante >= 0) aplicarGesto(e, va.gestoVariante, va.gestoProgreso, t);
    cabYaw += g.yaw;
    cabPitch += g.pitch;
    cabRoll += g.roll;
    columnaX += g.columna;
  }
  if (OPCIONES.resorteRebase) {
    cabPitch += s.cabezaPitch.x;
    cabRoll += s.cabezaRoll.x;
    e.hombro[0] = (e.hombro[0] as number) + s.brazo[0].x;
    e.hombro[1] = (e.hombro[1] as number) + s.brazo[1].x;
    alabeo += s.torsoRoll.x;
  }
  if (OPCIONES.interes) {
    const peso = e.salidaInteres.peso;
    e.miradaYaw = suavizar(e.miradaYaw, e.objetivoYaw * peso, P.mediaVidaMirada, d);
    e.miradaPitch = suavizar(e.miradaPitch, e.objetivoPitch * peso, P.mediaVidaMirada, d);
    cabYaw += e.miradaYaw;
    cabPitch += e.miradaPitch;
  } else {
    e.miradaYaw = 0;
    e.miradaPitch = 0;
  }

  // --- escritura en el rig ---
  rig.raiz.rotation.y = l.rumbo;
  e.rumbo = l.rumbo;

  let descenso = 0;
  if (OPCIONES.aplastarEstirar) descenso = P.descensoPisada * Math.max(0, 1 - s.escalaY.x);
  rig.pelvis.position.y = P.alturaPelvis + pelvisY - descenso + alturaSalto;
  const ladeo = (OPCIONES.vida ? va.alabeoPelvis : 0) - pelvisLadeo;
  rig.pelvis.position.x = OPCIONES.vida ? -va.pesoCadera : 0;
  rig.pelvis.rotation.z = -ladeo;
  rig.pelvis.rotation.y = pelvisGiro;
  rig.columna.position.x = pelvisX;
  rig.columna.rotation.y = torsoGiro;

  for (let k = 0; k < 2; k++) {
    const pierna = rig.piernas[k as 0 | 1];
    pierna.cadera.rotation.x = k === 0 ? cad0 : cad1;
    pierna.cadera.rotation.z = ladeo; // contrarresta el ladeo de la pelvis: la pierna queda vertical
    pierna.cadera.rotation.y = -pelvisGiro; // y el giro: la pierna sigue en el plano de la marcha
    pierna.rodilla.rotation.x = k === 0 ? rod0 : rod1;
    const brazo = rig.brazos[k as 0 | 1];
    brazo.hombro.rotation.x = e.hombro[k] as number;
    brazo.hombro.rotation.z = (k === 0 ? -1 : 1) * (abd[k] as number);
    brazo.codo.rotation.x = -(e.codo[k] as number);
  }

  rig.columna.rotation.x = columnaX;
  // La columna devuelve la mitad del ladeo de la pelvis: el torso queda casi derecho.
  rig.columna.rotation.z =
    -(alabeo + (OPCIONES.vida ? va.alabeoColumna : 0)) + (conPoses ? 0.5 * ladeo : 0);
  rig.cabeza.rotation.y = cabYaw;
  // calcularMirada: pitch positivo = arriba; en three rotation.x positivo inclina hacia abajo.
  rig.cabeza.rotation.x = -cabPitch;
  rig.cabeza.rotation.z = -cabRoll;

  // Respiración (la de antes es un seno común; con vida, una por persona) por la escala del torso.
  const respiro = OPCIONES.vida ? 2 * va.respiracion - 1 : Math.sin(t * 1.7);
  const aplasta = OPCIONES.aplastarEstirar;
  rig.torso.scale.set(
    (aplasta ? s.escalaXZ : 1) * (1 + respiro * 0.008),
    (aplasta ? s.escalaY.x : 1) * (1 + respiro * 0.012),
    (aplasta ? s.escalaXZ : 1) * (1 + respiro * 0.012),
  );

  // Parpadeo: solo con vida (la cara cambia de celda; el estilo lo fija quien crea la persona).
  if (OPCIONES.vida && rig.cara && va.parpadeo !== e.parpadeando) {
    e.parpadeando = va.parpadeo;
    const celdas = celdasCara(rig.caraFija ?? e.estiloCara);
    rig.cara.celda = va.parpadeo ? celdas[1] : celdas[0];
  }

  if (rig.secundarios && rig.secundarios.length > 0) aplicarAccesorios(rig.secundarios, e, d);
}

/** Cada accesorio con inercia sigue con su propio resorte la aceleración y la velocidad del cuerpo. */
function aplicarAccesorios(grupos: readonly Group[], e: EstadoCuerpo, dt: number): void {
  const l = e.loc;
  while (e.accesorios.length < grupos.length) {
    e.accesorios.push(crearResorte());
    e.accesoriosLat.push(crearResorte());
  }
  if (!OPCIONES.resorteRebase) {
    for (let i = 0; i < grupos.length; i++) {
      const grupo = grupos[i] as Group;
      grupo.rotation.x = 0;
      grupo.rotation.z = 0;
    }
    return;
  }
  const objetivo = limitar(
    P.gananciaAccesorioAcel * l.aceleracionLong +
      P.gananciaAccesorioVel * Math.min(1, l.velocidad / VELOCIDAD_PASEO),
    P.limiteAccesorio,
  );
  const lateral = limitar(-P.gananciaAccesorioLat * l.aceleracionLat, P.limiteAccesorio);
  for (let i = 0; i < grupos.length; i++) {
    const grupo = grupos[i] as Group;
    const f = P.frecuenciaAccesorio * (1 + 0.15 * (i % 3));
    const rx = e.accesorios[i] as Resorte;
    const rz = e.accesoriosLat[i] as Resorte;
    resorteSub(rx, objetivo, f, P.amortiguacionAccesorio, dt);
    resorteSub(rz, lateral, f, P.amortiguacionAccesorio, dt);
    grupo.rotation.x = rx.x;
    grupo.rotation.z = -rz.x;
  }
}
