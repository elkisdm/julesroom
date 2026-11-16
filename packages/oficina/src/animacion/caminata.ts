/**
 * Caminata y carrera por poses (reemplaza a `zancada.ts` cuando `OPCIONES.caminataPoses` está
 * encendido). Un solo reloj de fase por DISTANCIA (los pies no patinan) mueve un ciclo con las
 * cuatro poses de la animación clásica: contacto, bajada, paso y subida (investigacion-caminata.md,
 * §1; Williams vía Cursa y Lague). Encima del ciclo de piernas:
 * - pelvis que baja en la bajada y sube en la subida (caminar) o baja a mitad del apoyo y sube en
 *   el vuelo (correr), gira en Y hacia la pierna que avanza, se ladea hacia el lado que vuela y se
 *   corre hacia la pierna de apoyo;
 * - torso que contragira, brazos opuestos a las piernas con codo y retraso, cabeza que compensa;
 * - pie con arco alto; el zapato va fijo a la pantorrilla, así que al contacto la pierna adelantada
 *   deja la punta arriba (talón) y al despegar la deja abajo (punta);
 * - correr: menos tiempo de apoyo (aparece el vuelo), pie más alto con el talón hacia atrás,
 *   inclinación, brazos doblados.
 * Caminar y correr no son dos animaciones que se mezclan: todos los parámetros se interpolan con la
 * velocidad, así que la pose es continua al pasar de una a otra (sin saltos).
 *
 * Convenios (los de `Pose`): cadera y rodilla giran en x; cadera negativa = pierna hacia delante;
 * rodilla ≥ 0 flexiona; hombro negativo = brazo hacia delante. La pierna 0 es la izquierda
 * (x = −0,135) y toca el suelo en la fase 0; la 1 en la fase 0,5.
 *
 * Por persona y por cuadro no asigna memoria: escribe en `SalidaCaminata`.
 */

/** Valores iniciales parametrizables (la página `apps/lab/caminata.html` los afina). */
export interface ParametrosCaminata {
  /** Largo del muslo y de la pantorrilla hasta la suela (m). */
  muslo: number;
  pantorrilla: number;
  /** Separación de las caderas respecto del centro (m). */
  separacionCadera: number;
  /** Velocidades (m/s) de caminar y de correr que usa el ciclo para elegir su forma. */
  velCaminar: number;
  velCorrer: number;
  /** Cadencia (ciclos de dos pasos por segundo) a `velCaminar` y a `velCorrer`. */
  cadenciaCaminar: number;
  cadenciaCorrer: number;
  /** Cadencia a velocidad ~0, como fracción de `cadenciaCaminar` (pasos cortos al ajustar). */
  cadenciaMinima: number;
  /** Fracción del ciclo que cada pie pasa apoyado al caminar y al correr (< 0,5 = hay vuelo). */
  apoyoCaminar: number;
  apoyoCorrer: number;
  /** Recorrido máximo del pie apoyado respecto de la cadera (m): por encima, se acorta el apoyo. */
  recorridoMaximo: number;
  /** Escala de velocidad (m/s) con que la amplitud sube de 0 a 1 (1 − exp(−v/escala)). */
  velocidadAmplitud: number;
  /** Altura del pie en el vuelo (m) al caminar y al correr. */
  alturaPieCaminar: number;
  alturaPieCorrer: number;
  /** Dónde está el punto más alto del arco del pie (0..1 del vuelo); < 0,5 = sube antes. */
  picoPieCaminar: number;
  picoPieCorrer: number;
  /** Cuánto se agacha la pelvis de base (fracción de la pierna). */
  agacheCaminar: number;
  agacheCorrer: number;
  /** Rebote de la pelvis (m, amplitud: pico a pico es el doble). */
  reboteCaminar: number;
  reboteCorrer: number;
  /** Giro de la pelvis en Y (rad) hacia la pierna que avanza. */
  giroPelvisCaminar: number;
  giroPelvisCorrer: number;
  /** Contragiro del torso (rad, respecto del mundo). */
  contragiroCaminar: number;
  contragiroCorrer: number;
  /** Ladeo de la pelvis (rad): baja el lado de la pierna que vuela. */
  ladeoPelvis: number;
  /** Desplazamiento lateral de la pelvis hacia la pierna de apoyo (m). */
  vaivenLateral: number;
  /** Inclinación del torso hacia delante (rad) al caminar y al correr. */
  inclinacionCaminar: number;
  inclinacionCorrer: number;
  /** Balanceo de brazos (rad, amplitud) y sesgo hacia delante (rad, negativo = adelante). */
  brazoCaminar: number;
  brazoCorrer: number;
  sesgoBrazoCorrer: number;
  /** Codo (rad) de base y extra cuando el brazo va adelante. */
  codoCaminar: number;
  codoCorrer: number;
  codoExtra: number;
  /** Separación de los brazos del cuerpo (rad). */
  abduccionCaminar: number;
  abduccionCorrer: number;
  /** Retraso del brazo y de la cabeza (fracción de ciclo). */
  retrasoBrazo: number;
  retrasoCabeza: number;
  /** Cabeceo de la cabeza (rad) que acompaña el rebote con retraso. */
  cabeceo: number;
  /** Cuánto compensa la cabeza el giro del torso (0..1). */
  estabilizarCabeza: number;
}

