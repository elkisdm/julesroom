/** Contrato acotado de la pizarra. Se valida en ambos extremos, igual que el mundo. */
export const TIPOS = [
  'idea',
  'pasos',
  'mapa',
  'comparacion',
  'linea-tiempo',
  'barras',
  'capas',
] as const;
export type TipoPizarra = (typeof TIPOS)[number];
export interface Fuente {
  titulo: string;
  dominio: string;
}
interface Base {
  titulo: string;
  ejemplo: string;
  fuentes: Fuente[];
}
export type Pizarra = Base &
  (
    | { tipo: 'idea'; frase: string; analogia: string; puntos: string[] }
    | { tipo: 'pasos'; pasos: { texto: string; detalle: string; alternativa?: string }[] }
    | { tipo: 'mapa'; centro: string; nodos: { texto: string; relacion: string }[] }
    | { tipo: 'comparacion'; columnas: string[]; filas: { criterio: string; celdas: string[] }[] }
    | { tipo: 'linea-tiempo'; hitos: { fecha: string; texto: string }[] }
    | {
        tipo: 'barras';
        unidad: string;
        fuente: Fuente;
        valores: { nombre: string; valor: number }[];
      }
    | { tipo: 'capas'; partes: { nombre: string; detalle: string }[] }
  );
export const LIMITES = {
  texto: 240,
  titulo: 100,
  idea: 1200,
  bytes: 14500,
  historia: 30,
  animacion: 2000,
};
const objeto = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const texto = (x: unknown, max = LIMITES.texto): x is string =>
  typeof x === 'string' && x.trim().length > 0 && x.length <= max;
const lista = (x: unknown, min: number, max: number, f: (v: unknown) => boolean): boolean =>
  Array.isArray(x) && x.length >= min && x.length <= max && x.every(f);
const fuente = (x: unknown): boolean =>
  objeto(x) &&
  texto(x.titulo, 100) &&
  texto(x.dominio, 100) &&
  /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(x.dominio);
