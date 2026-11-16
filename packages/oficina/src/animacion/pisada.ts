/**
 * Pies en el terreno: escaleras (rectas y de caracol), tarimas y cualquier superficie con altura. Lógica
 * pura, sin three. Se monta sobre la caminata por poses (`caminata.ts`): el ciclo calcula dónde está cada
 * pie sobre un piso plano y aquí se le suma el relieve que hay bajo ese pie.
 *
 * - Pie en apoyo: se apoya a la altura de SU peldaño (`alturaPie` en su posición de mundo). El pie no se
 *   mueve respecto del suelo durante el apoyo, así que su peldaño es el mismo todo el apoyo.
 * - Pie en balanceo: parte del peldaño donde estaba y llega al peldaño donde va a caer (se predice con la
 *   velocidad, el giro y lo que falta de ciclo). Al subir se levanta primero y luego avanza; al bajar se
 *   mantiene arriba hasta pasar la arista. Además nunca baja de la cara que tiene debajo ni de la que
 *   tendrá 14 cm más adelante (despeje de la arista del peldaño siguiente); esa parte se suaviza con una
 *   rapidez máxima para que el pie no «salte» al cruzar la arista.
 * - Pelvis: sigue la altura media de los pies (`elevarPies`), recortada por el alcance de la pierna.
 * - Cuerpo inclinado hacia delante al subir y algo menos al bajar, según la pendiente bajo la persona.
 * - Ritmo: `topeVelocidadEscalera` da la velocidad máxima en pendiente (la cadencia sale de la velocidad).
 *
 * Por persona y por cuadro no asigna memoria: el estado vive en `EstadoPies`.
 */
import { alturaPie, SIN_SUELO } from '../escenarios/suelo';
import type { Suelo } from '../escenarios/suelo';
import { cadencia, elevarPies, fraccionApoyo, largoZancada, PARAMETROS_CAMINATA } from './caminata';
import type { SalidaCaminata } from './caminata';
import { suavizarExp } from './resorte';

/** Valores iniciales parametrizables. */
export const PARAMETROS_ESCALERA = {
  /** Pendiente (m de altura por m de avance) desde la que hay velocidad máxima y cuerpo inclinado. */
  pendienteMinima: 0.12,
  /** Velocidad máxima (m/s) caminando y corriendo al subir y al bajar. */
  velocidadSube: 1.2,
  velocidadBaja: 1.3,
  velocidadSubeCorriendo: 2.2,
  velocidadBajaCorriendo: 2.4,
  /** Inclinación del torso hacia delante (rad) a pendiente plena, al subir y al bajar. */
  inclinacionSube: 0.2,
  inclinacionBaja: 0.07,
  /** Pendiente a la que la inclinación llega a su valor pleno. */
  pendientePlena: 0.6,
  /** Distancia (m) hacia delante y hacia atrás a la que se mide la pendiente. */
  alcancePendiente: 0.4,
  /** Medias vidas (s) del suavizado de la pendiente y de la inclinación. */
  mediaVidaPendiente: 0.12,
  mediaVidaInclinacion: 0.1,
  /** Cuánto antes (m, hacia delante del pie) se mira la cara que viene, para despejar la arista. */
  anticipacionPie: 0.14,
  /** Fracción del balanceo desde la que la cara de llegada pasa de la prevista a la que hay bajo el pie. */
  inicioLlegada: 0.45,
  /** Media vida (s) con que la pelvis alcanza su altura deseada (sin saltos cuando un pie libera el alcance). */
  mediaVidaPelvis: 0.1,
  /** Cuánto pierde de peso, en la altura de la pelvis, el pie que se balancea (0 = cuenta igual, 1 = nada). */
  pesoBalanceo: 0.65,
  /** Cuánto (m) hacia atrás del pie se vigila también la arista (el pie real va desfasado unos cm del modelo). */
  margenAtras: 0.03,
  /** Rapidez máxima (m/s) con que el terreno bajo el pie en balanceo sube y baja (bajar es más rápido: caer sobre el peldaño). */
  rapidezSube: 3.5,
  rapidezBaja: 5,
  /** Separación (m) de los puntos con que se promedia la cara prevista de llegada. */
  pasoPrediccion: 0.06,
  /** Rapidez (m/s) con que el pie recién posado se acomoda a su cara. */
  rapidezAcomodo: 5,
  /** Cuadros tras posarse en que el pie se acomoda a su cara con rapidez limitada (si cayó sobre una arista). */
  cuadrosAcomodo: 3,
  /** Fracción del balanceo en que el pie empieza a bajar al peldaño de abajo (bajando, sale de arriba y cae después de la arista). */
  inicioBajada: 0.15,
  /** Fracción del balanceo en que el pie termina de subir al peldaño de llegada (subiendo)… */
  subidaBalanceo: 0.45,
  /** …y despeje extra (m) en el balanceo entre dos caras distintas. */
  despejeExtra: 0.04,
  /** Desnivel (m) a partir del cual el despeje extra llega a su valor pleno. */
  desnivelDespeje: 0.1,
  /** Bajo esta diferencia (m) del pie con el piso de la raíz no se toca la pose del ciclo. */
  tolerancia: 1e-3,
};