export const PARAMETROS_CAMINATA: ParametrosCaminata = {
  muslo: 0.32,
  pantorrilla: 0.3,
  separacionCadera: 0.135,
  velCaminar: 2.3,
  velCorrer: 4.8,
  cadenciaCaminar: 2.2,
  cadenciaCorrer: 2.7,
  cadenciaMinima: 0.6,
  apoyoCaminar: 0.55,
  apoyoCorrer: 0.36,
  recorridoMaximo: 0.52,
  velocidadAmplitud: 0.25,
  alturaPieCaminar: 0.11,
  alturaPieCorrer: 0.32,
  picoPieCaminar: 0.45,
  picoPieCorrer: 0.25,
  agacheCaminar: 0.02,
  agacheCorrer: 0.05,
  reboteCaminar: 0.022,
  reboteCorrer: 0.04,
  giroPelvisCaminar: 0.16,
  giroPelvisCorrer: 0.22,
  contragiroCaminar: 0.1,
  contragiroCorrer: 0.16,
  ladeoPelvis: 0.06,
  vaivenLateral: 0.018,
  inclinacionCaminar: 0.04,
  inclinacionCorrer: 0.14,
  brazoCaminar: 0.6,
  brazoCorrer: 0.9,
  sesgoBrazoCorrer: -0.12,
  codoCaminar: 0.25,
  codoCorrer: 1.5,
  codoExtra: 0.45,
  abduccionCaminar: 0.07,
  abduccionCorrer: 0.28,
  retrasoBrazo: 0.04,
  retrasoCabeza: 0.08,
  cabeceo: 0.05,
  estabilizarCabeza: 0.7,
};

export interface SalidaCaminata {
  /** Rotación en x de la cadera de cada pierna (negativa = hacia delante). */
  cadera: [number, number];
  /** Flexión de rodilla (≥ 0). */
  rodilla: [number, number];
  /** Desplazamiento vertical de la pelvis respecto de la altura de reposo (m). */
  pelvisY: number;
  /** Desplazamiento lateral del torso sobre la pierna de apoyo (m; se aplica a la columna, no a la
   * pelvis, para no arrastrar los pies). */
  pelvisX: number;
  /** Giro de la pelvis en Y (rad) y ladeo en Z (rad, positivo sube el lado +x). Quien lo aplica
   * gira cada cadera en −giro (orden YXZ) para que la pierna siga en el plano de la marcha. */
  pelvisGiro: number;
  pelvisLadeo: number;
  /** Giro del torso en Y (rad) RESPECTO DE LA PELVIS (ya descuenta el giro de la pelvis). */
  torsoGiro: number;
  /** Inclinación del torso hacia delante (rad), sin la de la aceleración. */
  inclinacion: number;
  /** Hombro (negativo = adelante), codo (≥ 0) y abducción de cada brazo. */
  hombro: [number, number];
  codo: [number, number];
  abduccion: [number, number];
  /** Cabeza respecto del torso (rad). */
  cabezaPitch: number;
  cabezaYaw: number;
  /** Altura de cada pie sobre el suelo (m) y si está apoyado, para huellas y pruebas. */
  alturaPie: [number, number];
  apoyado: [boolean, boolean];
  /** Posición del pie respecto de la proyección de la pelvis en el suelo, hacia delante (m). */
  pieAdelante: [number, number];
  /** Cuánto corre (0 = camina, 1 = corre). */
  carrera: number;
}

