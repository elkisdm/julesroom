/**
 * Sonidos cortos de interfaz, sintetizados (sin archivos). Apagados por defecto: se encienden desde el
 * botón de sonido y la preferencia queda en este navegador.
 */
export type Sonido = 'paso' | 'colocar' | 'quitar' | 'girar' | 'mision' | 'hablar' | 'error';

const CLAVE = 'jules-room/sonido';
const NOTAS: Record<Sonido, { f: number; f2: number; d: number; tipo: OscillatorType; v: number }> =
  {
    paso: { f: 520, f2: 660, d: 0.09, tipo: 'sine', v: 0.05 },
    colocar: { f: 300, f2: 180, d: 0.08, tipo: 'triangle', v: 0.08 },
    quitar: { f: 260, f2: 120, d: 0.12, tipo: 'triangle', v: 0.06 },
    girar: { f: 640, f2: 700, d: 0.05, tipo: 'sine', v: 0.04 },
    mision: { f: 660, f2: 990, d: 0.16, tipo: 'sine', v: 0.06 },
    hablar: { f: 440, f2: 560, d: 0.08, tipo: 'sine', v: 0.05 },
    error: { f: 200, f2: 160, d: 0.14, tipo: 'square', v: 0.03 },
  };

let encendido = (() => {
  try {
    return window.localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
})();
let ctx: AudioContext | null = null;

export const sonidoEncendido = (): boolean => encendido;

export function fijarSonido(si: boolean): void {
  encendido = si;
  try {
    window.localStorage.setItem(CLAVE, si ? '1' : '0');
  } catch {
    // Sin almacenamiento la preferencia dura lo que dura la pestaña.
  }
  if (si) sonar('paso');
}

export function sonar(s: Sonido): void {
  if (!encendido) return;
  try {
    ctx ??= new AudioContext();
    const n = NOTAS[s];
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = n.tipo;
    o.frequency.setValueAtTime(n.f, t);
    o.frequency.exponentialRampToValueAtTime(n.f2, t + n.d);
    g.gain.setValueAtTime(n.v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + n.d + 0.02);
  } catch {
    // Sin audio no pasa nada: el sonido es opcional.
  }
}
