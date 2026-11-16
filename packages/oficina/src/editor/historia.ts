export interface Historia<T> {
  pasado: T[];
  presente: T;
  futuro: T[];
}

export const crearHistoria = <T>(inicial: T): Historia<T> => ({
  pasado: [],
  presente: inicial,
  futuro: [],
});

/** Registra un estado nuevo: descarta el futuro y recorta el pasado a `tope`. El mismo estado no agrega paso. */
export function hacer<T>(h: Historia<T>, nuevo: T, tope: number): Historia<T> {
  if (nuevo === h.presente) return h;
  return { pasado: [...h.pasado, h.presente].slice(-tope), presente: nuevo, futuro: [] };
}

export const puedeDeshacer = <T>(h: Historia<T>): boolean => h.pasado.length > 0;
export const puedeRehacer = <T>(h: Historia<T>): boolean => h.futuro.length > 0;

export function deshacer<T>(h: Historia<T>): Historia<T> {
  if (!puedeDeshacer(h)) return h;
  return {
    pasado: h.pasado.slice(0, -1),
    presente: h.pasado[h.pasado.length - 1]!,
    futuro: [h.presente, ...h.futuro],
  };
}

export function rehacer<T>(h: Historia<T>): Historia<T> {
  if (!puedeRehacer(h)) return h;
  return { pasado: [...h.pasado, h.presente], presente: h.futuro[0]!, futuro: h.futuro.slice(1) };
}
