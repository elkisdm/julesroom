/**
 * Salto: impulso (agacharse 2–3 cuadros), aire con gravedad constante (sube y cae) y aterrizaje
 * (aplastar y recuperar). La altura y el tiempo en el aire son los parámetros; la gravedad sale de
 * ellos (g = 8·h / t², v0 = 4·h / t), así que afinar uno no desarma el otro. Sin mundo (personas
 * remotas, agentes): el salto sube y baja sobre la altura del piso, sin colisión. En modo mundo (`mundo`,
 * el avatar propio) la física la hace el avatar contra el suelo real y aquí solo corren las fases.
 *
 * Referencia de sensación: Roblox (salto inmediato, alto, con control en el aire). Las cifras son
 * valores iniciales parametrizables, medidos en clips (ver docs/specs/caminata.md).
 *
 * Por persona y por cuadro no asigna memoria. Con dt ≤ 0 no cambia nada.
 */

export type FaseSalto = 'suelo' | 'impulso' | 'aire' | 'aterrizaje';

export interface Salto {
  fase: FaseSalto;
  /** Segundos dentro de la fase actual. */
  t: number;
  /** Altura sobre el piso (m, ≥ 0) y velocidad vertical (m/s, > 0 sube). */
  y: number;
  vy: number;
  /** Fuerza del último aterrizaje (0..1), para aplastar al tocar el suelo. */
  impacto: number;
  /** Contador de saltos (sube al despegar): viaja por la red para que los demás lo vean. */
  saltos: number;
  /**
   * Modo mundo (avatar con suelo, `animacion/avatar.ts`): la altura y la gravedad las integra el avatar
   * con el suelo real; aquí solo corren las fases. En el aire no se integra `y` ni se aterriza solo:
   * lo decide `aterrizar`. El avatar escribe en `y` cuánto va la pelvis sobre la raíz y en `vy` su
   * velocidad vertical, para la pose.
   */
  mundo: boolean;
}

export const crearSalto = (): Salto => ({
  fase: 'suelo',
  t: 0,
  y: 0,
  vy: 0,
  impacto: 0,
  saltos: 0,
  mundo: false,
});

export interface ParametrosSalto {
  /** Altura del salto (m) desde el piso hasta los pies en el punto más alto. */
  altura: number;
  /** Tiempo en el aire (s) de un salto completo. */
  tiempoAire: number;
  /** Duración del impulso (s): se agacha antes de despegar. */
  impulso: number;
  /** Duración del aterrizaje (s): aplasta y se recupera; se puede volver a saltar o caminar. */
  aterrizaje: number;
  /** Fracción de la aceleración horizontal que conserva en el aire (control en el aire). */
  controlAire: number;
}

export const PARAMETROS_SALTO: ParametrosSalto = {
  altura: 1.2,
  tiempoAire: 0.55,
  impulso: 0.05,
  aterrizaje: 0.14,
  controlAire: 0.7,
};

/** Gravedad (m/s², positiva) que da la altura y el tiempo pedidos. */
export const gravedadSalto = (p: ParametrosSalto) => (8 * p.altura) / (p.tiempoAire * p.tiempoAire);
/** Velocidad vertical al despegar (m/s). */
export const velocidadDespegue = (p: ParametrosSalto) => (4 * p.altura) / p.tiempoAire;

/** Pide un salto: solo desde el suelo o al final del aterrizaje. Devuelve si arrancó. */
export function pedirSalto(s: Salto): boolean {
  if (s.fase === 'suelo' || s.fase === 'aterrizaje') {
    s.fase = 'impulso';
    s.t = 0;
    return true;
  }
  return false;
}

/** Despega ya (sin impulso): lo usan las personas remotas al recibir un salto atrasado. */
export function despegar(s: Salto, p: ParametrosSalto): void {
  s.fase = 'aire';
  s.t = 0;
  s.vy = velocidadDespegue(p);
  s.saltos++;
}

/** Modo mundo: el cuerpo salió de un borde y cae (pose de aire, sin contar un salto). */
export function caer(s: Salto): void {
  if (s.fase === 'aire') return;
  s.fase = 'aire';
  s.t = 0;
}

/** Modo mundo: tocó una superficie; `impacto` (0..1) da la fuerza del aplastamiento. */
export function aterrizar(s: Salto, impacto: number): void {
  s.fase = 'aterrizaje';
  s.t = 0;
  s.vy = 0;
  s.impacto = impacto;
}

/** Avanza el salto un cuadro. In situ. */
export function avanzarSalto(s: Salto, p: ParametrosSalto, dt: number): void {
  if (dt <= 0) return;
  let resto = dt;
  // Un dt grande (pestaña oculta, LOD) puede cruzar varias fases: se reparte.
  for (let vuelta = 0; vuelta < 4 && resto > 0; vuelta++) {
    if (s.fase === 'suelo') {
      s.t += resto;
      s.impacto = 0;
      return;
    }
    if (s.fase === 'impulso') {
      const queda = p.impulso - s.t;
      if (resto < queda) {
        s.t += resto;
        return;
      }
      resto -= Math.max(0, queda);
      despegar(s, p);
      continue;
    }
    if (s.fase === 'aire') {
      if (s.mundo) {
        s.t += resto;
        return;
      }
      const g = gravedadSalto(p);
      // Tiempo hasta tocar el suelo desde (y, vy): raíz positiva de y + vy·t − g·t²/2 = 0.
      const llegada = (s.vy + Math.sqrt(s.vy * s.vy + 2 * g * s.y)) / g;
      if (resto < llegada) {
        s.y += s.vy * resto - 0.5 * g * resto * resto;
        s.vy -= g * resto;
        s.t += resto;
        if (s.y < 0) s.y = 0;
        return;
      }
      resto -= llegada;
      const vImpacto = s.vy - g * llegada;
      s.impacto = Math.min(1, Math.abs(vImpacto) / velocidadDespegue(p));
      s.y = 0;
      s.vy = 0;
      s.fase = 'aterrizaje';
      s.t = 0;
      continue;
    }
    // aterrizaje
    s.t += resto;
    if (s.t >= p.aterrizaje) {
      s.fase = 'suelo';
      s.t = 0;
    }
    return;
  }
}

/** En el aire o despegando: la locomoción usa el control en el aire. */
export const enElAire = (s: Salto) => s.fase === 'aire';
