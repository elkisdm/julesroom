/**
 * Transiciones y reacciones cortas: curvas puras para sentarse, levantarse, gestos con
 * anticipación y rebase, y una máquina mínima de reacciones (saludo y giro de cabeza).
 *
 * Fuente: investigación del equipo sobre técnicas de videojuegos,
 * A3 (anticipación de 1–2 cuadros, rebase al frenar y rebote al asentarse; Jonasson y Purho,
 * GDC 2012, solo la existencia de la charla está verificada) y A4 (reacciones como pulsos
 * suaves sobre un brazo: criterio de animación, sin cita). Las duraciones y amplitudes son
 * valores iniciales a calibrar a ojo.
 *
 * Regla de oro: todo corre por persona y por cuadro y NO asigna memoria; escribe en `salida`.
 */

const limitar01 = (x: number) => (x > 0 ? (x < 1 ? x : 1) : 0);

/** Smootherstep de 0 a 1 (pendiente y curvatura nulas en los extremos); acota fuera de rango. */
export function suavizarPaso(x: number): number {
  const u = limitar01(x);
  const y = u * u * u * (u * (u * 6 - 15) + 10);
  return y < 1 ? y : 1; // el redondeo puede pasarse de 1 por un epsilon
}

/**
 * Mueve `w.valor` hacia `objetivo` a lo sumo `1/duracion` por segundo: un cambio completo de
 * 0 a 1 tarda al menos `duracion`. Con `duracion` ≤ 0 salta. Aplica `suavizarPaso` a la
 * salida si se quiere curva.
 */
export function avanzarPeso(
  w: { valor: number },
  objetivo: number,
  dt: number,
  duracion: number,
): void {
  if (duracion <= 0) {
    w.valor = objetivo;
    return;
  }
  const paso = (dt > 0 ? dt : 0) / duracion;
  const falta = objetivo - w.valor;
  w.valor += falta > paso ? paso : falta < -paso ? -paso : falta;
}

export interface SalidaSentarse {
  /** 0 = de pie, 1 = sentado (con un pequeño rebote antes de quedar en 1). */
  altura: number;
  /** Inclinación del torso hacia delante (rad): 0 → pico → 0. */
  inclinacionTorso: number;
  /** 0..1: cuánto retrocede la pelvis hacia el respaldo. */
  pelvisAtras: number;
  /** Pulso 0..1 al apoyarse en el asiento. */
  impacto: number;
}

export function crearSalidaSentarse(): SalidaSentarse {
  return { altura: 0, inclinacionTorso: 0, pelvisAtras: 0, impacto: 0 };
}

const INCLINACION_MAX = 0.35;
const REBOTE = 0.04;

/** Altura de sentado a lo largo del progreso: baja entre 0,15 y 0,75 y rebota hasta 1. */
function alturaSentado(p: number): number {
  if (p < 0.75) return suavizarPaso((p - 0.15) / 0.6);
  const u = (p - 0.75) / 0.25;
  return 1 - REBOTE * Math.sin(Math.PI * u) * (1 - u);
}

const pelvisSentado = (p: number) => suavizarPaso((p - 0.1) / 0.65);

/**
 * Sentarse con anticipación: el torso se inclina hacia delante, baja, se asienta con un
 * pequeño rebote y el impacto llega cuando la altura ya es ≈ 1. `progreso` 0..1.
 */
export function curvaSentarse(progreso: number, salida: SalidaSentarse): void {
  const p = limitar01(progreso);
  salida.altura = alturaSentado(p);
  salida.inclinacionTorso = p < 0.8 ? INCLINACION_MAX * Math.sin((Math.PI * p) / 0.8) : 0;
  salida.pelvisAtras = pelvisSentado(p);
  if (p > 0.75 && p < 0.85) {
    const s = Math.sin((Math.PI * (p - 0.75)) / 0.1);
    salida.impacto = s * s;
  } else {
    salida.impacto = 0;
  }
}

/**
 * Inversa de `curvaSentarse`: el torso se inclina primero, la altura sube de 1 a 0 y la
 * pelvis avanza. No hay impacto. `progreso` 0..1.
 */
export function curvaLevantarse(progreso: number, salida: SalidaSentarse): void {
  const p = limitar01(progreso);
  salida.altura = alturaSentado(1 - p);
  salida.inclinacionTorso = p < 0.7 ? INCLINACION_MAX * Math.sin((Math.PI * p) / 0.7) : 0;
  salida.pelvisAtras = pelvisSentado(1 - p);
  salida.impacto = 0;
}

