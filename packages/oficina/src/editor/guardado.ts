import { parsearSala, serializarSala, type SalaGuardada } from './formato';

/** Contrato mínimo del navegador, inyectable para probar cuota y migración. */
export interface Almacen {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** Respaldo del formato anterior. Nunca se borra durante la migración. */
export const CLAVE_SALA = 'jules-room/sala/actual';
export const PARAMETROS_BIBLIOTECA = { maxSalas: 12, nombreMaximo: 80 };
const CLAVE_INDICE = 'jules-room/salas/indice';
const clave = (id: string) => `jules-room/salas/documentos/${encodeURIComponent(id)}`;
const ERROR_GUARDAR = 'No se pudo guardar en este navegador';
type Resultado = { ok: boolean; error?: string };
export interface ResumenSala {
  id: string;
  nombre: string;
  plantilla: string;
  ultimoUso: number;
  miniatura?: string;
}
interface OpcionesGuardado {
  id?: string;
  maxSalas?: number;
  ahora?: number;
  miniatura?: string;
}

function leerIndice(almacen: Almacen): ResumenSala[] | null {
  const texto = almacen.getItem(CLAVE_INDICE);
  if (texto === null) return null;
  const valor: unknown = JSON.parse(texto);
  if (
    !Array.isArray(valor) ||
    !valor.every(
      (s) =>
        s &&
        typeof s.id === 'string' &&
        s.id.length > 0 &&
        typeof s.nombre === 'string' &&
        typeof s.plantilla === 'string' &&
        Number.isFinite(s.ultimoUso) &&
        (s.miniatura === undefined || typeof s.miniatura === 'string'),
    ) ||
    new Set(valor.map((s) => s.id)).size !== valor.length
  )
    throw new Error('El índice de salas está dañado');
  return valor as ResumenSala[];
}

/** Lista por uso reciente y migra una sola vez el documento anterior, conservando su respaldo. */
export function listarSalas(almacen: Almacen): { salas: ResumenSala[]; errores: string[] } {
  try {
    let salas = leerIndice(almacen);
    if (salas === null) {
      const texto = almacen.getItem(CLAVE_SALA);
      if (!texto) return { salas: [], errores: [] };
      const r = parsearSala(texto);
      if (!r.ok) return { salas: [], errores: r.errores };
      salas = [
        {
          id: 'migrada',
          nombre: r.sala.nombre,
          plantilla: r.sala.plano.plantilla,
          ultimoUso: Date.now(),
        },
      ];
      // Primero el documento; el índice es el punto de publicación de la migración.
      try {
        almacen.setItem(clave('migrada'), serializarSala(r.sala));
        almacen.setItem(CLAVE_INDICE, JSON.stringify(salas));
      } catch {
        return {
          salas,
          errores: [
            'No se pudo migrar el guardado por falta de espacio o permisos. Tu sala anterior sigue disponible.',
          ],
        };
      }
    }
    return { salas: [...salas].sort((a, b) => b.ultimoUso - a.ultimoUso), errores: [] };
  } catch {
    return {
      salas: [],
      errores: ['No se pudo leer o preparar el índice de salas de este navegador'],
    };
  }
}

/** Guarda un documento y publica su índice; revierte el documento si falla la segunda escritura. */
export function guardarSala(
  almacen: Almacen,
  sala: SalaGuardada,
  opciones: OpcionesGuardado = {},
): Resultado {
  const lista = listarSalas(almacen);
  if (lista.errores.length) return { ok: false, error: lista.errores.join('. ') };
  const id = opciones.id ?? lista.salas[0]?.id ?? crypto.randomUUID();
  if (!id.trim()) return { ok: false, error: 'La identidad de la sala no puede estar vacía.' };
  const existe = lista.salas.some((s) => s.id === id);
  if (!existe && lista.salas.length >= (opciones.maxSalas ?? PARAMETROS_BIBLIOTECA.maxSalas))
    return { ok: false, error: 'Llegaste al máximo de salas. Elimina una para crear otra.' };
  let anterior: string | null = null;
  let escrito = false;
  try {
    anterior = almacen.getItem(clave(id));
    almacen.setItem(clave(id), serializarSala(sala));
    escrito = true;
    const resumen = {
      id,
      nombre: sala.nombre,
      plantilla: sala.plano.plantilla,
      ultimoUso: opciones.ahora ?? Date.now(),
      miniatura: opciones.miniatura ?? lista.salas.find((s) => s.id === id)?.miniatura,
    };
    almacen.setItem(
      CLAVE_INDICE,
      JSON.stringify([resumen, ...lista.salas.filter((s) => s.id !== id)]),
    );
    return { ok: true };
  } catch {
    if (escrito) {
      try {
        if (anterior === null) almacen.removeItem(clave(id));
        else almacen.setItem(clave(id), anterior);
      } catch (error) {
        console.error('No se pudo restaurar el documento de sala', error);
      }
    }
    return { ok: false, error: ERROR_GUARDAR };
  }
}

/** Lee la sala indicada o la última usada. El guardado anterior sigue legible si no hay cuota para migrar. */
export function cargarSala(
  almacen: Almacen,
  id?: string,
): { sala: SalaGuardada | null; errores: string[] } {
  const lista = listarSalas(almacen);
  try {
    const elegida = id ?? lista.salas[0]?.id;
    let texto = elegida
      ? almacen.getItem(clave(elegida))
      : !id && leerIndice(almacen) === null
        ? almacen.getItem(CLAVE_SALA)
        : null;
    if (texto === null && elegida === 'migrada' && leerIndice(almacen) === null)
      texto = almacen.getItem(CLAVE_SALA);
    if (texto === null) return { sala: null, errores: lista.errores };
    const r = parsearSala(texto);
    return r.ok ? { sala: r.sala, errores: lista.errores } : { sala: null, errores: r.errores };
  } catch {
    return { sala: null, errores: ['No se pudo leer el guardado de este navegador'] };
  }
}

/** Renombra sin alterar la fecha de último uso. */
export function renombrarSala(almacen: Almacen, id: string, nombre: string): Resultado {
  const limpio = nombre.trim();
  if (!limpio || Array.from(limpio).length > PARAMETROS_BIBLIOTECA.nombreMaximo)
    return {
      ok: false,
      error: `Escribe un nombre de hasta ${PARAMETROS_BIBLIOTECA.nombreMaximo} caracteres.`,
    };
  const resumen = listarSalas(almacen).salas.find((s) => s.id === id);
  const r = cargarSala(almacen, id);
  if (!r.sala || !resumen) return { ok: false, error: 'No se encontró la sala.' };
  return guardarSala(almacen, { ...r.sala, nombre: limpio }, { id, ahora: resumen.ultimoUso });
}

/** Quita primero del índice; si falla, el documento continúa accesible. */
export function eliminarSala(almacen: Almacen, id: string): Resultado {
  const lista = listarSalas(almacen);
  if (lista.errores.length) return { ok: false, error: lista.errores.join('. ') };
  try {
    almacen.setItem(CLAVE_INDICE, JSON.stringify(lista.salas.filter((s) => s.id !== id)));
    try {
      almacen.removeItem(clave(id));
    } catch (error) {
      almacen.setItem(CLAVE_INDICE, JSON.stringify(lista.salas));
      throw error;
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo eliminar la sala de este navegador.' };
  }
}