export const crearSalidaCaminata = (): SalidaCaminata => ({
  cadera: [0, 0],
  rodilla: [0, 0],
  pelvisY: 0,
  pelvisX: 0,
  pelvisGiro: 0,
  pelvisLadeo: 0,
  torsoGiro: 0,
  inclinacion: 0,
  hombro: [0, 0],
  codo: [0, 0],
  abduccion: [0, 0],
  cabezaPitch: 0,
  cabezaYaw: 0,
  alturaPie: [0, 0],
  apoyado: [true, true],
  pieAdelante: [0, 0],
  carrera: 0,
});

const DOS_PI = 2 * Math.PI;
/** Fracción de la pierna que se usa estirada en el apoyo; por encima, la rodilla se comprime suave. */
const ALCANCE_UTIL = 0.97;
const mezclar = (a: number, b: number, t: number) => a + (b - a) * t;
const suave = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Cuánto corre (0..1) a una velocidad: transición suave entre caminar y correr. */
export function factorCarrera(v: number, p: ParametrosCaminata = PARAMETROS_CAMINATA): number {
  const desde = p.velCaminar * 1.05;
  const hasta = p.velCaminar + 0.85 * (p.velCorrer - p.velCaminar);
  return suave((v - desde) / Math.max(1e-6, hasta - desde));
}

/** Cadencia (ciclos/s) a una velocidad: crece con ella, continua y monótona. */
export function cadencia(v: number, p: ParametrosCaminata = PARAMETROS_CAMINATA): number {
  const w = Math.max(0, v);
  if (w <= p.velCaminar) {
    const t = w / p.velCaminar;
    return p.cadenciaCaminar * (p.cadenciaMinima + (1 - p.cadenciaMinima) * t);
  }
  if (w <= p.velCorrer) {
    return mezclar(
      p.cadenciaCaminar,
      p.cadenciaCorrer,
      (w - p.velCaminar) / (p.velCorrer - p.velCaminar),
    );
  }
  return p.cadenciaCorrer * Math.sqrt(w / p.velCorrer);
}

/** Largo de zancada (m por ciclo de dos pasos): velocidad / cadencia. */
export function largoZancada(v: number, p: ParametrosCaminata = PARAMETROS_CAMINATA): number {
  return Math.max(0, v) / cadencia(v, p);
}

/** Avanza la fase por distancia: v·dt / zancada (= cadencia·dt). Con v ≈ 0 o dt ≤ 0 no cambia. */
export function avanzarFaseCaminata(
  fase: number,
  v: number,
  dt: number,
  p: ParametrosCaminata = PARAMETROS_CAMINATA,
): number {
  if (v <= 1e-4 || dt <= 0) return fase;
  const siguiente = fase + cadencia(v, p) * dt;
  return siguiente - Math.floor(siguiente);
}

/** Fracción de apoyo efectiva: la de caminar/correr, acortada si el pie tendría que recorrer más de la cuenta. */
export function fraccionApoyo(v: number, p: ParametrosCaminata = PARAMETROS_CAMINATA): number {
  const base = mezclar(p.apoyoCaminar, p.apoyoCorrer, factorCarrera(v, p));
  const zancada = largoZancada(v, p);
  if (zancada <= 1e-6) return base;
  return Math.max(0.2, Math.min(base, p.recorridoMaximo / zancada));
}

// Valores por cuadro (sin memoria por persona: la función es reentrante y síncrona).
const pie = { x: 0, y: 0, apoyado: true };

/** Posición del pie de una pierna con fase local `u` (0 = toca el suelo) respecto de su cadera. */
function posicionPie(
  u: number,
  recorrido: number,
  apoyo: number,
  altura: number,
  pico: number,
): void {
  if (u < apoyo) {
    pie.x = recorrido * (0.5 - u / apoyo);
    pie.y = 0;
    pie.apoyado = true;
    return;
  }
  const s = (u - apoyo) / (1 - apoyo);
  // Hermite con la misma velocidad que en el apoyo al despegar y al aterrizar: sin quiebre ni patinaje.
  const m = (1 - apoyo) / apoyo;
  const e = s * (s * (1 + m) * (3 - 2 * s) - m);
  pie.x = recorrido * (e - 0.5);
  // Arco con el pico desplazado: s' = s^k lleva el máximo de sin²(π·s') a s = pico.
  const k = Math.log(0.5) / Math.log(Math.min(0.95, Math.max(0.05, pico)));
  const sn = Math.sin(Math.PI * Math.pow(s, k));
  pie.y = altura * sn * sn;
  pie.apoyado = false;
}