const P = PARAMETROS_ESCALERA;

export interface EstadoPies {
  /** Hay datos del cuadro anterior. */
  iniciado: boolean;
  /** Altura de mundo (m) del terreno que lleva cada pie (sin el arco del ciclo). */
  terreno: [number, number];
  /** Cuadros que lleva cada pie en apoyo (0 mientras se balancea). */
  cuadrosApoyo: [number, number];
  /** Cara donde se apoyó cada pie por última vez: de ahí despega. */
  apoyo: [number, number];
  /** Altura de mundo de la pelvis (m) el cuadro anterior: de ahí sube y baja suave. */
  pelvis: number;
  /** Pendiente suavizada bajo la persona e inclinación del torso aplicada (rad). */
  pendiente: number;
  inclinacion: number;
}

export const crearEstadoPies = (): EstadoPies => ({
  iniciado: false,
  terreno: [0, 0],
  cuadrosApoyo: [0, 0],
  apoyo: [0, 0],
  pelvis: 0,
  pendiente: 0,
  inclinacion: 0,
});

const suave = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Altura de la cara bajo (x, z) para un cuerpo con la raíz en `y`; `y` mismo si no hay suelo ahí. */
function caraEn(suelo: Suelo, x: number, z: number, y: number): number {
  const h = alturaPie(suelo, x, z, y);
  return h === SIN_SUELO ? y : h;
}

/**
 * Pendiente del suelo bajo una persona que mira a `rumbo` (m de altura por m de avance, + sube): la
 * diferencia de cara entre un punto delante y uno detrás. Sirve de velocidad máxima y de inclinación.
 * No asigna.
 */
export function pendienteSuelo(
  suelo: Suelo,
  x: number,
  z: number,
  rumbo: number,
  y: number,
): number {
  const a = P.alcancePendiente;
  const sx = Math.sin(rumbo) * a;
  const cz = Math.cos(rumbo) * a;
  const delante = alturaPie(suelo, x + sx, z + cz, y);
  const detras = alturaPie(suelo, x - sx, z - cz, y);
  if (delante === SIN_SUELO || detras === SIN_SUELO) return 0;
  return (delante - detras) / (2 * a);
}

/** Velocidad máxima (m/s) con esa pendiente: sin tope (`Infinity`) en llano. */
export function topeVelocidadEscalera(pendiente: number, corriendo: boolean): number {
  if (Math.abs(pendiente) < P.pendienteMinima) return Number.POSITIVE_INFINITY;
  if (pendiente > 0) return corriendo ? P.velocidadSubeCorriendo : P.velocidadSube;
  return corriendo ? P.velocidadBajaCorriendo : P.velocidadBaja;
}

/**
 * Inclina el torso (suma a `c.inclinacion`) según una pendiente ya conocida: hacia delante al subir, algo
 * menos al bajar. Suaviza la pendiente y la inclinación en `e`.
 */
