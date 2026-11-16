import { analizar, buscarActivo, formatoPrecio } from './analisis';
import type { ActivoId } from './analisis';

/** Los cinco agentes de análisis del piso (de ejemplo), en el orden de sus puestos. */
export type Depto = 'noticias' | 'niveles' | 'escenarios' | 'riesgo' | 'alertas';

export interface AgenteSala {
  id: string;
  depto: Depto;
  titulo: string;
  rol: string;
  /** Índice de su puesto (0 a 4). */
  puesto: number;
  /** Último resultado, escrito con los números del análisis de ejemplo. */
  resultado: string;
}

export const precio = (id: ActivoId, v: number) => formatoPrecio(v, buscarActivo(id).decimales);

const DEFINICION: readonly Pick<AgenteSala, 'id' | 'depto' | 'titulo' | 'rol'>[] = [
  { id: 'noticias', depto: 'noticias', titulo: 'Noticias', rol: 'Calendario' },
  { id: 'niveles', depto: 'niveles', titulo: 'Niveles y tendencia', rol: 'Niveles' },
  { id: 'escenarios', depto: 'escenarios', titulo: 'Escenarios', rol: 'Escenarios' },
  { id: 'riesgo', depto: 'riesgo', titulo: 'Riesgo', rol: 'Riesgo' },
  { id: 'alertas', depto: 'alertas', titulo: 'Alertas', rol: 'Alertas' },
];

export const EVENTOS = [
  { hora: '09:30', titulo: 'Datos de empleo', impacto: 'alto' },
  { hora: '11:00', titulo: 'Discurso de un banco central', impacto: 'medio' },
  { hora: '14:30', titulo: 'Inventarios de energía', impacto: 'medio' },
  { hora: '16:00', titulo: 'Subasta de bonos', impacto: 'bajo' },
] as const;

function resultadoDe(depto: Depto): string {
  const btc = analizar('btc', '1h');
  switch (depto) {
    case 'noticias':
      return `${EVENTOS.length} eventos hoy, ${EVENTOS.filter((e) => e.impacto === 'alto').length} de impacto alto`;
    case 'niveles':
      return `Soporte S1 en ${precio('btc', btc.soportes[0]!.precio)}, tocado ${btc.soportes[0]!.toques} veces`;
    case 'escenarios':
      return `BTC/USDT: alcista ${btc.probabilidades.alcista} %, lateral ${btc.probabilidades.lateral} %, bajista ${btc.probabilidades.bajista} %`;
    case 'riesgo':
      return `El alcista se invalida bajo ${precio('btc', btc.escenarios.alcista.invalidez)}`;
    case 'alertas':
      return 'Ejemplo: 3 alertas recibidas hoy';
  }
}

export const AGENTES_SALA: readonly AgenteSala[] = DEFINICION.map((d, puesto) => ({
  ...d,
  puesto,
  resultado: resultadoDe(d.depto),
}));

/** El agente de un puesto; un índice fuera de rango da la vuelta (la sala puede tener más puestos). */
export const agenteDelPuesto = (puesto: number): AgenteSala =>
  AGENTES_SALA[((puesto % AGENTES_SALA.length) + AGENTES_SALA.length) % AGENTES_SALA.length]!;