/** Cinemática inversa de dos huesos en el plano sagital: pie a (fx, abajo dz) de la cadera. */
function resolverPierna(
  fx: number,
  dz: number,
  g: number,
  p: ParametrosCaminata,
  salida: SalidaCaminata,
  i: 0 | 1,
): void {
  const { muslo, pantorrilla } = p;
  const largo = muslo + pantorrilla;
  // Nunca del todo estirada: por encima del alcance útil se comprime con suavidad hasta el 99,5 %
  // (sin «salto de rodilla» al estirarse de golpe).
  // De pie (g = 0) la pierna sí queda recta: la compresión crece con la amplitud.
  const util = largo * (1 - (1 - ALCANCE_UTIL) * g);
  const holgura = largo * (1 - ALCANCE_UTIL - 0.005) * g;
  const r = Math.sqrt(fx * fx + dz * dz);
  if (r > util) {
    const k = holgura > 1e-6 ? (util + holgura * Math.tanh((r - util) / holgura)) / r : util / r;
    fx *= k;
    dz *= k;
  }
  const alcance2 = fx * fx + dz * dz;
  const cosRodilla =
    (alcance2 - muslo * muslo - pantorrilla * pantorrilla) / (2 * muslo * pantorrilla);
  const flexion = Math.acos(Math.max(-1, Math.min(1, cosRodilla)));
  const desvio = Math.atan2(
    pantorrilla * Math.sin(flexion),
    muslo + pantorrilla * Math.cos(flexion),
  );
  salida.cadera[i] = -(Math.atan2(fx, dz) + desvio);
  salida.rodilla[i] = flexion;
}

/**
 * Pose completa del ciclo para una fase (ciclos) y una velocidad (m/s). Escribe en `salida` y la
 * devuelve. A velocidad 0 da la pose de pie (todo en 0 salvo la altura de reposo).
 */
