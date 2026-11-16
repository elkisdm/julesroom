/** Menciones `@Nombre`: a quién va un mensaje y qué sugerir mientras se escribe. Lógica pura. */

export interface Mencionable {
  id: string;
  nombre: string;
  rol: string;
}

/** Minúsculas y sin tildes: «Guía» = «guia». */
export const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface MencionEncontrada<T extends Mencionable> {
  agente: T;
  /** El mensaje sin el `@Nombre` (y sin la puntuación que lo seguía). Puede quedar vacío. */
  texto: string;
}

/** La primera mención `@Nombre` del texto que corresponde a un agente conocido. */
export function buscarMencion<T extends Mencionable>(
  texto: string,
  agentes: readonly T[],
): MencionEncontrada<T> | null {
  const re = /(^|[^\p{L}\p{N}_])@([\p{L}\p{N}_]+)/gu;
  for (const m of texto.matchAll(re)) {
    const nombre = normalizar(m[2] ?? '');
    const agente = agentes.find((a) => normalizar(a.nombre) === nombre);
    if (!agente) continue;
    const inicio = (m.index ?? 0) + (m[1]?.length ?? 0);
    const fin = inicio + 1 + (m[2]?.length ?? 0);
    const antes = texto.slice(0, inicio);
    const despues = texto.slice(fin).replace(/^[\s,:;.\-–—]+/, '');
    return { agente, texto: `${antes}${despues}`.replace(/\s{2,}/g, ' ').trim() };
  }
  return null;
}

export interface Sugerencias<T extends Mencionable> {
  /** Lo escrito tras la `@`. */
  fragmento: string;
  /** Posición de la `@` en el texto. */
  desde: number;
  lista: T[];
}

/** Sugerencias mientras se escribe `@frag` justo antes del cursor; `null` si no se está mencionando. */
export function sugerirMenciones<T extends Mencionable>(
  texto: string,
  cursor: number,
  agentes: readonly T[],
): Sugerencias<T> | null {
  const antes = texto.slice(0, cursor);
  const m = /(^|[^\p{L}\p{N}_])@([\p{L}\p{N}_]*)$/u.exec(antes);
  if (!m) return null;
  const fragmento = m[2] ?? '';
  const desde = antes.length - fragmento.length - 1;
  const f = normalizar(fragmento);
  const lista = agentes.filter((a) => normalizar(a.nombre).startsWith(f));
  return { fragmento, desde, lista };
}

/** Reemplaza el `@frag` que se estaba escribiendo por `@Nombre ` y devuelve el texto y la nueva posición del cursor. */
export function completarMencion(
  texto: string,
  cursor: number,
  s: Pick<Sugerencias<Mencionable>, 'desde'>,
  nombre: string,
): { texto: string; cursor: number } {
  const insertado = `@${nombre} `;
  return {
    texto: texto.slice(0, s.desde) + insertado + texto.slice(cursor),
    cursor: s.desde + insertado.length,
  };
}
