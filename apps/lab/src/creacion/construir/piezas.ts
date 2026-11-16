import { PIEZAS_NUEVAS } from '@oficina/motor';
/**
 * Forma de cada objeto colocable, en el estilo de bloques del motor: partes simples en fracciones de
 * la caja del catálogo (x y z de −0,5 a 0,5, y de 0 a 1). Así la medida vive en un solo lugar
 * (`CATALOGO_OBJETOS`) y el dibujo se ajusta solo. Datos puros, sin three.
 */
export type FormaParte = 'caja' | 'cil' | 'esfera';

export interface Parte {
  f: FormaParte;
  /** Centro en fracciones de la caja. */
  c: [number, number, number];
  /** Tamaño en fracciones de la caja (en cil y esfera: diámetro en x/z, alto en y). */
  s: [number, number, number];
  color: string;
  /** Emite luz propia (pantallas, pantallas de lámpara). */
  brillo?: boolean;
  opacidad?: number;
}

const MADERA = '#a77a52';
const MADERA_OSC = '#7d5a3c';
const TERRACOTA = '#c9774e';
const HOJA = '#6fae6a';
const HOJA_2 = '#5c9a5a';
const HOJA_3 = '#82bd78';
const TELA = '#5b6f9a';
const TELA_2 = '#6d82b0';
const METAL = '#3a3f4a';
const LATON = '#d8b56a';