export function calcularCaminata(
  fase: number,
  velocidad: number,
  salida: SalidaCaminata,
  p: ParametrosCaminata = PARAMETROS_CAMINATA,
): SalidaCaminata {
  const v = Math.max(0, velocidad);
  const g = 1 - Math.exp(-v / p.velocidadAmplitud);
  const r = factorCarrera(v, p);
  const largo = p.muslo + p.pantorrilla;
  const util = largo * (1 - (1 - ALCANCE_UTIL) * g);
  const f = fase - Math.floor(fase);
  const paso = 2 * f - Math.floor(2 * f); // fase dentro del paso (0 = contacto)

  const apoyo = fraccionApoyo(v, p);
  const recorrido = apoyo * largoZancada(v, p);
  const alturaPie = g * g * mezclar(p.alturaPieCaminar, p.alturaPieCorrer, r);
  const pico = mezclar(p.picoPieCaminar, p.picoPieCorrer, r);

  // Pelvis: base a la que llega el pie en los extremos del apoyo, menos el agache; luego el rebote.
  const agache = largo * g * mezclar(p.agacheCaminar, p.agacheCorrer, r);
  const extremo = Math.sqrt(Math.max(0, util * util - 0.25 * recorrido * recorrido));
  const base = Math.min(util - agache, extremo + 0.5 * agache);
  const reboteCaminar = Math.cos(DOS_PI * (paso - 0.75)); // máximo en la subida, mínimo en la bajada
  const reboteCorrer = -Math.cos(DOS_PI * (paso - apoyo)); // mínimo a mitad del apoyo
  const rebote = g * mezclar(p.reboteCaminar * reboteCaminar, p.reboteCorrer * reboteCorrer, r);
  let h = base + rebote;

  // Giro de pelvis: la cadera de la pierna que avanza va adelante (máximo en su contacto).
  const giro = g * mezclar(p.giroPelvisCaminar, p.giroPelvisCorrer, r) * Math.cos(DOS_PI * f);
  const sinGiro = Math.sin(giro);

  // Pies: posición deseada respecto de la proyección de la pelvis; se descuenta lo que la cadera
  // avanza por el giro para que el pie apoyado no patine.
  const u1 = f + 0.5 >= 1 ? f - 0.5 : f + 0.5;
  posicionPie(f, recorrido, apoyo, alturaPie, pico);
  const x0 = pie.x;
  const y0 = pie.y;
  salida.apoyado[0] = pie.apoyado;
  posicionPie(u1, recorrido, apoyo, alturaPie, pico);
  const x1 = pie.x;
  const y1 = pie.y;
  salida.apoyado[1] = pie.apoyado;
  const adelanteCadera0 = p.separacionCadera * sinGiro; // cadera 0 (x < 0) avanza con giro > 0
  const adelanteCadera1 = -adelanteCadera0;
  // Ladeo: baja el lado de la pierna que vuela (con la 0 apoyada, f en [0, 0,5), baja el lado +x).
  // Cada cadera sube o baja con él: la pierna lo descuenta para que el pie apoyado no se hunda.
  const ladeo = -g * p.ladeoPelvis * Math.sin(DOS_PI * f) * (1 - 0.6 * r);
  const subeCadera1 = p.separacionCadera * Math.sin(ladeo);
  const subeCadera0 = -subeCadera1;

  // La pelvis no sube más de lo que alcanza cada pierna hasta su pie (apoyado o en el aire): así el
  // pie apoyado no se despega ni patina, y no hay salto de altura al despegar (allí y = 0).
  const dx0 = x0 - adelanteCadera0;
  const dx1 = x1 - adelanteCadera1;
  h = Math.min(
    h,
    y0 - subeCadera0 + Math.sqrt(Math.max(0, util * util - dx0 * dx0)),
    y1 - subeCadera1 + Math.sqrt(Math.max(0, util * util - dx1 * dx1)),
  );

  resolverPierna(x0 - adelanteCadera0, h + subeCadera0 - y0, g, p, salida, 0);
  resolverPierna(x1 - adelanteCadera1, h + subeCadera1 - y1, g, p, salida, 1);
  salida.alturaPie[0] = y0;
  salida.alturaPie[1] = y1;
  salida.pieAdelante[0] = x0;
  salida.pieAdelante[1] = x1;

  salida.pelvisY = h - largo;
  salida.pelvisGiro = giro;
  salida.pelvisLadeo = ladeo;
  salida.pelvisX = -g * p.vaivenLateral * Math.sin(DOS_PI * f) * (1 - 0.7 * r);
  const contragiro = g * mezclar(p.contragiroCaminar, p.contragiroCorrer, r) * Math.cos(DOS_PI * f);
  salida.torsoGiro = -contragiro - giro;
  salida.inclinacion = g * mezclar(p.inclinacionCaminar, p.inclinacionCorrer, r);

  // Brazos opuestos a las piernas, con retraso: el brazo 0 va atrás cuando la pierna 0 va adelante.
  const amplitudBrazo = g * mezclar(p.brazoCaminar, p.brazoCorrer, r);
  const sesgo = g * r * p.sesgoBrazoCorrer;
  const onda = Math.cos(DOS_PI * (f - p.retrasoBrazo));
  const codoBase = mezclar(p.codoCaminar, p.codoCorrer, g * r) * (0.4 + 0.6 * g);
  const abduccion = mezclar(p.abduccionCaminar, p.abduccionCorrer, r);
  for (let i = 0; i < 2; i++) {
    const h = (i === 0 ? 1 : -1) * amplitudBrazo * onda + sesgo;
    salida.hombro[i] = h;
    const adelante = amplitudBrazo > 1e-6 ? Math.max(0, -h) / amplitudBrazo : 0;
    salida.codo[i] = codoBase + g * p.codoExtra * adelante;
    salida.abduccion[i] = 0.05 + g * (abduccion - 0.05);
  }

  // Cabeza: cabeceo con retraso que acompaña el rebote y compensación del giro del torso.
  salida.cabezaPitch =
    -g * p.cabeceo * (1 - 0.5 * r) * Math.cos(DOS_PI * (paso - 0.75 - p.retrasoCabeza));
  salida.cabezaYaw = p.estabilizarCabeza * contragiro;
  salida.carrera = r;
  return salida;
}

