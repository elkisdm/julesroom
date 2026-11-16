/**
 * Nivel de detalle de animación por persona: cada cuántos cuadros se actualiza su esqueleto.
 *
 * Fuentes (investigacion-videojuegos.md, A7):
 * - Unreal Animation Budget Allocator y URO (Update Rate Optimization): el intervalo de
 *   actualización sube con la distancia y cuando el costo de animación supera el presupuesto de
 *   ms por cuadro; se recupera con holgura (histéresis 0,25) para no oscilar.
 * - Unity Culling Mode: lo que está fuera de pantalla no se anima (aquí queda pausado, con un
 *   tope de actualizaciones por cuadro para que no se congele del todo).
 * - Histéresis de ~30 cuadros y ±10 % del umbral para que nadie parpadee entre niveles.
 *
 * Uso por cuadro: `iniciarCuadroLod(estado, dt)` una vez y luego `decidirLod` por persona.
 * Quien actualiza este cuadro lo decide `(cuadro + indice) % intervalo === 0`, escalonado por
 * índice para que no actualicen todos juntos. `salida.dt` es el tiempo acumulado desde su última
 * actualización real (tras una pausa larga puede ser grande: el llamador integra o recorta).
 *
 * REGLA DE ORO: `iniciarCuadroLod`, `decidirLod` y `registrarCuadro` no asignan memoria.
 */

export interface EntradaLod {
  /** Distancia (m) a la cámara. */
  distancia: number;
  enPantalla: boolean;
  seleccionado: boolean;
  habla: boolean;
}

export interface PlanLod {
  /** Cada cuántos cuadros se actualiza (1 = cada cuadro). */
  intervalo: number;
  /** Fuera de pantalla y sin turno este cuadro: no se anima. */
  pausada: boolean;
  /** Si hay que actualizar su animación este cuadro. */
  actualizar: boolean;
  /** Tiempo (s) acumulado desde su última actualización real, para integrar de una vez. */
  dt: number;
}

export interface ParametrosLod {
  /** Umbrales de distancia (m), crecientes: hay uno menos que `intervalos`. */
  distancias: readonly number[];
  /** Intervalo (cuadros) de cada nivel: del más cercano al más lejano. */
  intervalos: readonly number[];
  /** Tope de personas fuera de pantalla que se actualizan por cuadro. */
  maxFueraDePantalla: number;
  /** Cuadros que espera una persona fuera de pantalla entre una actualización y la siguiente. */
  intervaloFueraDePantalla: number;
  /** Cuadros mínimos en un nivel antes de poder cambiar. */
  cuadrosMinimos: number;
  /** Fracción del umbral que hay que sobrepasar (o bajar) para cambiar de nivel. */
  histeresisDistancia: number;
}

export const PARAMETROS_LOD: ParametrosLod = {
  distancias: [14, 30, 55],
  intervalos: [1, 2, 3, 4],
  maxFueraDePantalla: 4,
  intervaloFueraDePantalla: 8,
  cuadrosMinimos: 30,
  histeresisDistancia: 0.1,
};

export interface ParametrosPresupuesto {
  /** Fracción bajo el presupuesto que hay que tener para bajar la escala (Unreal: 0,25). */
  histeresis: number;
  /** Peso del promedio móvil exponencial del costo por cuadro. */
  suavizado: number;
  /** Cuadros mínimos entre dos cambios de escala. */
  cuadrosEntreCambios: number;
  /** Niveles máximos que se pueden subir los intervalos. */
  escalaMax: number;
}

export const PARAMETROS_PRESUPUESTO: ParametrosPresupuesto = {
  histeresis: 0.25,
  suavizado: 0.1,
  cuadrosEntreCambios: 30,
  escalaMax: 3,
};

export interface Presupuesto {
  /** Presupuesto de animación (ms por cuadro). */
  ms: number;
  parametros: ParametrosPresupuesto;
  /** Promedio móvil del costo (ms); NaN antes del primer cuadro. */
  media: number;
  /** Niveles que se suben los intervalos (0 = sin recorte). */
  escala: number;
  cuadrosDesdeCambio: number;
}

export interface EstadoLod {
  parametros: ParametrosLod;
  presupuesto: Presupuesto | null;
  capacidad: number;
  /** Nivel de distancia vigente de cada persona. */
  nivel: Uint8Array;
  /** Cuadro en que cada una entró a su nivel actual. */
  desde: Int32Array;
  ultimoCuadro: Int32Array;
  /** Valor de `reloj` en su última actualización real. */
  ultimoReloj: Float64Array;
  visto: Uint8Array;
  /** Suma de los dt de los cuadros: el tiempo acumulado de cada una es `reloj - ultimoReloj`. */
  reloj: number;
  dtCuadro: number;
  cuotaFuera: number;
}

export function crearLod(
  parametros: ParametrosLod = PARAMETROS_LOD,
  capacidad = 128,
  presupuesto: Presupuesto | null = null,
): EstadoLod {
  return {
    parametros,
    presupuesto,
    capacidad,
    nivel: new Uint8Array(capacidad),
    desde: new Int32Array(capacidad),
    ultimoCuadro: new Int32Array(capacidad),
    ultimoReloj: new Float64Array(capacidad),
    visto: new Uint8Array(capacidad),
    reloj: 0,
    dtCuadro: 0,
    cuotaFuera: 0,
  };
}