/** Devuelve null ante datos incompletos, excesivos o números no atribuibles. */
export function validarPizarra(x: unknown): Pizarra | null {
  if (
    !objeto(x) ||
    !texto(x.titulo, LIMITES.titulo) ||
    !texto(x.ejemplo) ||
    !lista(x.fuentes, 0, 4, fuente)
  )
    return null;
  let valido = false;
  switch (x.tipo) {
    case 'idea':
      valido = texto(x.frase) && texto(x.analogia) && lista(x.puntos, 3, 5, (v) => texto(v));
      break;
    case 'pasos':
      valido = lista(
        x.pasos,
        3,
        7,
        (v) =>
          objeto(v) &&
          texto(v.texto, 100) &&
          texto(v.detalle) &&
          (v.alternativa === undefined || texto(v.alternativa, 100)),
      );
      break;
    case 'mapa':
      valido =
        texto(x.centro, 100) &&
        lista(x.nodos, 3, 7, (v) => objeto(v) && texto(v.texto, 100) && texto(v.relacion, 80));
      break;
    case 'comparacion':
      valido =
        lista(x.columnas, 2, 3, (v) => texto(v, 80)) &&
        lista(
          x.filas,
          3,
          5,
          (v) =>
            objeto(v) &&
            texto(v.criterio, 80) &&
            lista(
              v.celdas,
              (x.columnas as unknown[]).length,
              (x.columnas as unknown[]).length,
              (v) => texto(v, 140),
            ),
        );
      break;
    case 'linea-tiempo':
      valido = lista(x.hitos, 3, 7, (v) => objeto(v) && texto(v.fecha, 60) && texto(v.texto, 160));
      break;
    case 'barras':
      valido =
        texto(x.unidad, 40) &&
        fuente(x.fuente) &&
        lista(
          x.valores,
          1,
          6,
          (v) =>
            objeto(v) &&
            texto(v.nombre, 80) &&
            typeof v.valor === 'number' &&
            Number.isFinite(v.valor) &&
            v.valor >= 0 &&
            v.valor <= 1e12,
        );
      break;
    case 'capas':
      valido = lista(
        x.partes,
        3,
        5,
        (v) => objeto(v) && texto(v.nombre, 80) && texto(v.detalle, 160),
      );
      break;
  }
  if (!valido || new TextEncoder().encode(JSON.stringify(x)).length > LIMITES.bytes - 2000)
    return null;
  return x as unknown as Pizarra;
}
/** Respaldo editorial explícito, sin fingir investigación ni datos. */
export function respaldo(idea: string): Pizarra {
  const limpio = idea.trim() || 'Una idea para compartir';
  return {
    tipo: 'idea',
    titulo: limpio.slice(0, 100),
    frase: limpio.slice(0, 240),
    analogia: 'Construyamos la explicación juntos, una pieza a la vez.',
    ejemplo: 'Ejemplo: describe un caso concreto de tu trabajo.',
    puntos: [
      '¿Qué significa esta idea?',
      '¿Cómo se conecta con lo que ya conocemos?',
      '¿Dónde podemos aplicarla?',
    ],
    fuentes: [],
  };
}
/** Conserva una ancla anterior y da espacio a lo nuevo sin crecer indefinidamente. */
export function ampliar(actual: Pizarra, nueva: Pizarra): Pizarra {
  if (actual.tipo !== nueva.tipo) {
    const aporte = nueva.tipo === 'idea' ? nueva.frase : nueva.ejemplo;
    return { ...actual, ejemplo: `${actual.ejemplo.slice(0, 100)} · ${aporte.slice(0, 130)}` };
  }
  const unir = <T>(a: T[], b: T[], max: number): T[] => {
    const todos = [...a, ...b].filter(
      (v, i, xs) => xs.findIndex((x) => JSON.stringify(x) === JSON.stringify(v)) === i,
    );
    return todos.length > max ? [todos[0]!, ...todos.slice(-(max - 1))] : todos;
  };
  switch (nueva.tipo) {
    case 'idea':
      return { ...nueva, puntos: unir((actual as typeof nueva).puntos, nueva.puntos, 5) };
    case 'mapa':
      return { ...nueva, nodos: unir((actual as typeof nueva).nodos, nueva.nodos, 7) };
    case 'pasos':
      return { ...nueva, pasos: unir((actual as typeof nueva).pasos, nueva.pasos, 7) };
    case 'linea-tiempo':
      return { ...nueva, hitos: unir((actual as typeof nueva).hitos, nueva.hitos, 7) };
    case 'capas':
      return { ...nueva, partes: unir((actual as typeof nueva).partes, nueva.partes, 5) };
    default:
      return nueva;
  }
}
export function comandoVoz(s: string): 'borrar' | 'siguiente' | 'volver' | null {
  const normal = s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();
  return (
    ({ 'borra la pizarra': 'borrar', siguiente: 'siguiente', vuelve: 'volver' } as const)[
      normal as 'siguiente'
    ] ?? null
  );
}
/** Datos de demostración identificados como tales por el puente. */
export function ejemplos(tipo: TipoPizarra): Pizarra {
  const base = {
    titulo: 'De una idea a algo que funciona',
    ejemplo: 'Ejemplo: organizar una biblioteca compartida para tu equipo.',
    fuentes: [] as Fuente[],
  };
  switch (tipo) {
    case 'idea':
      return {
        ...base,
        tipo,
        frase: 'Una idea se entiende cuando puedes usarla.',
        analogia: 'Es como un mapa: importa que te ayude a llegar.',
        puntos: ['Parte de algo conocido', 'Conecta una pieza nueva', 'Pruébala con un ejemplo'],
      };
    case 'pasos':
      return {
        ...base,
        tipo,
        pasos: [
          { texto: 'Escucha', detalle: '¿Qué necesita el equipo?' },
          { texto: 'Ordena', detalle: 'Agrupa los libros por tema.' },
          {
            texto: 'Prueba',
            detalle: 'Pide a alguien encontrar un libro.',
            alternativa: 'Si cuesta, cambia las etiquetas',
          },
          { texto: 'Mejora', detalle: 'Ajusta con lo que aprendiste.' },
        ],
      };
    case 'mapa':
      return {
        ...base,
        tipo,
        centro: 'Biblioteca compartida',
        nodos: [
          { texto: 'Personas', relacion: 'aportan ideas' },
          { texto: 'Libros', relacion: 'guardan conocimiento' },
          { texto: 'Etiquetas', relacion: 'conectan temas' },
          { texto: 'Conversaciones', relacion: 'crean aprendizajes' },
        ],
      };
    case 'comparacion':
      return {
        ...base,
        tipo,
        columnas: ['Guardar sin orden', 'Biblioteca compartida'],
        filas: [
          { criterio: 'Encontrar', celdas: ['Depende de recordar', 'Buscas por tema'] },
          { criterio: 'Aprender', celdas: ['Cada uno por separado', 'Compartes hallazgos'] },
          { criterio: 'Mantener', celdas: ['Se acumula material', 'Revisas lo que sirve'] },
        ],
      };
    case 'linea-tiempo':
      return {
        ...base,
        tipo,
        hitos: [
          { fecha: 'Primero', texto: 'El equipo comparte una necesidad.' },
          { fecha: 'Después', texto: 'Reunimos y ordenamos el material.' },
          { fecha: 'Prueba', texto: 'Buscamos juntos un libro.' },
          { fecha: 'Continuamos', texto: 'Mejoramos con cada uso.' },
        ],
      };
    case 'barras':
      return {
        ...base,
        tipo,
        titulo: 'Unidades de tiempo: números verificables',
        ejemplo: 'Ejemplo: una reunión de una hora contiene 60 minutos.',
        unidad: 'segundos',
        fuente: { titulo: 'Unidades aceptadas con el SI', dominio: 'bipm.org' },
        fuentes: [{ titulo: 'Folleto del SI', dominio: 'bipm.org' }],
        valores: [
          { nombre: 'Un minuto', valor: 60 },
          { nombre: 'Diez minutos', valor: 600 },
          { nombre: 'Una hora', valor: 3600 },
        ],
      };
    case 'capas':
      return {
        ...base,
        tipo,
        partes: [
          { nombre: 'Propósito', detalle: 'Compartir lo que sabemos.' },
          { nombre: 'Organización', detalle: 'Dar a cada libro un lugar.' },
          { nombre: 'Hábito', detalle: 'Consultar, aportar y conversar.' },
        ],
      };
  }
}
