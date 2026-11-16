import { horaChile } from '../ambiente/hora';
import type { AgenteOficina, Atuendo, Departamento, EstadoAgente } from '../tipos';
import { hayEscenario, listarEscenarios } from '../escenarios/registro';
import { atuendoPorRol } from '../vestuario/roles';

export const CALIDADES = ['auto', 'alta', 'media', 'baja'] as const;
export type CalidadTema = (typeof CALIDADES)[number];

/** Un agente: lo mueve el motor (se sienta, pasea, conversa). */
export interface OcupanteAgente {
  tipo: 'agente';
  id: string;
  nombre: string;
  rol: string;
  /** Id de uno de `departamentos`: decide en qué ambiente de la casa trabaja. */
  departamento: string;
  estado?: EstadoAgente;
  /** Sin atuendo, el motor usa el del rol. */
  atuendo?: Atuendo;
}

/** Una persona humana: mismo contrato de atuendo, pero su posición llega de una fuente de presencia. */
export interface OcupantePersona {
  tipo: 'persona';
  id: string;
  nombre: string;
  atuendo?: Atuendo;
}

export type Ocupante = OcupanteAgente | OcupantePersona;

export interface TemaOficina {
  /** Hora del día en America/Santiago (0–24) para fijar la luz; sin ella, la hora actual. */
  hora?: number;
  calidad?: CalidadTema;
  /** Ids de paquetes de skins que la oficina usa (el que arma el catálogo los registra). */
  paquetes?: string[];
}

/**
 * Una oficina como datos: serializable a JSON, validable y guardable por usuario.
 * El plano es un escenario registrado en el motor (su id es `plantilla`); los ambientes son los departamentos (nombre, color y
 * quién los lidera) y los ocupantes son agentes o personas.
 */
export interface DefinicionOficina {
  version: 1;
  nombre: string;
  plano: { plantilla: string };
  departamentos: Departamento[];
  ocupantes: Ocupante[];
  tema: TemaOficina;
}

export interface Resultado {
  ok: boolean;
  errores: string[];
}

const ATUENDO_TEXTOS = [
  'skin',
  'face',
  'hair',
  'hairColor',
  'top',
  'topColor',
  'print',
  'bottom',
  'bottomColor',
  'shoes',
] as const;

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const textoNoVacio = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function errorAtuendo(a: unknown): string | null {
  if (!esObjeto(a)) return 'no es un objeto';
  for (const k of ATUENDO_TEXTOS) if (typeof a[k] !== 'string') return `«${k}» debe ser texto`;
  const acc = a['acc'];
  if (!Array.isArray(acc) || acc.some((x) => typeof x !== 'string')) {
    return '«acc» debe ser una lista de textos';
  }
  return null;
}

