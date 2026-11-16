import { zonasDeTrabajo } from '../plantillas';
import type { Escenario, SalaGuardada } from '@oficina/motor';

/** Ritmo compartido por las capas y los viajes de cámara del onboarding. */
export const PARAMETROS_FLUJO = {
  nombreMaximo: 24,
  transicionSegundos: 0.65,
  curva: 'cubic-bezier(0.333333, 0, 0.666667, 1)',
  deriva: 0.05,
  margenHoja: 10,
};
export const PASOS_FLUJO = ['sala', 'nombre', 'personaje', 'agentes', 'invitar'] as const;
export const NOMBRES_FLUJO = ['Sala', 'Nombre', 'Tú', 'Agentes', 'Entrar'] as const;

/** Valida antes de confirmar; el límite también se aplica a valores pegados. */
export function validarNombre(valor: string) {
  const limpio = valor.trim();
  const nombre = Array.from(limpio).slice(0, PARAMETROS_FLUJO.nombreMaximo).join('');
  return {
    nombre,
    valido: nombre.length > 0,
    recortado: Array.from(limpio).length > PARAMETROS_FLUJO.nombreMaximo,
  };
}
/** Filtra sin mutar el borrador ni perder a las personas de la sala. */
export function seleccionarAgentes(sala: SalaGuardada, ids: readonly string[]): SalaGuardada {
  return {
    ...sala,
    ocupantes: sala.ocupantes.filter((o) => o.tipo !== 'agente' || ids.includes(o.id)),
  };
}
export function alternarAgente(ids: readonly string[], id: string) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}
interface TeclaFlujo {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  foco?: string;
}
/** El control enfocado no cambia el significado de Enter. */
export function accionFlujo(
  e: TeclaFlujo,
  paso: string,
  foco = e.foco,
): 'seguir' | 'volver' | 'activar' | null {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.isComposing) return null;
  if (e.key === 'Enter') return 'seguir';
  if (e.key === ' ' && foco === 'BUTTON') return 'activar';
  return e.key === 'Escape' && paso !== 'llegada' ? 'volver' : null;
}
export function llegadaDisponible(estado: { terminada: boolean; fallos?: number }) {
  return estado.terminada;
}
/** Smoothstep: la misma curva cúbica que usa CSS, sin velocidad en los extremos. */
export function progresoTransicion(segundos: number, reducido = false) {
  const t = reducido ? 1 : Math.max(0, Math.min(1, segundos / PARAMETROS_FLUJO.transicionSegundos));
  return t * t * (3 - 2 * t);
}
/** Foco circular entre sugerencias; Espacio selecciona y Enter confirma. */
export function indiceAgente(actual: number, cantidad: number, tecla: 'ArrowLeft' | 'ArrowRight') {
  return cantidad ? (actual + (tecla === 'ArrowRight' ? 1 : -1) + cantidad) % cantidad : -1;
}

/** Por orden en mesas compartidas; por departamento en las habitaciones de la mansión. */
export function zonaDeAgentes(sala: SalaGuardada, escenario: Escenario): string | undefined {
  const mesa = zonasDeTrabajo(escenario)[0]?.id;
  const departamento = sala.ocupantes.find((o) => o.tipo === 'agente')?.departamento;
  return mesa ?? escenario.zonas.find((z) => z.departamento === departamento)?.id;
}

/** La escena reserva la hoja medida, sin asumir el número de líneas de sus textos. */
export function espacioHoja(alto: number) {
  return alto + PARAMETROS_FLUJO.margenHoja * 2;
}
