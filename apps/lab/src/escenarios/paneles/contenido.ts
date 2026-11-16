/** Contenido de EJEMPLO de la academia y la videoteca. Nada de esto es de una comunidad real. */

export type Tema = 'velas' | 'niveles' | 'riesgo' | 'indicadores' | 'calendario';

export interface Leccion {
  id: string;
  titulo: string;
  /** Segundos. */
  duracion: number;
  resumen: string;
}

export interface Curso {
  id: string;
  titulo: string;
  nivel: 'Inicial' | 'Intermedio' | 'Avanzado';
  tema: Tema;
  lecciones: Leccion[];
}

const min = (m: number) => m * 60;
const leccion = (id: string, titulo: string, minutos: number, resumen: string): Leccion => ({
  id,
  titulo,
  duracion: min(minutos),
  resumen,
});

export const CURSOS: Curso[] = [
  {
    id: 'soportes-y-resistencias',
    titulo: 'Soportes y resistencias',
    nivel: 'Inicial',
    tema: 'niveles',
    lecciones: [
      leccion('n1', 'Qué es un nivel', 8, 'Por qué el precio reacciona en ciertas zonas y cómo se marcan.'),
      leccion('n2', 'Cuántos toques bastan', 10, 'Un nivel pesa por las veces que reaccionó el precio, no por su cercanía.'),
      leccion('n3', 'Niveles en varias temporalidades', 9, 'Qué ocurre cuando coinciden los niveles de 1 h y de 4 h.'),
    ],
  },
  {
    id: 'lectura-de-velas',
    titulo: 'Lectura de velas',
    nivel: 'Inicial',
    tema: 'velas',
    lecciones: [
      leccion('v1', 'Qué muestra una vela', 7, 'Apertura, cierre, máximo y mínimo en cada vela.'),
      leccion('v2', 'Cuerpo, mechas y contexto', 9, 'Qué dice el tamaño del cuerpo y de las mechas.'),
      leccion('v3', 'Patrones de una y dos velas', 11, 'Los patrones más usados y por qué no bastan por sí solos.'),
      leccion('v4', 'Estructura de máximos y mínimos', 12, 'Cómo se lee una secuencia de máximos y mínimos.'),
    ],
  },
  {
    id: 'gestion-de-riesgo',
    titulo: 'Gestión de riesgo',
    nivel: 'Intermedio',
    tema: 'riesgo',
    lecciones: [
      leccion('r1', 'Cuánto arriesgar por operación', 10, 'Un porcentaje fijo del capital como punto de partida.'),
      leccion('r2', 'Invalidez de un escenario', 12, 'Dónde se descarta una idea y qué hacer entonces.'),
      leccion('r3', 'Tamaño de la posición', 11, 'Cómo cambia el tamaño cuando cambia la volatilidad.'),
    ],
  },
];

export interface Video {
  id: string;
  titulo: string;
  tipo: 'Sesión en vivo' | 'Análisis corto';
  mercado: string;
  /** Segundos. */
  duracion: number;
  /** Fecha ISO local. */
  fecha: string;
  tema: Tema;
  semilla: number;
  resumen: string;
}

export const VIDEOS: Video[] = [
  { id: 'btc-semana', titulo: 'BTC: estructura y niveles de la semana', tipo: 'Sesión en vivo', mercado: 'Cripto', duracion: min(58), fecha: '2026-11-14T12:00:00', tema: 'niveles', semilla: 21, resumen: 'Revisión de la estructura en 4 h y 1 h, zonas relevantes y dos escenarios posibles.' },
  { id: 'eurusd-datos', titulo: 'EUR/USD ante los datos de empleo', tipo: 'Análisis corto', mercado: 'Divisas', duracion: min(12), fecha: '2026-11-13T12:00:00', tema: 'calendario', semilla: 22, resumen: 'Qué mira el mercado en la publicación y cómo preparar el gráfico antes del evento.' },
  { id: 'indice-rango', titulo: 'Un índice en rango: sus límites', tipo: 'Análisis corto', mercado: 'Índices', duracion: min(9), fecha: '2026-11-12T12:00:00', tema: 'velas', semilla: 23, resumen: 'Cómo distinguir un rango de una tendencia y dónde están sus límites.' },
  { id: 'oro-riesgo', titulo: 'Oro: dónde invalidar un escenario', tipo: 'Sesión en vivo', mercado: 'Materias primas', duracion: min(46), fecha: '2026-11-11T12:00:00', tema: 'riesgo', semilla: 24, resumen: 'Ejemplo guiado de entrada, invalidez y tamaño de posición.' },
  { id: 'eth-indicadores', titulo: 'ETH: medias móviles y RSI en 1 h', tipo: 'Análisis corto', mercado: 'Cripto', duracion: min(14), fecha: '2026-11-10T12:00:00', tema: 'indicadores', semilla: 25, resumen: 'Dos indicadores sobre el mismo gráfico y qué aporta cada uno.' },
  { id: 'revision-semanal', titulo: 'Revisión semanal de bitácora', tipo: 'Sesión en vivo', mercado: 'Divisas', duracion: min(52), fecha: '2026-11-07T12:00:00', tema: 'calendario', semilla: 26, resumen: 'Cómo se hace una revisión con operaciones de ejemplo y qué ajustes salen de ella.' },
];

export const lecciones = (curso: Curso): Leccion[] => curso.lecciones;

/** «7 min», «1 h», «1 h 20 min». */
export function formatoDuracion(segundos: number): string {
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Reloj del reproductor: «03:25» o «1:02:05». */
export function formatoReloj(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

/** «14 nov». */
export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');
}