/** Valida una definición desconocida (p. ej. un JSON importado). Nunca lanza. */
export function validarDefinicion(entrada: unknown): Resultado {
  const errores: string[] = [];
  if (!esObjeto(entrada)) return { ok: false, errores: ['La definición debe ser un objeto'] };
  if (entrada['version'] !== 1) errores.push('version: solo se admite la 1');
  if (!textoNoVacio(entrada['nombre'])) errores.push('nombre: no puede estar vacío');

  const plano = entrada['plano'];
  if (
    !esObjeto(plano) ||
    typeof plano['plantilla'] !== 'string' ||
    !hayEscenario(plano['plantilla'])
  ) {
    const ids = listarEscenarios().map((e) => e.id);
    errores.push(`plano.plantilla: debe ser un escenario registrado (${ids.join(', ')})`);
  }

  const idsDepartamento = new Set<string>();
  const departamentos = entrada['departamentos'];
  if (!Array.isArray(departamentos) || departamentos.length === 0) {
    errores.push('departamentos: debe haber al menos uno');
  } else {
    departamentos.forEach((d: unknown, i) => {
      if (
        !esObjeto(d) ||
        !textoNoVacio(d['id']) ||
        !textoNoVacio(d['nombre']) ||
        typeof d['lider'] !== 'string' ||
        !textoNoVacio(d['color'])
      ) {
        errores.push(`departamentos[${i}]: necesita id, nombre, lider y color`);
        return;
      }
      if (idsDepartamento.has(d['id']))
        errores.push(`departamentos[${i}]: id repetido «${d['id']}»`);
      idsDepartamento.add(d['id']);
    });
  }

  const ids = new Set<string>();
  const ocupantes = entrada['ocupantes'];
  if (!Array.isArray(ocupantes)) errores.push('ocupantes: debe ser una lista');
  else {
    ocupantes.forEach((o: unknown, i) => {
      const donde = `ocupantes[${i}]`;
      if (!esObjeto(o)) return void errores.push(`${donde}: debe ser un objeto`);
      if (o['tipo'] !== 'agente' && o['tipo'] !== 'persona') {
        return void errores.push(`${donde}.tipo: debe ser «agente» o «persona»`);
      }
      if (!textoNoVacio(o['id'])) errores.push(`${donde}.id: no puede estar vacío`);
      else if (ids.has(o['id'])) errores.push(`${donde}.id: repetido «${o['id']}»`);
      else ids.add(o['id']);
      if (!textoNoVacio(o['nombre'])) errores.push(`${donde}.nombre: no puede estar vacío`);
      if (o['atuendo'] !== undefined) {
        const e = errorAtuendo(o['atuendo']);
        if (e) errores.push(`${donde}.atuendo: ${e}`);
      }
      if (o['tipo'] === 'agente') {
        if (!textoNoVacio(o['rol'])) errores.push(`${donde}.rol: no puede estar vacío`);
        if (!textoNoVacio(o['departamento']) || !idsDepartamento.has(o['departamento'])) {
          errores.push(`${donde}.departamento: «${String(o['departamento'])}» no está declarado`);
        }
      }
    });
  }

  const tema = entrada['tema'];
  if (!esObjeto(tema)) errores.push('tema: debe ser un objeto');
  else {
    const hora = tema['hora'];
    if (hora !== undefined && !(typeof hora === 'number' && hora >= 0 && hora <= 24)) {
      errores.push('tema.hora: debe estar entre 0 y 24');
    }
    const calidad = tema['calidad'];
    if (calidad !== undefined && !(CALIDADES as readonly unknown[]).includes(calidad)) {
      errores.push(`tema.calidad: debe ser una de ${CALIDADES.join(', ')}`);
    }
  }
  return { ok: errores.length === 0, errores };
}

export const serializarDefinicion = (d: DefinicionOficina): string => JSON.stringify(d, null, 2);

export type ResultadoParseo =
  | { ok: true; definicion: DefinicionOficina; errores: [] }
  | { ok: false; definicion?: undefined; errores: string[] };

/** Lee un JSON de texto y lo valida; los errores vienen en español, listos para mostrar. */
export function parsearDefinicion(texto: string): ResultadoParseo {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return { ok: false, errores: ['El texto no es un JSON válido'] };
  }
  const r = validarDefinicion(crudo);
  return r.ok
    ? { ok: true, definicion: crudo as DefinicionOficina, errores: [] }
    : { ok: false, errores: r.errores };
}

/** Una persona lista para dibujar: su atuendo ya existe; la posición la entrega la fuente de presencia. */
export interface PersonaDefinida {
  id: string;
  nombre: string;
  atuendo: Atuendo;
}

export interface PropsDeDefinicion {
  agentes: AgenteOficina[];
  personas: PersonaDefinida[];
  departamentos: Departamento[];
  calidad?: CalidadTema;
  horaChile?: Date;
  /** Id del escenario (`plano.plantilla`) para la prop `escenario` de `<Oficina>`. */
  escenario: string;
}

const ESTADO_POR_DEFECTO: EstadoAgente = 'trabajando';

/** Fecha cuya hora en Santiago es `hora` (decimal), para fijar la luz sin depender del reloj. */
export function fechaConHoraChile(hora: number): Date {
  const base = new Date(Date.UTC(2026, 5, 1, 12, 0, 0));
  return new Date(base.getTime() + (hora - horaChile(base)) * 3_600_000);
}

