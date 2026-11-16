import { analizar } from './analisis';
import { EVENTOS, precio } from './agentes';
import type { AgenteSala, Depto } from './agentes';

/**
 * Tareas que el dueño le da a un agente desde su puesto (simuladas): el agente trabaja unos
 * segundos y deja su resultado, escrito con los números del análisis de ejemplo.
 */
export interface Tarea {
  id: string;
  texto: string;
  segundos: number;
  resultado: string;
}

export interface TareaEnCurso {
  id: string;
  texto: string;
  desde: number;
  hasta: number;
  resultado: string;
}
export interface EstadoAgente {
  tarea: TareaEnCurso | null;
  ultimo: string;
  hechas: number;
}
export type EstadoAgentes = Record<string, EstadoAgente>;
export interface Terminada {
  agenteId: string;
  tarea: string;
  resultado: string;
}

const veces = (n: number) => (n === 1 ? '1 vez' : `${n} veces`);
const pct = (n: number) => n.toString().replace('.', ',');
/** Capital de ejemplo y riesgo por operación de ejemplo. */
const CAPITAL = 10_000;
const RIESGO_POR_OPERACION = 1;

export const TAREAS: Record<Depto, () => Tarea[]> = {
  noticias: () => {
    const altos = EVENTOS.filter((e) => e.impacto === 'alto');
    return [
      {
        id: 'resumen',
        texto: 'Resume los eventos de hoy',
        segundos: 6,
        resultado: `${EVENTOS.length} eventos hoy: ${EVENTOS.map((e) => `${e.hora} ${e.titulo}`).join('; ')}.`,
      },
      {
        id: 'alto',
        texto: 'Revisa los eventos de impacto alto',
        segundos: 5,
        resultado: altos.length
          ? `${altos.length} de impacto alto. El primero: «${altos[0]!.titulo}» a las ${altos[0]!.hora}.`
          : 'Hoy no hay eventos de impacto alto.',
      },
    ];
  },
  niveles: () => {
    const eth = analizar('eth', '4h');
    const btc = analizar('btc', '1h');
    return [
      {
        id: 'eth-4h',
        texto: 'Marca los niveles de ETH/USDT en 4 h',
        segundos: 7,
        resultado: `ETH/USDT en 4 h: soporte S1 en ${precio('eth', eth.soportes[0]!.precio)} (${veces(eth.soportes[0]!.toques)}) y resistencia R1 en ${precio('eth', eth.resistencias[0]!.precio)}.`,
      },
      {
        id: 'tendencia-btc',
        texto: 'Revisa la tendencia de BTC/USDT',
        segundos: 5,
        resultado: `BTC/USDT en 1 h: tendencia ${btc.tendencia.direccion}.`,
      },
    ];
  },
  escenarios: () => {
    const btc = analizar('btc', '1h');
    const xau = analizar('xau', '4h');
    return [
      {
        id: 'btc',
        texto: 'Actualiza los escenarios de BTC/USDT',
        segundos: 7,
        resultado: `BTC/USDT: alcista ${btc.probabilidades.alcista} %, lateral ${btc.probabilidades.lateral} %, bajista ${btc.probabilidades.bajista} %. Es una estimación de ejemplo.`,
      },
      {
        id: 'xau',
        texto: 'Arma los escenarios de XAU/USD en 4 h',
        segundos: 6,
        resultado: `XAU/USD: sobre ${precio('xau', xau.escenarios.alcista.nivel)} el escenario alcista; bajo ${precio('xau', xau.escenarios.bajista.nivel)}, el bajista.`,
      },
    ];
  },
  riesgo: () => {
    const btc = analizar('btc', '1h');
    const perdida = (CAPITAL * RIESGO_POR_OPERACION) / 100;
    return [
      {
        id: 'tamano',
        texto: `Calcula la pérdida máxima con ${pct(RIESGO_POR_OPERACION)} % de riesgo`,
        segundos: 5,
        resultado: `Con ${CAPITAL.toLocaleString('es-CL')} de capital de ejemplo y ${pct(RIESGO_POR_OPERACION)} % por operación, la pérdida máxima es ${perdida.toLocaleString('es-CL')}.`,
      },
      {
        id: 'invalidez',
        texto: 'Revisa la invalidez de los escenarios de BTC/USDT',
        segundos: 6,
        resultado: `El alcista se invalida bajo ${precio('btc', btc.escenarios.alcista.invalidez)}; el bajista, sobre ${precio('btc', btc.escenarios.bajista.invalidez)}.`,
      },
    ];
  },
  alertas: () => {
    const btc = analizar('btc', '1h');
    const s1 = btc.soportes[0]!;
    return [
      {
        id: 'vigilar-s1',
        texto: 'Vigila el soporte S1 de BTC/USDT',
        segundos: 4,
        resultado: `Vigilando S1 en ${precio('btc', s1.precio)}. Avisará al tocarlo.`,
      },
      {
        id: 'revisar-alertas',
        texto: 'Revisa las alertas recibidas hoy',
        segundos: 5,
        resultado: 'Ejemplo: 3 alertas recibidas hoy, ninguna pendiente.',
      },
    ];
  },
};

export function estadoInicial(
  agentes: readonly Pick<AgenteSala, 'id' | 'resultado'>[],
): EstadoAgentes {
  return Object.fromEntries(
    agentes.map((a) => [a.id, { tarea: null, ultimo: a.resultado, hechas: 0 }]),
  );
}

/** El agente empieza la tarea ahora. Un agente que ya trabaja en otra no recibe una nueva. */
export function asignarTarea(
  estados: EstadoAgentes,
  agenteId: string,
  tarea: Tarea,
  ahora: number,
): EstadoAgentes {
  const actual = estados[agenteId];
  if (!actual) throw new Error(`Agente desconocido: ${agenteId}`);
  if (actual.tarea) throw new Error(`${agenteId} ya tiene una tarea en curso`);
  return {
    ...estados,
    [agenteId]: {
      ...actual,
      tarea: {
        id: tarea.id,
        texto: tarea.texto,
        desde: ahora,
        hasta: ahora + tarea.segundos * 1000,
        resultado: tarea.resultado,
      },
    },
  };
}

/** Cierra las tareas cumplidas. Si ninguna terminó, devuelve el mismo objeto. */
export function avanzarTareas(
  estados: EstadoAgentes,
  ahora: number,
): { estados: EstadoAgentes; terminadas: Terminada[] } {
  const terminadas: Terminada[] = [];
  let salida = estados;
  for (const [id, e] of Object.entries(estados)) {
    if (!e.tarea || e.tarea.hasta > ahora) continue;
    if (salida === estados) salida = { ...estados };
    salida[id] = { tarea: null, ultimo: e.tarea.resultado, hechas: e.hechas + 1 };
    terminadas.push({ agenteId: id, tarea: e.tarea.texto, resultado: e.tarea.resultado });
  }
  return { estados: salida, terminadas };
}

export function progresoTarea(t: TareaEnCurso, ahora: number): number {
  return Math.min(1, Math.max(0, (ahora - t.desde) / (t.hasta - t.desde)));
}