export function inclinarEnPendiente(
  e: EstadoPies,
  c: SalidaCaminata,
  pendiente: number,
  dt: number,
): void {
  e.pendiente = e.iniciado
    ? suavizarExp(e.pendiente, pendiente, P.mediaVidaPendiente, dt)
    : pendiente;
  const k = Math.min(1, Math.abs(e.pendiente) / P.pendientePlena);
  const objetivo = k * (e.pendiente > 0 ? P.inclinacionSube : P.inclinacionBaja);
  e.inclinacion = e.iniciado
    ? suavizarExp(e.inclinacion, objetivo, P.mediaVidaInclinacion, dt)
    : objetivo;
  c.inclinacion += e.inclinacion;
}

/**
 * Pasa la pose de caminata (`calcularCaminata`, ya con `mezclarPoseSalto` si hay) de piso plano al
 * relieve: cada pie a la altura de su cara, la pelvis a la media y el torso inclinado en la pendiente.
 * `ySuelo` es la altura de la raíz del rig; `fase` y `velocidad` los de esa pose; `giro` (rad/s) sirve
 * para predecir dónde cae el pie que se balancea. `pendiente` es la que ya se conoce (p. ej. de la
 * velocidad vertical de una persona remota); NaN la mide del suelo. Escribe en `c`. No asigna.
 */
