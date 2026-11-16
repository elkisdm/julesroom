import { validarDefinicion, type DefinicionOficina } from '../definicion/definicion';
import type { ContenidoPantalla } from '../escenarios/tipos';
import { tipoObjeto } from './catalogo';
import { LIMITES_SALA, type LimitesSala } from './limites';
import type { Giro } from './rejilla';

export interface ObjetoColocado {
  id: string;
  tipo: string;
  x: number;
  z: number;
  giro: Giro;
}

export type AjusteMueble = { x: number; z: number; giro: number } | 'quitado';

export interface MundoSala {
  /** Id de `Escenario.variantes`. */
  variante?: string;
  objetos: ObjetoColocado[];
  ajustesMuebles: Record<string, AjusteMueble>;
  /** Id de `Escenario.pantallas` → qué muestra. */
  pantallas: Record<string, ContenidoPantalla>;
  /** Id de ocupante → id de `Lugar`. */
  puestos: Record<string, string>;
}

/** Formato guardado (ADR-0012): la definición del motor más el mundo construido. */
export interface SalaGuardada extends Omit<DefinicionOficina, 'version'> {
  version: 2;
  equipo?: string;
  mundo: MundoSala;
}

const VERSION = 2;
const CONTENIDOS: readonly string[] = ['mercado', 'tablero', 'presentacion', 'video', 'agente'];

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const mundoVacio = (): MundoSala => ({
  objetos: [],
  ajustesMuebles: {},
  pantallas: {},
  puestos: {},
});

export function migrarDefinicion(d: DefinicionOficina): SalaGuardada {
  return { ...d, version: VERSION, mundo: mundoVacio() };
}

/** La proyección que consume el motor (v1, sin equipo ni mundo). */
export function aDefinicion(s: SalaGuardada): DefinicionOficina {
  const resto: Record<string, unknown> = { ...s, version: 1 };
  delete resto['equipo'];
  delete resto['mundo'];
  return resto as unknown as DefinicionOficina;
}

function erroresMundo(mundo: unknown, ocupantes: unknown, limites: LimitesSala): string[] {
  const e: string[] = [];
  if (!esObjeto(mundo)) return ['mundo: debe ser un objeto'];

  const objetos = mundo['objetos'];
  if (!Array.isArray(objetos)) e.push('mundo.objetos: debe ser una lista');
  else {
    if (objetos.length > limites.maxObjetos) {
      e.push(`mundo.objetos: hay ${objetos.length}, el máximo es ${limites.maxObjetos} objetos`);
    }
    const ids = new Set<string>();
    objetos.forEach((o: unknown, i) => {
      const donde = `mundo.objetos[${i}]`;
      if (!esObjeto(o)) return void e.push(`${donde}: debe ser un objeto`);
      if (typeof o['id'] !== 'string' || o['id'] === '')
        e.push(`${donde}.id: no puede estar vacío`);
      else if (ids.has(o['id'])) e.push(`${donde}.id: repetido «${o['id']}»`);
      else ids.add(o['id']);
      if (typeof o['tipo'] !== 'string' || !tipoObjeto(o['tipo'])) {
        e.push(`${donde}.tipo: «${String(o['tipo'])}» no está en el catálogo`);
      }
      if (!finito(o['x'])) e.push(`${donde}.x: debe ser un número`);
      if (!finito(o['z'])) e.push(`${donde}.z: debe ser un número`);
      if (![0, 1, 2, 3].includes(o['giro'] as number))
        e.push(`${donde}.giro: debe ser 0, 1, 2 o 3`);
    });
  }

  const ajustes = mundo['ajustesMuebles'];
  if (!esObjeto(ajustes)) e.push('mundo.ajustesMuebles: debe ser un objeto');
  else {
    for (const [id, a] of Object.entries(ajustes)) {
      const ok =
        a === 'quitado' || (esObjeto(a) && finito(a['x']) && finito(a['z']) && finito(a['giro']));
      if (!ok) e.push(`mundo.ajustesMuebles.${id}: debe ser «quitado» o {x, z, giro}`);
    }
  }

  const pantallas = mundo['pantallas'];
  if (!esObjeto(pantallas)) e.push('mundo.pantallas: debe ser un objeto');
  else {
    for (const [id, c] of Object.entries(pantallas)) {
      if (typeof c !== 'string' || !CONTENIDOS.includes(c)) {
        e.push(`mundo.pantallas.${id}: contenido inválido (${CONTENIDOS.join(', ')})`);
      }
    }
  }

  const puestos = mundo['puestos'];
  if (!esObjeto(puestos)) e.push('mundo.puestos: debe ser un objeto');
  else {
    const idsOcupantes = new Set(
      Array.isArray(ocupantes) ? ocupantes.map((o) => (esObjeto(o) ? o['id'] : undefined)) : [],
    );
    for (const [id, lugar] of Object.entries(puestos)) {
      if (!idsOcupantes.has(id)) e.push(`mundo.puestos: «${id}» no es un ocupante de la sala`);
      if (typeof lugar !== 'string' || lugar === '') e.push(`mundo.puestos.${id}: falta el lugar`);
    }
  }

  if (mundo['variante'] !== undefined && typeof mundo['variante'] !== 'string') {
    e.push('mundo.variante: debe ser texto');
  }
  return e;
}

/** Valida una sala desconocida. Nunca lanza. */
export function validarSala(
  entrada: unknown,
  limites: LimitesSala = LIMITES_SALA,
): { ok: boolean; errores: string[] } {
  if (!esObjeto(entrada)) return { ok: false, errores: ['La sala debe ser un objeto'] };
  const errores: string[] = [];
  if (entrada['version'] !== VERSION) errores.push(`version: solo se admite la ${VERSION}`);
  if (entrada['equipo'] !== undefined && typeof entrada['equipo'] !== 'string') {
    errores.push('equipo: debe ser texto');
  }
  const proyeccion: Record<string, unknown> = { ...entrada, version: 1 };
  delete proyeccion['equipo'];
  delete proyeccion['mundo'];
  errores.push(...validarDefinicion(proyeccion).errores);
  errores.push(...erroresMundo(entrada['mundo'], entrada['ocupantes'], limites));
  return { ok: errores.length === 0, errores };
}

export const serializarSala = (s: SalaGuardada): string => JSON.stringify(s, null, 2);

/** Lee una sala de texto: acepta v1 (la migra) y v2. Los errores vienen en español. */
export function parsearSala(
  texto: string,
  limites: LimitesSala = LIMITES_SALA,
): { ok: true; sala: SalaGuardada } | { ok: false; errores: string[] } {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return { ok: false, errores: ['El texto no es un JSON válido'] };
  }
  if (!esObjeto(crudo)) return { ok: false, errores: ['La sala debe ser un objeto'] };
  const v = crudo['version'];
  if (typeof v === 'number' && v > VERSION) {
    return {
      ok: false,
      errores: [
        `Esta sala se guardó con una versión más nueva (${v}) que la que entiende esta aplicación (${VERSION}). Actualiza para abrirla.`,
      ],
    };
  }
  if (v === 1) {
    const r = validarDefinicion(crudo);
    return r.ok
      ? { ok: true, sala: migrarDefinicion(crudo as unknown as DefinicionOficina) }
      : { ok: false, errores: r.errores };
  }
  const r = validarSala(crudo, limites);
  return r.ok
    ? { ok: true, sala: crudo as unknown as SalaGuardada }
    : { ok: false, errores: r.errores };
}
