import { accionesDe, crearFuenteSimulada, puntoDeReunion } from '@oficina/motor';
import type { AccionSentarse, Escenario } from '@oficina/motor';
import { PARAMETROS_INTERFAZ } from './interaccion';

export const PERSONAS = [
  { id: 'lucia', nombre: 'Lucía', detalle: 'En la mesa de trabajo', iniciales: 'LU' },
  { id: 'mateo', nombre: 'Mateo', detalle: 'Explorando la sala', iniciales: 'MA' },
  { id: 'sofia', nombre: 'Sofía', detalle: 'En la sala', iniciales: 'SO' },
  { id: 'nicolas', nombre: 'Nicolás', detalle: 'En la sala', iniciales: 'NI' },
  { id: 'camila', nombre: 'Camila', detalle: 'Explorando la sala', iniciales: 'CA' },
];
/** Presencia determinista compartida por escena y pruebas; las altas se agregan aparte. */
export function crearPresenciaDemo(escenario: Escenario) {
  return crearFuenteSimulada({
    cantidad: 0,
    altas: PERSONAS.map((p) => ({ id: p.id, nombre: p.nombre })),
    semilla: PARAMETROS_INTERFAZ.semilla,
    puntoLibre: (azar, i) => puntoDeReunion(escenario, i, azar),
    y: escenario.entradas[0]?.y ?? 0,
    asientos: accionesDe(escenario).filter((a): a is AccionSentarse => a.tipo === 'sentarse'),
  });
}
