/** Qué panel abre cada punto de interés del escenario y cuándo se cierra. Lógica pura. */
import type { ActivoId } from './analisis';

export type Panel =
  | { tipo: 'mercado'; activo: ActivoId }
  | { tipo: 'aula' }
  | { tipo: 'videos' }
  | { tipo: 'chat'; zona: 'privado' }
  | { tipo: 'agente'; puesto: number };

const ACTIVO_DE_MESA: Record<string, ActivoId> = { cripto: 'btc', forex: 'eur', materias: 'xau' };

export function panelDeInteres(id: string): Panel | null {
  if (id === 'muro') return { tipo: 'mercado', activo: 'btc' };
  if (id === 'aula') return { tipo: 'aula' };
  if (id === 'videos') return { tipo: 'videos' };
  if (id === 'privado') return { tipo: 'chat', zona: 'privado' };
  if (id.startsWith('mesa:')) {
    const activo = ACTIVO_DE_MESA[id.slice(5)];
    return activo ? { tipo: 'mercado', activo } : null;
  }
  if (id.startsWith('agente:')) {
    const n = Number(id.slice(7));
    return Number.isInteger(n) && n >= 0 ? { tipo: 'agente', puesto: n } : null;
  }
  return null;
}

export interface EstadoPanel {
  panel: Panel | null;
  /** El usuario lo fijó: no se cierra al alejarse el avatar. */
  fijado: boolean;
}

export const estadoInicial: EstadoPanel = { panel: null, fijado: false };

const mismo = (a: Panel, b: Panel) => JSON.stringify(a) === JSON.stringify(b);

/** `onInteres(id)`: abre el panel del interés; `null` cierra, salvo que esté fijado. */
export function hacerInteres(estado: EstadoPanel, id: string | null): EstadoPanel {
  if (id === null) return estado.fijado ? estado : estadoInicial;
  const panel = panelDeInteres(id);
  if (!panel) return estado;
  if (estado.panel && mismo(estado.panel, panel)) return estado;
  return { panel, fijado: false };
}

export function fijar(estado: EstadoPanel, fijado: boolean): EstadoPanel {
  if (!estado.panel || estado.fijado === fijado) return estado;
  return { ...estado, fijado };
}

export const cerrar = (): EstadoPanel => estadoInicial;

/** ¿Está abierto el panel que abre este interés? (lo que la E haría ahora es cerrarlo). */
export function panelAbierto(estado: EstadoPanel, id: string): boolean {
  const panel = panelDeInteres(id);
  return Boolean(panel && estado.panel && mismo(estado.panel, panel));
}

/** Una activación explícita alterna el panel; la cercanía sigue usando `hacerInteres`. */
export function alternarPanel(estado: EstadoPanel, id: string): EstadoPanel {
  const panel = panelDeInteres(id);
  if (!panel) return estado;
  return panelAbierto(estado, id) ? estadoInicial : { panel, fijado: false };
}
