/**
 * Lo que trae cada plantilla al crear una sala: datos para mostrarla (puestos, zonas, pantallas,
 * salen del escenario) y los tres agentes sugeridos, ya vestidos según su rol. Lógica pura.
 */
import { atuendoPorRol, escenarioPorId, hayEscenario, migrarDefinicion } from '@oficina/motor';
import type {
  Atuendo,
  DefinicionOficina,
  Escenario,
  OcupanteAgente,
  SalaGuardada,
} from '@oficina/motor';

export interface AgenteSugerido {
  nombre: string;
  /** Cómo se muestra el rol. */
  rol: string;
  /** Rol del motor que decide la ropa (`rolesConocidos`). */
  look: string;
}

export interface Plantilla {
  id: string;
  /** Una línea: qué tiene la sala. */
  bajada: string;
  agentes: AgenteSugerido[];
  /** Departamento de los agentes: en la mansión, el id de su sala; en el resto da igual (`por-orden`). */
  departamento: string;
  /** El modo construir trabaja en un nivel: la mansión (varias plantas) queda fuera por ahora. */
  construible: boolean;
}

export const PLANTILLAS: readonly Plantilla[] = [
  {
    id: 'trading',
    bajada:
      'Muro de datos curvo, mesas por mercado, un aula y sala privada. De noche, con la ciudad detrás.',
    agentes: [
      { nombre: 'Nova', rol: 'Analista de mercado', look: 'Analista comercial' },
      { nombre: 'Rex', rol: 'Riesgo', look: 'Planificador' },
      { nombre: 'Ivi', rol: 'Noticias', look: 'Redactor' },
    ],
    departamento: 'mesa',
    construible: true,
  },
  {
    id: 'oficina',
    bajada:
      'Nave de ladrillo con luz de mañana: mesas por equipo, tablero, sala de reunión, cocina y lounge.',
    agentes: [
      { nombre: 'Lía', rol: 'Diseño', look: 'Front designer' },
      { nombre: 'Teo', rol: 'Desarrollo', look: 'Backend' },
      { nombre: 'Sol', rol: 'Ventas', look: 'Ejecutivo de ventas' },
    ],
    departamento: 'equipo',
    construible: true,
  },
  {
    id: 'mansion',
    bajada: 'Casa de cuatro plantas con piscina y terrazas: cada equipo en su ambiente.',
    agentes: [
      { nombre: 'Maru', rol: 'Contenido', look: 'Guionista' },
      { nombre: 'Gael', rol: 'Finanzas', look: 'Contador' },
      { nombre: 'Noa', rol: 'Calidad', look: 'QA' },
    ],
    departamento: 'desarrollo',
    construible: false,
  },
  {
    id: 'auditorio',
    bajada: 'Escenario abierto, 25 butacas y un gran espacio central para presentar y reunirse.',
    agentes: [
      { nombre: 'Nova', rol: 'Producción', look: 'Planificador' },
      { nombre: 'Rex', rol: 'Apoyo técnico', look: 'Backend' },
      { nombre: 'Ivi', rol: 'Comunidad', look: 'Community' },
    ],
    departamento: 'produccion',
    construible: true,
  },
].filter((p) => hayEscenario(p.id));

export const plantillaPorId = (id: string): Plantilla =>
  PLANTILLAS.find((p) => p.id === id) ?? (PLANTILLAS[0] as Plantilla);

/** Única condición del modo construir: la comparten el botón «Construir» y la tecla B. */
export const puedeConstruir = (paso: string, plantilla: string): boolean =>
  paso === 'dentro' && plantillaPorId(plantilla).construible;

export interface DatosPlantilla {
  nombre: string;
  puestos: number;
  zonas: number;
  pantallas: number;
}

/** Lo que se muestra al elegir: sale del contrato del escenario, no se escribe a mano. */
export function datosPlantilla(id: string): DatosPlantilla {
  const e = escenarioPorId(id);
  return {
    nombre: e.nombre,
    // Una sala con butacas para el público (auditorio) cuenta sus butacas; las demás, sus puestos.
    puestos:
      e.planta.lugares.filter((l) => l.ambiente === 'publico' && l.asiento && !l.extra).length ||
      e.planta.lugares.filter((l) => l.departamento !== null && !l.extra).length,
    zonas: e.vistas.zonas.length,
    pantallas: e.pantallas.length,
  };
}

/** Id del ocupante que eres tú (tu personaje) dentro de la sala. */
export const ID_YO = 'yo';

export function agentesDe(p: Plantilla): OcupanteAgente[] {
  return p.agentes.map((a, i) => ({
    tipo: 'agente' as const,
    id: `ag-${i + 1}`,
    nombre: a.nombre,
    rol: a.rol,
    departamento: p.departamento,
    estado: 'trabajando' as const,
    atuendo: atuendoPorRol(a.look, i),
  }));
}