/** Traduce una definición validada a lo que consume `<Oficina>`. */
export function definicionAProps(d: DefinicionOficina): PropsDeDefinicion {
  const agentes: AgenteOficina[] = [];
  const personas: PersonaDefinida[] = [];
  d.ocupantes.forEach((o, i) => {
    if (o.tipo === 'agente') {
      agentes.push({
        id: o.id,
        nombre: o.nombre,
        rol: o.rol,
        departamento: o.departamento,
        estado: o.estado ?? ESTADO_POR_DEFECTO,
        atuendo: o.atuendo ?? atuendoPorRol(o.rol, agentes.length),
      });
    } else {
      personas.push({ id: o.id, nombre: o.nombre, atuendo: o.atuendo ?? atuendoPorRol('', i) });
    }
  });
  return {
    agentes,
    personas,
    departamentos: d.departamentos,
    calidad: d.tema.calidad,
    horaChile: d.tema.hora === undefined ? undefined : fechaConHoraChile(d.tema.hora),
    escenario: d.plano.plantilla,
  };
}

const DEPARTAMENTOS_EQUIPO: Departamento[] = [
  { id: 'desarrollo', nombre: 'Desarrollo', lider: 'Producto', color: '#5b7fd6' },
  { id: 'ventas', nombre: 'Ventas', lider: 'Clientes', color: '#d9825f' },
  { id: 'finanzas', nombre: 'Finanzas', lider: 'Números', color: '#79b98a' },
];

/** Ejemplo 1: un equipo de producto de día, con agentes de desarrollo, ventas y finanzas. */
export const ejemploEquipo: DefinicionOficina = {
  version: 1,
  nombre: 'Equipo de producto',
  plano: { plantilla: 'mansion' },
  departamentos: DEPARTAMENTOS_EQUIPO,
  ocupantes: [
    {
      tipo: 'agente',
      id: 'eq-1',
      nombre: 'Lía',
      rol: 'Front designer',
      departamento: 'desarrollo',
    },
    { tipo: 'agente', id: 'eq-2', nombre: 'Teo', rol: 'Backend', departamento: 'desarrollo' },
    {
      tipo: 'agente',
      id: 'eq-3',
      nombre: 'Noa',
      rol: 'QA',
      departamento: 'desarrollo',
      estado: 'esperando_decision',
    },
    {
      tipo: 'agente',
      id: 'eq-4',
      nombre: 'Aldo',
      rol: 'Ejecutivo de ventas',
      departamento: 'ventas',
    },
    {
      tipo: 'agente',
      id: 'eq-5',
      nombre: 'Sol',
      rol: 'Analista comercial',
      departamento: 'ventas',
    },
    {
      tipo: 'agente',
      id: 'eq-6',
      nombre: 'Gael',
      rol: 'Contador',
      departamento: 'finanzas',
      estado: 'libre',
    },
  ],
  tema: { hora: 11, calidad: 'auto' },
};

/** Ejemplo 2: un estudio creativo pequeño de noche, con otros departamentos y una persona. */
export const ejemploEstudio: DefinicionOficina = {
  version: 1,
  nombre: 'Estudio creativo',
  plano: { plantilla: 'mansion' },
  departamentos: [
    { id: 'contenido', nombre: 'Contenido', lider: 'Marca', color: '#b98ad6' },
    { id: 'investigacion', nombre: 'Investigación', lider: 'Ciencia', color: '#7fc4de' },
  ],
  ocupantes: [
    { tipo: 'agente', id: 'es-1', nombre: 'Maru', rol: 'Guionista', departamento: 'contenido' },
    {
      tipo: 'agente',
      id: 'es-2',
      nombre: 'Bruno',
      rol: 'Editor de video',
      departamento: 'contenido',
    },
    { tipo: 'agente', id: 'es-3', nombre: 'Ida', rol: 'Científico', departamento: 'investigacion' },
    { tipo: 'persona', id: 'es-p1', nombre: 'Dueña del estudio' },
  ],
  tema: { hora: 21.5, calidad: 'media' },
};
