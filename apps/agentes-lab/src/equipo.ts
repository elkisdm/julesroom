/** El equipo de agentes tal como lo ve el motor: cada uno en su mesa de la Nave. Lógica pura. */
import type { DefinicionAgente } from '@oficina/agentes';
import type { AgenteOficina, Departamento } from '@oficina/motor';

/**
 * La Nave asigna puestos por orden (`asignacion: 'por-orden'`): el departamento número `i` de la lista usa los
 * lugares `equipo-${i + 1}` de su plano (una mesa larga por equipo; hay 4).
 */
export const DEPARTAMENTOS_SALA: Departamento[] = [1, 2, 3, 4].map((k) => ({
  id: `equipo-${k}`,
  nombre: `Equipo ${k}`,
  lider: 'Sala',
  color: ['#6d8fd6', '#d98a6a', '#7fb792', '#b08ad6'][k - 1] ?? '#6d8fd6',
}));

/** Un agente por mesa, trabajando en su escritorio hasta que alguien le hable. */
export function agentesDeEquipo(
  equipo: readonly DefinicionAgente[],
  departamentos: readonly Departamento[] = DEPARTAMENTOS_SALA,
): AgenteOficina[] {
  if (equipo.length > departamentos.length) {
    throw new Error(`Hay más agentes (${equipo.length}) que mesas (${departamentos.length})`);
  }
  return equipo.map((d, i) => ({
    id: d.id,
    nombre: d.nombre,
    rol: d.rol,
    departamento: departamentos[i]?.id ?? 'equipo-1',
    estado: 'trabajando',
  }));
}