export function ajustarAlTerreno(
  e: EstadoPies,
  suelo: Suelo,
  c: SalidaCaminata,
  x: number,
  z: number,
  rumbo: number,
  giro: number,
  ySuelo: number,
  velocidad: number,
  fase: number,
  dt: number,
  pendiente = Number.NaN,
): void {
  const medida = pendiente === pendiente ? pendiente : pendienteSuelo(suelo, x, z, rumbo, ySuelo);
  const sr = Math.sin(rumbo);
  const cr = Math.cos(rumbo);
  const sep = PARAMETROS_CAMINATA.separacionCadera;
  const v = Math.max(0, velocidad);
  const apoyoFrac = fraccionApoyo(v);
  const recorrido = apoyoFrac * largoZancada(v);
  const cad = cadencia(v);
  const f = fase - Math.floor(fase);
  const arranque = !e.iniciado;
  let e0 = 0;
  let e1 = 0;
  let peso0 = 1;
  let peso1 = 1;

  for (let i = 0; i < 2; i++) {
    const lat = i === 0 ? -sep : sep;
    const adelante = c.pieAdelante[i as 0 | 1];
    // Posición de mundo del pie (la raíz mira a `rumbo`; +x local es (cos, −sin)).
    const px = x + sr * adelante + cr * lat;
    const pz = z + cr * adelante - sr * lat;
    const aqui = caraEn(suelo, px, pz, ySuelo);
    let terreno: number;
    let peso = 1;
    if (c.apoyado[i as 0 | 1]) {
      // El pie en apoyo está quieto en el mundo: su cara es la misma todo el apoyo. Solo al posarse sobre una
      // arista la cara puede cambiar de un cuadro al otro: ahí el pie se acomoda en pocos cuadros, no de golpe.
      const n = e.cuadrosApoyo[i as 0 | 1];
      if (arranque || n >= P.cuadrosAcomodo) {
        terreno = aqui;
      } else {
        const previo = e.terreno[i as 0 | 1];
        terreno =
          previo + Math.max(-P.rapidezAcomodo * dt, Math.min(P.rapidezAcomodo * dt, aqui - previo));
      }
      e.cuadrosApoyo[i as 0 | 1] = n + 1;
      e.apoyo[i as 0 | 1] = aqui;
    } else {
      e.cuadrosApoyo[i as 0 | 1] = 0;
      const u = i === 0 ? f : f + 0.5 >= 1 ? f - 0.5 : f + 0.5;
      const s = Math.min(1, Math.max(0, (u - apoyoFrac) / (1 - apoyoFrac)));
      // Dónde cae el pie: a medio recorrido por delante de donde estará la pelvis al terminar el paso.
      const restante = (1 - u) / cad;
      const distancia = 0.5 * recorrido + v * restante;
      const rumboCaida = rumbo + 0.5 * giro * restante;
      const cx = x + Math.sin(rumboCaida) * distancia + cr * lat;
      const cz = z + Math.cos(rumboCaida) * distancia - sr * lat;
      const salida = arranque ? aqui : e.apoyo[i as 0 | 1];
      // La cara de llegada es una predicción: cerca del final del balanceo se cambia por la que de verdad
      // hay bajo el pie, así al apoyarse no hay un salto de un peldaño.
      const pesoLlegada = suave((s - P.inicioLlegada) / (1 - P.inicioLlegada));
      // Promedio de cinco puntos alrededor de lo previsto: la cara prevista cambia de a poco y no de a un
      // peldaño cuando la predicción cruza una arista.
      let prevista = 0;
      let debajo = 0;
      for (let q = -2; q <= 2; q++) {
        const paso = q * P.pasoPrediccion;
        prevista += caraEn(suelo, cx + sr * paso, cz + cr * paso, ySuelo);
        debajo += caraEn(suelo, px + sr * paso, pz + cr * paso, ySuelo);
      }
      prevista /= 5;
      // Lo que hay bajo el pie, también promediado hasta el último momento (cruzar una arista no lo salta).
      debajo /= 5;
      const exacta = suave((s - 0.8) / 0.2);
      const llegada = prevista + (debajo + (aqui - debajo) * exacta - prevista) * pesoLlegada;
      const d = llegada - salida;
      const subida = suave(s / P.subidaBalanceo);
      const bajada = suave((s - P.inicioBajada) / (0.8 - P.inicioBajada));
      const seno = Math.sin(Math.PI * s);
      const despeje = P.despejeExtra * Math.min(1, Math.abs(d) / P.desnivelDespeje) * seno * seno;
      const arco = c.alturaPie[i as 0 | 1];
      // El pie que va a posarse ya no avanza: la anticipación se apaga al final del balanceo.
      const alcance =
        P.anticipacionPie * (1 - suave((s - P.inicioLlegada) / (1 - P.inicioLlegada)));
      const adelantePie = caraEn(suelo, px + sr * alcance, pz + cr * alcance, ySuelo);
      // También lo que hay un poco detrás: el pie real va unos cm desfasado del modelo y roza la arista que acaba de pasar.
      const atrasPie = caraEn(suelo, px - sr * P.margenAtras, pz - cr * P.margenAtras, ySuelo);
      const libre = Math.max(aqui, adelantePie, atrasPie) - arco;
      const meta = Math.max(
        salida + Math.max(d, 0) * subida + Math.min(d, 0) * bajada + despeje,
        libre,
      );
      // La pelvis sigue sobre todo al pie de apoyo: el que se balancea cuenta poco hasta que se posa.
      peso = 1 - P.pesoBalanceo * suave(s / 0.3) + P.pesoBalanceo * suave((s - 0.55) / 0.45);
      const previo = arranque ? meta : e.terreno[i as 0 | 1];
      terreno = previo + Math.max(-P.rapidezBaja * dt, Math.min(P.rapidezSube * dt, meta - previo));
      // Nunca bajo la cara que tiene debajo: el pie no atraviesa la arista.
      if (terreno + arco < aqui) terreno = aqui - arco;
    }
    e.terreno[i as 0 | 1] = terreno;
    const delta = terreno - ySuelo;
    if (i === 0) {
      e0 = delta;
      peso0 = peso;
    } else {
      e1 = delta;
      peso1 = peso;
    }
  }

  if (Math.abs(e0) + Math.abs(e1) > P.tolerancia) {
    const k = 1 - Math.exp((-Math.LN2 * dt) / (P.mediaVidaPelvis + 1e-9));
    const previo = arranque ? Number.NaN : e.pelvis - ySuelo;
    elevarPies(c, e0, e1, v, (peso0 * e0 + peso1 * e1) / (peso0 + peso1), previo, k);
  }
  e.pelvis = ySuelo + PARAMETROS_CAMINATA.muslo + PARAMETROS_CAMINATA.pantorrilla + c.pelvisY;
  inclinarEnPendiente(e, c, medida, dt);
  e.iniciado = true;
}
