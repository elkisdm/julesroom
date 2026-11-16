/**
 * Datos de mercado de EJEMPLO para las pantallas de la sala de trading: activos genéricos, velas
 * deterministas por semilla y formato es-CL. Nada se descarga; la aplicación puede reemplazar cualquier
 * pantalla con su propio contenido (`contenidoPantallas`).
 */
import type { ActivoId } from '../../../escenarios/trading/plano';

export type { ActivoId };

export interface Activo {
  id: ActivoId;
  simbolo: string;
  decimales: number;
  precioBase: number;
  /** Desviación por vela, como fracción del precio. */
  volatilidad: number;
  semilla: number;
}

export const ACTIVOS: readonly Activo[] = [
  {
    id: 'btc',
    simbolo: 'BTC/USDT',
    decimales: 0,
    precioBase: 64200,
    volatilidad: 0.004,
    semilla: 11,
  },
  {
    id: 'eth',
    simbolo: 'ETH/USDT',
    decimales: 2,
    precioBase: 3150,
    volatilidad: 0.0048,
    semilla: 12,
  },
  {
    id: 'eur',
    simbolo: 'EUR/USD',
    decimales: 4,
    precioBase: 1.085,
    volatilidad: 0.0007,
    semilla: 13,
  },
  {
    id: 'xau',
    simbolo: 'XAU/USD',
    decimales: 2,
    precioBase: 2350,
    volatilidad: 0.0018,
    semilla: 14,
  },
];

export function activo(id: ActivoId): Activo {
  const a = ACTIVOS.find((x) => x.id === id);
  if (!a) throw new Error(`Activo desconocido: ${id}`);
  return a;
}

export interface Vela {
  apertura: number;
  max: number;
  min: number;
  cierre: number;
}

/** Generador con semilla (mulberry32): misma semilla, misma secuencia. */
export function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ruido = (rnd: () => number) => (rnd() + rnd() + rnd() - 1.5) * 2;

/**
 * Velas de ejemplo: una oscilación lenta más ruido, para que haya máximos y mínimos visibles.
 * `volatilidad` es la desviación por vela como fracción del precio.
 */
export function generarVelas(o: {
  semilla: number;
  cantidad: number;
  precioInicial: number;
  volatilidad: number;
}): Vela[] {
  const rnd = aleatorio(o.semilla);
  const fase = rnd() * Math.PI * 2;
  const periodo = 17 + rnd() * 9;
  const amplitud = o.volatilidad * 6;
  const deriva = (rnd() - 0.5) * o.volatilidad * 0.2;
  const objetivo = (i: number) =>
    o.precioInicial * (1 + deriva * i + amplitud * Math.sin(fase + (i / periodo) * Math.PI * 2));
  const velas: Vela[] = [];
  let cierre = objetivo(0);
  for (let i = 0; i < o.cantidad; i++) {
    const apertura = cierre;
    cierre = Math.max(
      apertura + (objetivo(i + 1) - apertura) * 0.35 + apertura * o.volatilidad * ruido(rnd) * 0.7,
      o.precioInicial * 0.05,
    );
    velas.push({
      apertura,
      cierre,
      max: Math.max(apertura, cierre) + apertura * o.volatilidad * rnd() * 0.45,
      min: Math.max(
        Math.min(apertura, cierre) - apertura * o.volatilidad * rnd() * 0.45,
        o.precioInicial * 0.01,
      ),
    });
  }
  return velas;
}

const series = new Map<ActivoId, Vela[]>();

/** Las 60 velas de ejemplo de un activo (se calculan una vez). */
export function serie(id: ActivoId): Vela[] {
  let s = series.get(id);
  if (!s) {
    const a = activo(id);
    s = generarVelas({
      semilla: a.semilla,
      cantidad: 60,
      precioInicial: a.precioBase,
      volatilidad: a.volatilidad,
    });
    series.set(id, s);
  }
  return s;
}

/** Variación (%) de las últimas 24 velas. */
export function variacion(id: ActivoId): number {
  const s = serie(id);
  const ultimo = s.at(-1)!.cierre;
  const antes = s[Math.max(0, s.length - 25)]!.cierre;
  return ((ultimo - antes) / antes) * 100;
}

/** Soporte y resistencia de ejemplo: el mínimo y el máximo de las últimas 24 velas. */
export function niveles(velas: readonly Vela[]): { soporte: number; resistencia: number } {
  const ventana = velas.slice(-24);
  return {
    soporte: Math.min(...ventana.map((v) => v.min)),
    resistencia: Math.max(...ventana.map((v) => v.max)),
  };
}

/** Número con punto de miles y coma decimal, siempre con `decimales` cifras. */
export function formatoPrecio(valor: number, decimales: number): string {
  const [entero = '0', dec] = Math.abs(valor).toFixed(decimales).split('.');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${valor < 0 ? '−' : ''}${miles}${dec ? `,${dec}` : ''}`;
}

/** Porcentaje con signo y dos decimales: «+1,24 %», «−0,80 %». */
export function formatoPct(valor: number): string {
  const abs = Math.abs(valor).toFixed(2).replace('.', ',');
  const signo = valor > 0 ? '+' : valor < 0 ? '−' : '';
  return `${signo}${abs} %`;
}