/** Atuendo inicial tuyo: armado y distinto del de los agentes. */
export const atuendoInicial = (semilla: number): Atuendo => atuendoPorRol('Community', semilla);

/** Sala nueva a partir de una plantilla, con tus datos y los agentes sugeridos. */
export function salaNueva(
  plantilla: string,
  datos: { nombre: string; equipo: string; tuNombre: string; atuendo: Atuendo },
): SalaGuardada {
  const p = plantillaPorId(plantilla);
  const d: DefinicionOficina = {
    version: 1,
    nombre: datos.nombre.trim() || 'Mi sala',
    plano: { plantilla: p.id },
    departamentos: [
      { id: p.departamento, nombre: datos.equipo.trim() || 'Equipo', lider: '', color: '#e9b949' },
    ],
    ocupantes: [
      { tipo: 'persona', id: ID_YO, nombre: datos.tuNombre.trim() || 'Tú', atuendo: datos.atuendo },
      ...agentesDe(p),
    ],
    tema: { calidad: 'auto' },
  };
  return { ...migrarDefinicion(d), equipo: datos.equipo.trim() || undefined };
}

/**
 * Cambia la plantilla de una sala en curso de creación: se queda con nombres, equipo, tu personaje
 * y la variante elegida (si no existe en la plantilla nueva, `varianteActiva` cae a la primera; al
 * volver a la plantilla de origen reaparece).
 */
export function conPlantilla(sala: SalaGuardada, plantilla: string): SalaGuardada {
  const yo = sala.ocupantes.find((o) => o.id === ID_YO);
  const nueva = salaNueva(plantilla, {
    nombre: sala.nombre,
    equipo: sala.equipo ?? '',
    tuNombre: yo?.nombre ?? 'Tú',
    atuendo: yo?.atuendo ?? atuendoInicial(3),
  });
  const { variante } = sala.mundo;
  return variante === undefined ? nueva : { ...nueva, mundo: { ...nueva.mundo, variante } };
}

/** Sugerencia de nombre de sala a partir de tu nombre. */
export function nombreSugerido(tuNombre: string): string {
  const n = tuNombre.trim();
  return n ? `Sala de ${n}` : 'Sala Norte';
}

export interface ZonaDeTrabajo {
  id: string;
  nombre: string;
}

/**
 * Las mesas de trabajo del escenario, en el orden en que el motor reparte los departamentos
 * (`asignacion: 'por-orden'`: el departamento i ocupa `equipo-${i + 1}`). Vacío en la mansión.
 */
export function zonasDeTrabajo(e: Escenario): ZonaDeTrabajo[] {
  if (e.asignacion !== 'por-orden') return [];
  const n = (id: string) => Number(id.slice('equipo-'.length));
  return e.zonas
    .filter((z) => /^equipo-\d+$/.test(z.departamento ?? '') && z.id === z.departamento)
    .sort((a, b) => n(a.id) - n(b.id))
    .map((z) => ({ id: z.id, nombre: z.nombre }));
}

/** Índice de la mesa donde trabaja un agente (por el orden de su departamento). */
export function mesaDe(sala: SalaGuardada, agenteId: string): number {
  const a = sala.ocupantes.find((o) => o.id === agenteId);
  if (a?.tipo !== 'agente') return -1;
  return sala.departamentos.findIndex((d) => d.id === a.departamento);
}

/**
 * Cambia a un agente a la mesa `k`: crea los departamentos que falten hasta esa mesa (con nombre
 * «Mesa N», editables después) y le asigna el departamento k. Un índice fuera de rango no cambia nada.
 */
export function moverAgenteAMesa(
  sala: SalaGuardada,
  agenteId: string,
  k: number,
  mesas: number,
): SalaGuardada {
  if (k < 0 || k >= mesas || !sala.ocupantes.some((o) => o.id === agenteId && o.tipo === 'agente'))
    return sala;
  const departamentos = [...sala.departamentos];
  const colores = ['#e9b949', '#5b7fd6', '#d9825f', '#79b98a', '#b98ad6', '#7fc4de'];
  for (let j = departamentos.length; j <= k; j++) {
    departamentos.push({
      id: `mesa-${j + 1}`,
      nombre: `Mesa ${j + 1}`,
      lider: '',
      color: colores[j % colores.length] ?? '#e9b949',
    });
  }
  const destino = departamentos[k]?.id ?? '';
  return {
    ...sala,
    departamentos,
    ocupantes: sala.ocupantes.map((o) =>
      o.id === agenteId && o.tipo === 'agente' ? { ...o, departamento: destino } : o,
    ),
  };
}
