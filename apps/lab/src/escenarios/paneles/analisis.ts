/**
 * Datos de mercado de EJEMPLO: series de velas generadas con semilla y un análisis simple de niveles.
 * Nada viene de un mercado real; sirve para que los paneles tengan algo coherente que mostrar.
 */
export type ActivoId = 'btc' | 'eth' | 'eur' | 'xau';
export type Temporalidad = '15m' | '1h' | '4h';

export interface Activo {
  id: ActivoId;
  simbolo: string;
  /** Precio de partida de la serie. */
  base: number;
  decimales: number;
  /** Volatilidad por vela, como fracción del precio. */
  vol: number;
}

export const ACTIVOS: readonly Activo[] = [
  { id: 'btc', simbolo: 'BTC/USDT', base: 64_200, decimales: 0, vol: 0.006 },
  { id: 'eth', simbolo: 'ETH/USDT', base: 3_150, decimales: 1, vol: 0.008 },
  { id: 'eur', simbolo: 'EUR/USD', base: 1.0840, decimales: 4, vol: 0.0016 },
  { id: 'xau', simbolo: 'XAU/USD', base: 2_340, decimales: 1, vol: 0.0035 },
];

export const TEMPORALIDADES: readonly { id: Temporalidad; etiqueta: string }[] = [
  { id: '15m', etiqueta: '15 min' },
  { id: '1h', etiqueta: '1 h' },
  { id: '4h', etiqueta: '4 h' },
];

export const buscarActivo = (id: ActivoId): Activo => ACTIVOS.find((a) => a.id === id)!;

export interface Vela {
  apertura: number;
  cierre: number;
  max: number;
  min: number;
}

function mulberry32(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MULTIPLO_TF: Record<Temporalidad, number> = { '15m': 0.6, '1h': 1, '4h': 1.8 };
const VELAS = 90;

export function serieVelas(id: ActivoId, tf: Temporalidad, n = VELAS): Vela[] {
  const activo = buscarActivo(id);
  const azar = mulberry32(ACTIVOS.indexOf(activo) * 101 + TEMPORALIDADES.findIndex((t) => t.id === tf) * 7 + 3);
  const paso = activo.base * activo.vol * MULTIPLO_TF[tf];
  const velas: Vela[] = [];
  let precio = activo.base;
  for (let i = 0; i < n; i++) {
    // Oscila alrededor de la base para que haya niveles que se repiten.
    const tiron = (activo.base - precio) * 0.04;
    const apertura = precio;
    const cierre = apertura + (azar() - 0.5) * 2 * paso + tiron;
    const max = Math.max(apertura, cierre) + azar() * paso * 0.6;
    const min = Math.min(apertura, cierre) - azar() * paso * 0.6;
    velas.push({ apertura, cierre, max, min });
    precio = cierre;
  }
  return velas;
}

export interface Nivel {
  id: string;
  precio: number;
  toques: number;
}

export type Direccion = 'alcista' | 'bajista' | 'lateral';

export interface Escenario {
  nivel: number;
  objetivo: number;
  invalidez: number;
}

export interface Analisis {
  precio: number;
  soportes: Nivel[];
  resistencias: Nivel[];
  tendencia: { direccion: Direccion };
  probabilidades: { alcista: number; lateral: number; bajista: number };
  escenarios: { alcista: Escenario; bajista: Escenario };
}

/** Agrupa precios cercanos (tolerancia relativa) y devuelve el promedio y cuántos entraron. */
function agrupar(precios: number[], tolerancia: number): { precio: number; toques: number }[] {
  const grupos: number[][] = [];
  for (const p of [...precios].sort((a, b) => a - b)) {
    const g = grupos[grupos.length - 1];
    if (g && Math.abs(p - g[0]!) / g[0]! <= tolerancia) g.push(p);
    else grupos.push([p]);
  }
  return grupos.map((g) => ({ precio: g.reduce((a, b) => a + b, 0) / g.length, toques: g.length }));
}

const media = (v: Vela[]) => v.reduce((a, x) => a + x.cierre, 0) / v.length;

export function analizar(id: ActivoId, tf: Temporalidad): Analisis {
  const velas = serieVelas(id, tf);
  const precio = velas[velas.length - 1]!.cierre;
  const minimos: number[] = [];
  const maximos: number[] = [];
  for (let i = 3; i < velas.length - 3; i++) {
    const ventana = velas.slice(i - 3, i + 4);
    if (velas[i]!.min === Math.min(...ventana.map((v) => v.min))) minimos.push(velas[i]!.min);
    if (velas[i]!.max === Math.max(...ventana.map((v) => v.max))) maximos.push(velas[i]!.max);
  }
  const suelo = Math.min(...velas.map((v) => v.min));
  const techo = Math.max(...velas.map((v) => v.max));
  const rotular = (lista: { precio: number; toques: number }[], letra: string): Nivel[] =>
    lista.map((n, i) => ({ id: `${letra}${i + 1}`, ...n }));
  const soportes = rotular(
    agrupar(minimos, 0.004)
      .filter((n) => n.precio < precio)
      .sort((a, b) => b.precio - a.precio),
    'S',
  );
  const resistencias = rotular(
    agrupar(maximos, 0.004)
      .filter((n) => n.precio > precio)
      .sort((a, b) => a.precio - b.precio),
    'R',
  );
  if (soportes.length === 0) soportes.push({ id: 'S1', precio: Math.min(suelo, precio * 0.99), toques: 1 });
  if (resistencias.length === 0)
    resistencias.push({ id: 'R1', precio: Math.max(techo, precio * 1.01), toques: 1 });

  const reciente = media(velas.slice(-20));
  const previa = media(velas.slice(-40, -20));
  const cambio = (reciente - previa) / previa;
  const direccion: Direccion = cambio > 0.004 ? 'alcista' : cambio < -0.004 ? 'bajista' : 'lateral';
  const alcista = direccion === 'alcista' ? 50 : direccion === 'bajista' ? 22 : 33;
  const bajista = direccion === 'bajista' ? 50 : direccion === 'alcista' ? 22 : 33;
  const s1 = soportes[0]!.precio;
  const r1 = resistencias[0]!.precio;
  const ancho = r1 - s1;
  return {
    precio,
    soportes,
    resistencias,
    tendencia: { direccion },
    probabilidades: { alcista, lateral: 100 - alcista - bajista, bajista },
    escenarios: {
      alcista: { nivel: r1, objetivo: r1 + ancho, invalidez: s1 },
      bajista: { nivel: s1, objetivo: s1 - ancho, invalidez: r1 },
    },
  };
}

export function formatoPrecio(valor: number, decimales: number): string {
  return valor.toLocaleString('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}