export const PIEZAS: Record<string, Parte[]> = {
  ...PIEZAS_NUEVAS,
  'planta-grande': [
    { f: 'cil', c: [0, 0.14, 0], s: [0.62, 0.28, 0.62], color: TERRACOTA },
    { f: 'esfera', c: [0, 0.62, 0], s: [0.95, 0.62, 0.95], color: HOJA },
    { f: 'esfera', c: [-0.2, 0.5, 0.15], s: [0.55, 0.42, 0.55], color: HOJA_2 },
    { f: 'esfera', c: [0.22, 0.78, -0.1], s: [0.5, 0.4, 0.5], color: HOJA_3 },
  ],
  'maceta-baja': [
    { f: 'cil', c: [0, 0.25, 0], s: [0.9, 0.5, 0.9], color: '#d9c7a8' },
    { f: 'esfera', c: [0, 0.68, 0], s: [1, 0.6, 1], color: HOJA_2 },
  ],
  palmera: [
    { f: 'cil', c: [0, 0.1, 0], s: [0.5, 0.2, 0.5], color: TERRACOTA },
    { f: 'cil', c: [0, 0.5, 0], s: [0.1, 0.65, 0.1], color: MADERA_OSC },
    { f: 'caja', c: [0.25, 0.85, 0], s: [0.55, 0.06, 0.18], color: HOJA },
    { f: 'caja', c: [-0.25, 0.83, 0], s: [0.55, 0.06, 0.18], color: HOJA_3 },
    { f: 'caja', c: [0, 0.86, 0.25], s: [0.18, 0.06, 0.55], color: HOJA_2 },
    { f: 'caja', c: [0, 0.82, -0.25], s: [0.18, 0.06, 0.55], color: HOJA },
  ],
  'sofa-tres': [
    { f: 'caja', c: [0, 0.25, 0.05], s: [0.9, 0.3, 0.8], color: TELA },
    { f: 'caja', c: [0, 0.6, -0.37], s: [0.9, 0.55, 0.22], color: TELA_2 },
    { f: 'caja', c: [-0.46, 0.4, 0], s: [0.1, 0.5, 0.95], color: TELA },
    { f: 'caja', c: [0.46, 0.4, 0], s: [0.1, 0.5, 0.95], color: TELA },
  ],
  sillon: [
    { f: 'caja', c: [0, 0.25, 0.05], s: [0.8, 0.3, 0.8], color: '#b0674a' },
    { f: 'caja', c: [0, 0.62, -0.36], s: [0.8, 0.55, 0.22], color: '#c27a5c' },
    { f: 'caja', c: [-0.43, 0.42, 0], s: [0.16, 0.45, 0.9], color: '#a35c40' },
    { f: 'caja', c: [0.43, 0.42, 0], s: [0.16, 0.45, 0.9], color: '#a35c40' },
  ],
  puff: [{ f: 'cil', c: [0, 0.5, 0], s: [1, 1, 1], color: '#d8b56a' }],
  banco: [
    { f: 'caja', c: [0, 0.85, 0], s: [1, 0.15, 1], color: MADERA },
    { f: 'caja', c: [-0.42, 0.4, 0], s: [0.08, 0.8, 0.8], color: MADERA_OSC },
    { f: 'caja', c: [0.42, 0.4, 0], s: [0.08, 0.8, 0.8], color: MADERA_OSC },
  ],
  'mesa-redonda': [
    { f: 'cil', c: [0, 0.95, 0], s: [1, 0.08, 1], color: MADERA },
    { f: 'cil', c: [0, 0.48, 0], s: [0.1, 0.9, 0.1], color: METAL },
    { f: 'cil', c: [0, 0.03, 0], s: [0.5, 0.06, 0.5], color: METAL },
  ],
  'mesa-alta': [
    { f: 'cil', c: [0, 0.96, 0], s: [1, 0.06, 1], color: '#f1ebe0' },
    { f: 'cil', c: [0, 0.48, 0], s: [0.1, 0.92, 0.1], color: METAL },
    { f: 'cil', c: [0, 0.02, 0], s: [0.55, 0.04, 0.55], color: METAL },
  ],
  escritorio: [
    { f: 'caja', c: [0, 0.95, 0], s: [1, 0.08, 1], color: MADERA },
    { f: 'caja', c: [-0.46, 0.47, 0], s: [0.05, 0.92, 0.9], color: METAL },
    { f: 'caja', c: [0.46, 0.47, 0], s: [0.05, 0.92, 0.9], color: METAL },
    { f: 'caja', c: [0, 1.25, -0.2], s: [0.4, 0.45, 0.04], color: '#1b2433', brillo: true },
  ],
  'pantalla-pie': [
    { f: 'caja', c: [0, 0.68, 0], s: [1, 0.55, 0.3], color: '#1b2433', brillo: true },
    { f: 'caja', c: [0, 0.22, 0], s: [0.06, 0.4, 0.06], color: METAL },
    { f: 'caja', c: [0, 0.02, 0], s: [0.45, 0.04, 0.9], color: METAL },
  ],
  pizarra: [
    { f: 'caja', c: [0, 0.65, 0], s: [1, 0.55, 0.15], color: '#f4efe6' },
    { f: 'caja', c: [-0.44, 0.35, 0], s: [0.04, 0.7, 0.9], color: METAL },
    { f: 'caja', c: [0.44, 0.35, 0], s: [0.04, 0.7, 0.9], color: METAL },
  ],
  'lampara-pie': [
    { f: 'cil', c: [0, 0.02, 0], s: [0.8, 0.04, 0.8], color: METAL },
    { f: 'cil', c: [0, 0.45, 0], s: [0.08, 0.85, 0.08], color: METAL },
    { f: 'cil', c: [0, 0.9, 0], s: [1, 0.2, 1], color: '#f2d27e', brillo: true },
  ],
  'lampara-mesa': [
    { f: 'cil', c: [0, 0.2, 0], s: [0.5, 0.4, 0.5], color: LATON },
    { f: 'cil', c: [0, 0.7, 0], s: [1, 0.5, 1], color: '#f2d27e', brillo: true },
  ],
  alfombra: [{ f: 'caja', c: [0, 0.5, 0], s: [1, 1, 1], color: '#c4785a' }],
  estante: [
    { f: 'caja', c: [0, 0.5, 0], s: [1, 1, 1], color: MADERA_OSC },
    { f: 'caja', c: [0, 0.78, 0.08], s: [0.9, 0.18, 0.86], color: '#2a2018' },
    { f: 'caja', c: [0, 0.48, 0.08], s: [0.9, 0.18, 0.86], color: '#2a2018' },
    { f: 'caja', c: [0, 0.18, 0.08], s: [0.9, 0.18, 0.86], color: '#2a2018' },
    { f: 'caja', c: [-0.25, 0.78, 0.1], s: [0.12, 0.16, 0.7], color: '#d36b4f' },
    { f: 'caja', c: [0.1, 0.48, 0.1], s: [0.2, 0.16, 0.7], color: '#6c9ad6' },
    { f: 'caja', c: [0.3, 0.18, 0.1], s: [0.14, 0.16, 0.7], color: LATON },
  ],
  cuadro: [
    { f: 'caja', c: [0, 0.5, 0], s: [1, 1, 1], color: MADERA_OSC },
    { f: 'caja', c: [0, 0.5, 0.2], s: [0.85, 0.85, 0.7], color: '#e8d3a8' },
    { f: 'caja', c: [-0.15, 0.45, 0.3], s: [0.35, 0.4, 0.5], color: '#5b7fd6' },
    { f: 'caja', c: [0.2, 0.6, 0.3], s: [0.25, 0.3, 0.5], color: '#d9825f' },
  ],
  'barra-cafe': [
    { f: 'caja', c: [0, 0.45, 0], s: [1, 0.9, 1], color: '#8fa89a' },
    { f: 'caja', c: [0, 0.93, 0], s: [1.02, 0.06, 1.05], color: '#e9e4da' },
    { f: 'caja', c: [0.3, 1.1, -0.1], s: [0.15, 0.3, 0.4], color: METAL },
    { f: 'cil', c: [-0.2, 1.02, 0.1], s: [0.06, 0.12, 0.15], color: '#f4efe6' },
  ],
};