/**
 * Sube o baja cada pie respecto de su altura en el ciclo (`e0`, `e1` en m, + sube): el terreno no es
 * plano (peldaños, tarimas). La pelvis sube `ePelvis` (por defecto la media de los pies) y nunca más de lo
 * que alcanza la pierna que queda más abajo; las dos piernas se resuelven de nuevo por cinemática inversa
 * hasta su pie. `salida.alturaPie` pasa a ser la altura de cada pie sobre la raíz (arco incluido).
 * Debe llamarse con la pose del ciclo ya calculada. In situ, sin memoria.
 */
export function elevarPies(
  salida: SalidaCaminata,
  e0: number,
  e1: number,
  velocidad: number,
  ePelvis: number = 0.5 * (e0 + e1),
  hPrevio: number = Number.NaN,
  k = 1,
  p: ParametrosCaminata = PARAMETROS_CAMINATA,
): void {
  const v = Math.max(0, velocidad);
  const g = 1 - Math.exp(-v / p.velocidadAmplitud);
  const largo = p.muslo + p.pantorrilla;
  const util = largo * (1 - (1 - ALCANCE_UTIL) * g);
  const sube1 = p.separacionCadera * Math.sin(salida.pelvisLadeo);
  const adelante0 = p.separacionCadera * Math.sin(salida.pelvisGiro);
  const dx0 = salida.pieAdelante[0] - adelante0;
  const dx1 = salida.pieAdelante[1] + adelante0;
  const y0 = salida.alturaPie[0];
  const y1 = salida.alturaPie[1];
  // Altura deseada de la pelvis; si hay una anterior (`hPrevio`, sobre la raíz) se acerca a ella con el
  // factor `k`: la pelvis sube y baja sin saltos cuando un pie se despega y libera el alcance de la pierna.
  const deseada = largo + salida.pelvisY + ePelvis;
  const h = Math.min(
    hPrevio === hPrevio ? hPrevio + (deseada - hPrevio) * k : deseada,
    y0 + e0 + sube1 + Math.sqrt(Math.max(0, util * util - dx0 * dx0)),
    y1 + e1 - sube1 + Math.sqrt(Math.max(0, util * util - dx1 * dx1)),
  );
  resolverPierna(dx0, h - sube1 - y0 - e0, g, p, salida, 0);
  resolverPierna(dx1, h + sube1 - y1 - e1, g, p, salida, 1);
  salida.alturaPie[0] = y0 + e0;
  salida.alturaPie[1] = y1 + e1;
  salida.pelvisY = h - largo;
}

/** Pose del salto encima del ciclo; valores iniciales parametrizables. */
export const PARAMETROS_POSE_SALTO = {
  /** Cuánto baja la pelvis en el impulso y en el aterrizaje más fuerte (m). */
  agacheImpulso: 0.1,
  agacheAterrizaje: 0.13,
  /** Rodilla que sube al despegar (m que se acerca el pie a la cadera) y pierna que queda atrás. */
  recogerDelantera: 0.26,
  recogerTrasera: 0.16,
  /** Apertura de piernas en el aire (m) en reposo y cuánto crece por m/s. */
  aperturaAire: 0.1,
  aperturaPorVelocidad: 0.03,
  /** Brazos al subir (adelante y arriba) y al caer (arriba y abiertos). */
  hombroSubida: -1.7,
  hombroCaida: -2.1,
  abduccionSubida: 0.45,
  abduccionCaida: 0.9,
  /** Brazos atrás en el impulso (rad). */
  hombroImpulso: 0.7,
  /** Inclinación del torso en el impulso y en el aterrizaje (rad). */
  inclinacionImpulso: 0.2,
};

/** Estado mínimo del salto que necesita la pose (lo cumple `Salto` de `salto.ts`). */
export interface EstadoPoseSalto {
  fase: 'suelo' | 'impulso' | 'aire' | 'aterrizaje';
  t: number;
  vy: number;
  impacto: number;
}

/**
 * Mezcla la pose del salto sobre la del ciclo ya calculada en `salida`. `impulso`, `aterrizaje`
 * (s) y `vDespegue` (m/s) vienen de los parámetros del salto. La altura del salto NO va aquí: la
 * suma quien coloca el cuerpo. In situ, sin memoria.
 */