/** Abre un cuadro: avanza el reloj y reinicia el tope de actualizaciones fuera de pantalla. */
export function iniciarCuadroLod(e: EstadoLod, dt: number): void {
  const d = dt > 0 ? dt : 0;
  e.reloj += d;
  e.dtCuadro = d;
  e.cuotaFuera = 0;
}

/** Nivel de `distancia` sin histéresis: cuántos umbrales supera. */
function nivelPorDistancia(umbrales: readonly number[], distancia: number): number {
  let n = 0;
  while (n < umbrales.length && distancia > (umbrales[n] as number)) n++;
  return n;
}

function intervaloDe(p: ParametrosLod, indice: number): number {
  const ultimo = p.intervalos.length - 1;
  const base = p.intervalos[indice < ultimo ? indice : ultimo] as number;
  const extra = indice > ultimo ? indice - ultimo : 0;
  const i = Math.round(base) + extra;
  return i < 1 ? 1 : i;
}

export function decidirLod(
  e: EstadoLod,
  indice: number,
  entrada: EntradaLod,
  cuadro: number,
  salida: PlanLod,
): void {
  const p = e.parametros;
  if (indice < 0 || indice >= e.capacidad) {
    salida.intervalo = 1;
    salida.pausada = false;
    salida.actualizar = true;
    salida.dt = e.dtCuadro;
    return;
  }

  if (e.visto[indice] === 0) {
    e.visto[indice] = 1;
    e.nivel[indice] = nivelPorDistancia(p.distancias, entrada.distancia);
    e.desde[indice] = cuadro;
    e.ultimoReloj[indice] = e.reloj - e.dtCuadro;
    // Fuera de pantalla, la primera vez le toca de inmediato.
    e.ultimoCuadro[indice] = cuadro - p.intervaloFueraDePantalla;
  }

  // Nivel con histéresis: espera `cuadrosMinimos` y exige pasar el umbral por ±histeresis.
  let nivel = e.nivel[indice] as number;
  if (cuadro - (e.desde[indice] as number) >= p.cuadrosMinimos) {
    const d = entrada.distancia;
    const h = p.histeresisDistancia;
    const previo = nivel;
    while (nivel < p.distancias.length && d > (p.distancias[nivel] as number) * (1 + h)) nivel++;
    while (nivel > 0 && d < (p.distancias[nivel - 1] as number) * (1 - h)) nivel--;
    if (nivel !== previo) {
      e.nivel[indice] = nivel;
      e.desde[indice] = cuadro;
    }
  }

  let actualizar: boolean;
  let intervalo: number;
  let pausada = false;
  if (entrada.seleccionado || entrada.habla) {
    intervalo = 1;
    actualizar = true;
  } else if (!entrada.enPantalla) {
    intervalo = p.intervaloFueraDePantalla;
    actualizar =
      cuadro - (e.ultimoCuadro[indice] as number) >= intervalo &&
      e.cuotaFuera < p.maxFueraDePantalla;
    if (actualizar) e.cuotaFuera++;
    else pausada = true;
  } else {
    const escala = e.presupuesto ? e.presupuesto.escala : 0;
    intervalo = intervaloDe(p, nivel + escala);
    actualizar = (((cuadro + indice) % intervalo) + intervalo) % intervalo === 0;
  }

  salida.intervalo = intervalo;
  salida.pausada = pausada;
  salida.actualizar = actualizar;
  salida.dt = e.reloj - (e.ultimoReloj[indice] as number);
  if (actualizar) {
    e.ultimoReloj[indice] = e.reloj;
    e.ultimoCuadro[indice] = cuadro;
  }
}

export function crearPresupuesto(
  ms: number,
  parametros: ParametrosPresupuesto = PARAMETROS_PRESUPUESTO,
): Presupuesto {
  return { ms, parametros, media: Number.NaN, escala: 0, cuadrosDesdeCambio: 0 };
}

/**
 * Anota el costo (ms) de animación del cuadro. Si el promedio móvil supera el presupuesto sube la
 * escala (los intervalos suben 1 nivel); si queda bajo `ms × (1 − histeresis)` la baja. Entre
 * dos cambios esperan `cuadrosEntreCambios` cuadros.
 */
export function registrarCuadro(pres: Presupuesto, msAnimacion: number): void {
  if (!Number.isFinite(msAnimacion)) return;
  const pa = pres.parametros;
  pres.media =
    pres.media === pres.media
      ? pres.media + pa.suavizado * (msAnimacion - pres.media)
      : msAnimacion;
  pres.cuadrosDesdeCambio++;
  if (pres.cuadrosDesdeCambio < pa.cuadrosEntreCambios) return;
  if (pres.media > pres.ms && pres.escala < pa.escalaMax) {
    pres.escala++;
    pres.cuadrosDesdeCambio = 0;
  } else if (pres.media < pres.ms * (1 - pa.histeresis) && pres.escala > 0) {
    pres.escala--;
    pres.cuadrosDesdeCambio = 0;
  }
}