/** Forma de reserva para un tipo sin pieza: una caja neutra (nunca invisible). */
export const PIEZA_GENERICA: Parte[] = [
  { f: 'caja', c: [0, 0.5, 0], s: [1, 1, 1], color: '#9aa0aa' },
];

export const piezaDe = (tipo: string): Parte[] => PIEZAS[tipo] ?? PIEZA_GENERICA;

/** Agrupa instancias por geometría + material (una `InstancedMesh` por clave). */
export function claveInstancia(p: Parte, fantasma = false): string {
  if (fantasma) return `fantasma:${p.f}:${p.color}`;
  return `${p.f}:${p.color}:${p.brillo ? 1 : 0}${p.opacidad === undefined ? '' : `:${p.opacidad}`}`;
}

export const PARAMETROS_INSTANCIAS_OBJETOS = {
  /** Objetos mezclados de referencia para medir y probar draw calls. */
  cantidadPrueba: 60,
  /** Tope de `renderer.info.render.calls` solo de piezas colocadas (post-instancing). */
  topeLlamadas: 92,
} as const;

export interface ObjetoDibujo {
  id: string;
  tipo: string;
  x: number;
  z: number;
  giro: 0 | 1 | 2 | 3;
}

/** Llamadas si cada parte fuera su propia malla (modo anterior). */
export function llamadasSinInstanciar(objetos: readonly { tipo: string }[]): number {
  return objetos.reduce((n, o) => n + piezaDe(o.tipo).length, 0);
}

/** Llamadas con una malla instanciada por clave de parte visible. */
export function llamadasInstanciadas(objetos: readonly { tipo: string }[]): number {
  const claves = new Set<string>();
  for (const o of objetos) {
    for (const p of piezaDe(o.tipo)) claves.add(claveInstancia(p, false));
  }
  return claves.size;
}

/** Índice de instancia → id del objeto (misma ordenación que usa el dibujo). */
export function indiceInstanciaAObjeto(
  objetos: readonly ObjetoDibujo[],
  clave: string,
  indice: number,
  excluir?: string | null,
): string | null {
  let visto = -1;
  for (const o of objetos) {
    if (o.id === excluir) continue;
    const partes = piezaDe(o.tipo);
    for (const p of partes) {
      if (claveInstancia(p, false) !== clave) continue;
      visto++;
      if (visto === indice) return o.id;
    }
  }
  return null;
}

export function objetosPruebaMezclados(tipos: readonly string[], n: number): ObjetoDibujo[] {
  const out: ObjetoDibujo[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `obj-${i}`,
      tipo: tipos[i % tipos.length] ?? tipos[0] ?? 'puff',
      x: (i % 10) * 0.8 - 3.6,
      z: Math.floor(i / 10) * 0.8 - 2.4,
      giro: (i % 4) as 0 | 1 | 2 | 3,
    });
  }
  return out;
}