export function mezclarPoseSalto(
  salida: SalidaCaminata,
  s: EstadoPoseSalto,
  v: number,
  impulso: number,
  aterrizaje: number,
  vDespegue: number,
  p: ParametrosCaminata = PARAMETROS_CAMINATA,
  q = PARAMETROS_POSE_SALTO,
): SalidaCaminata {
  if (s.fase === 'suelo') return salida;
  const largo = p.muslo + p.pantorrilla;
  if (s.fase === 'impulso' || s.fase === 'aterrizaje') {
    // Agache con los pies donde están: baja la pelvis y la cinemática inversa dobla las rodillas.
    const k =
      s.fase === 'impulso'
        ? suave(s.t / Math.max(1e-3, impulso))
        : 1 - suave(s.t / Math.max(1e-3, aterrizaje));
    const fuerza =
      s.fase === 'impulso' ? q.agacheImpulso : q.agacheAterrizaje * (0.4 + 0.6 * s.impacto);
    const baja = fuerza * k;
    const h = largo + salida.pelvisY - baja;
    for (let i = 0; i < 2; i++) {
      const adelante =
        salida.pieAdelante[i as 0 | 1] -
        (i === 0 ? 1 : -1) * p.separacionCadera * Math.sin(salida.pelvisGiro);
      resolverPierna(adelante, h - salida.alturaPie[i as 0 | 1], 1, p, salida, i as 0 | 1);
      const hombro = s.fase === 'impulso' ? q.hombroImpulso : 0.35;
      salida.hombro[i] = mezclar(salida.hombro[i] as number, hombro, k);
      salida.codo[i] = mezclar(salida.codo[i] as number, 0.5, k);
    }
    salida.pelvisY -= baja;
    salida.inclinacion += q.inclinacionImpulso * k;
    salida.cabezaPitch += 0.12 * k;
    return salida;
  }
  // Aire: de «subida» (rodilla arriba, brazos adelante) a «caída» (piernas abajo, brazos arriba).
  const caida = suave(0.5 - s.vy / (1.2 * Math.max(1e-3, vDespegue)));
  const entrada = suave(s.t / 0.08); // del despegue a la pose de aire en ~5 cuadros
  const apertura = q.aperturaAire + q.aperturaPorVelocidad * Math.max(0, v);
  const recogeD = mezclar(q.recogerDelantera, 0.05, caida);
  const recogeT = mezclar(q.recogerTrasera, 0.04, caida);
  const delantera = salida.cadera[0] <= salida.cadera[1] ? 0 : 1; // la que iba adelante sigue adelante
  for (let i = 0; i < 2; i++) {
    const esDelantera = i === delantera;
    const fx = (esDelantera ? 1 : -1) * apertura * (1 - 0.5 * caida);
    const dz = largo - (esDelantera ? recogeD : recogeT);
    const cadera = salida.cadera[i as 0 | 1];
    const rodilla = salida.rodilla[i as 0 | 1];
    resolverPierna(fx, dz, 1, p, salida, i as 0 | 1);
    salida.cadera[i] = mezclar(cadera, salida.cadera[i] as number, entrada);
    salida.rodilla[i] = mezclar(rodilla, salida.rodilla[i] as number, entrada);
    const hombro = mezclar(q.hombroSubida, q.hombroCaida, caida);
    salida.hombro[i] = mezclar(
      salida.hombro[i] as number,
      hombro + (i === 0 ? 0.15 : -0.15) * (1 - caida),
      entrada,
    );
    salida.codo[i] = mezclar(salida.codo[i] as number, mezclar(0.5, 0.25, caida), entrada);
    salida.abduccion[i] = mezclar(
      salida.abduccion[i] as number,
      mezclar(q.abduccionSubida, q.abduccionCaida, caida),
      entrada,
    );
  }
  salida.pelvisY = mezclar(salida.pelvisY, 0, entrada);
  salida.pelvisGiro *= 1 - entrada * 0.7;
  salida.torsoGiro *= 1 - entrada * 0.7;
  salida.inclinacion = mezclar(salida.inclinacion, mezclar(0.08, -0.05, caida), entrada);
  salida.cabezaPitch = mezclar(salida.cabezaPitch, mezclar(-0.1, 0.12, caida), entrada);
  salida.apoyado[0] = false;
  salida.apoyado[1] = false;
  return salida;
}
