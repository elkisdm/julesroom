/**
 * El primer minuto dentro de la sala: misiones en orden, que se cumplen solas al hacer la cosa
 * (no al leerla). Lógica pura: recibe muestras del avatar y eventos, devuelve el estado.
 */

export type IdMision = 'caminar' | 'correr' | 'saltar' | 'sentarse' | 'hablar';

export interface Mision {
  id: IdMision;
  texto: string;
  /** Teclas que se muestran junto al personaje (o al objeto) mientras es la misión actual. */
  teclas: string[];
  /** Texto corto que acompaña a las teclas. */
  pista: string;
  /** En pantallas táctiles (sin teclado): qué hacer con la palanca o los botones. */
  tactil: { texto: string; pista: string };
}

export const MISIONES: readonly Mision[] = [
  {
    id: 'caminar',
    texto: 'Camina',
    teclas: ['W', 'A', 'S', 'D'],
    pista: 'para caminar',
    tactil: { texto: 'Camina', pista: 'Mueve la palanca' },
  },
  {
    id: 'correr',
    texto: 'Corre con Shift',
    teclas: ['Shift'],
    pista: 'mantenlo para correr',
    tactil: { texto: 'Corre', pista: 'Lleva la palanca hasta el borde' },
  },
  {
    id: 'saltar',
    texto: 'Salta con Espacio',
    teclas: ['Espacio'],
    pista: 'para saltar',
    tactil: { texto: 'Salta', pista: 'Toca Saltar' },
  },
  {
    id: 'sentarse',
    texto: 'Siéntate con E',
    teclas: ['E'],
    pista: 'aquí, para sentarte',
    tactil: { texto: 'Siéntate', pista: 'Toca esta silla' },
  },
  {
    id: 'hablar',
    texto: 'Háblale a un agente',
    teclas: ['Clic'],
    pista: 'sobre un agente',
    tactil: { texto: 'Háblale a un agente', pista: 'Toca a un agente' },
  },
];

/** Umbrales de cada misión (valores iniciales parametrizables). */
export interface UmbralesMisiones {
  /** Metros recorridos caminando para dar por hecha la primera. */
  distancia: number;
  /** Rapidez (m/s) que cuenta como correr. */
  rapidezCorrer: number;
}

export const UMBRALES_MISIONES: UmbralesMisiones = {
  distancia: 2,
  rapidezCorrer: 3.6,
};

export interface EstadoMisiones {
  hechas: IdMision[];
  recorrido: number;
  ultimo: { x: number; z: number } | null;
  /** Saltos del mando cuando empezó la misión de saltar (los de antes no cuentan). */
  saltosBase: number | null;
}

export const misionesIniciales = (): EstadoMisiones => ({
  hechas: [],
  recorrido: 0,
  ultimo: null,
  saltosBase: null,
});

/** La misión que toca ahora, o `null` si ya están todas. */
export const misionActual = (e: EstadoMisiones): Mision | null =>
  MISIONES.find((m) => !e.hechas.includes(m.id)) ?? null;

const marcar = (e: EstadoMisiones, id: IdMision): EstadoMisiones =>
  e.hechas.includes(id) ? e : { ...e, hechas: [...e.hechas, id] };

export interface MuestraAvatar {
  x: number;
  y: number;
  z: number;
  velocidad: number;
  estado: 'de-pie' | 'sentado';
  /** Contador de saltos del mando: el motor no informa la altura del arco, solo la del piso. */
  saltos: number;
}

/**
 * Avanza con una muestra del avatar. Las misiones se cumplen en orden: correr no cuenta antes de
 * caminar, para que cada pista aparezca cuando toca. Devuelve el mismo objeto si nada cambió.
 */
export function conMuestra(
  e: EstadoMisiones,
  m: MuestraAvatar,
  u: UmbralesMisiones = UMBRALES_MISIONES,
): EstadoMisiones {
  let s = e;
  if (s.ultimo) {
    const d = Math.hypot(m.x - s.ultimo.x, m.z - s.ultimo.z);
    if (d > 0.01 && d < 2) s = { ...s, recorrido: s.recorrido + d };
  }
  s =
    s.ultimo && s.ultimo.x === m.x && s.ultimo.z === m.z ? s : { ...s, ultimo: { x: m.x, z: m.z } };

  const actual = misionActual(s)?.id;
  if (actual !== 'saltar' && s.saltosBase !== m.saltos) s = { ...s, saltosBase: m.saltos };
  if (actual === 'caminar' && s.recorrido >= u.distancia) s = marcar(s, 'caminar');
  else if (actual === 'correr' && m.velocidad >= u.rapidezCorrer) s = marcar(s, 'correr');
  else if (actual === 'saltar' && m.saltos > (s.saltosBase ?? m.saltos)) s = marcar(s, 'saltar');
  else if (actual === 'sentarse' && m.estado === 'sentado') s = marcar(s, 'sentarse');
  return s;
}

/** Hablarle a un agente cuenta en cualquier momento (es lo que más importa probar). */
export const conHabla = (e: EstadoMisiones): EstadoMisiones => marcar(e, 'hablar');

export const todasHechas = (e: EstadoMisiones): boolean => misionActual(e) === null;