export interface SalidaEnvolvente {
  /** Pulso 0..1 de contramovimiento breve antes de subir (se resta del gesto). */
  anticipacion: number;
  /** 0..1: sube rápido, se mantiene y suelta con ease. */
  pico: number;
  /** 0..~0,1: rebase leve que se suma al pico justo después de subir. */
  rebase: number;
}

export function crearSalidaEnvolvente(): SalidaEnvolvente {
  return { anticipacion: 0, pico: 0, rebase: 0 };
}

const REBASE_MAX = 0.1;

/**
 * Envolvente de un gesto (saludo, asentir, señalar) en `duracion` segundos: anticipación
 * breve (0–12 %), subida rápida (10–30 %), mantiene hasta el 75 % con un rebase leve al
 * llegar, y suelta con ease. Vale 0 en `t` ≤ 0 y en `t` ≥ `duracion`. Valor del gesto:
 * `pico + rebase - k·anticipacion`.
 */
export function envolventeGesto(t: number, duracion: number, salida: SalidaEnvolvente): void {
  const u = duracion > 0 ? t / duracion : 1;
  if (!(u > 0) || u >= 1) {
    salida.anticipacion = 0;
    salida.pico = 0;
    salida.rebase = 0;
    return;
  }
  salida.anticipacion = u < 0.12 ? Math.sin((Math.PI * u) / 0.12) : 0;
  salida.pico =
    u < 0.3 ? suavizarPaso((u - 0.1) / 0.2) : u < 0.75 ? 1 : 1 - suavizarPaso((u - 0.75) / 0.25);
  salida.rebase = u > 0.3 && u < 0.45 ? REBASE_MAX * Math.sin((Math.PI * (u - 0.3)) / 0.15) : 0;
}

export interface SalidaReaccion {
  /** 0..1: cuánto levanta el brazo para saludar. */
  brazoSaludo: number;
  /** 0..1: cabeceo de asentir que acompaña al saludo. */
  cabezaAsentir: number;
  /** Giro de la cabeza (rad) hacia quien le habla; 0 en reposo. */
  giroCabeza: number;
}

export function crearSalidaReaccion(): SalidaReaccion {
  return { brazoSaludo: 0, cabezaAsentir: 0, giroCabeza: 0 };
}

export interface Reaccion {
  saludoInicio: number;
  saludoIntensidad: number;
  giroInicio: number;
  giroYaw: number;
  /** Espacio de trabajo reutilizado por `avanzarReaccion`. */
  env: SalidaEnvolvente;
}

const DURACION_SALUDO = 1.6;
const DURACION_GIRO = 1.4;

export function crearReaccion(): Reaccion {
  return {
    saludoInicio: -1,
    saludoIntensidad: 0,
    giroInicio: -1,
    giroYaw: 0,
    env: crearSalidaEnvolvente(),
  };
}

/** Empieza un saludo en `t` (s) con `intensidad` 0..1 (reemplaza al que esté en curso). */
export function dispararSaludo(r: Reaccion, t: number, intensidad: number): void {
  r.saludoInicio = t;
  r.saludoIntensidad = limitar01(intensidad);
}

/** Gira la cabeza `yaw` rad (relativo al cuerpo) hacia quien le habla, y vuelve al frente. */
export function dispararGiro(r: Reaccion, t: number, yaw: number): void {
  r.giroInicio = t;
  r.giroYaw = yaw;
}

export function avanzarReaccion(r: Reaccion, t: number, salida: SalidaReaccion): void {
  salida.brazoSaludo = 0;
  salida.cabezaAsentir = 0;
  salida.giroCabeza = 0;

  if (r.saludoInicio >= 0) {
    const s = t - r.saludoInicio;
    if (s >= DURACION_SALUDO) {
      r.saludoInicio = -1;
    } else {
      envolventeGesto(s, DURACION_SALUDO, r.env);
      salida.brazoSaludo = 0.9 * r.saludoIntensidad * (r.env.pico + r.env.rebase);
      const u = (s / DURACION_SALUDO - 0.2) / 0.5;
      salida.cabezaAsentir = u > 0 && u < 1 ? r.saludoIntensidad * Math.sin(Math.PI * u) : 0;
    }
  }

  if (r.giroInicio >= 0) {
    const s = t - r.giroInicio;
    if (s >= DURACION_GIRO) {
      r.giroInicio = -1;
    } else {
      envolventeGesto(s, DURACION_GIRO, r.env);
      salida.giroCabeza = r.giroYaw * (r.env.pico + r.env.rebase) + 0;
    }
  }
}
