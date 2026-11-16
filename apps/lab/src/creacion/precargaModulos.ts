/** Un módulo por turno ocioso: nunca se evalúa todo el editor en la misma tarea. */
export const PARAMETROS_PRECARGA_MODULOS = { retardoMs: 120 } as const;
let vestidor: Promise<unknown> | null = null;
function precargarVestidor(): Promise<unknown> {
  vestidor ??= import('./pasos/Vestidor3D');
  return vestidor;
}
/** Planificador inyectable: cede antes de cada import y cancela al salir del paso. */
export function precargarEnTurnos(
  tareas: (() => Promise<unknown>)[],
  programar: (tarea: () => void) => () => void,
  informar: (error: unknown) => void = (error) =>
    console.error('No se pudo anticipar el siguiente módulo', error),
) {
  let cancelada = false;
  let indice = 0;
  let cancelarTurno = () => {};
  const siguiente = () => {
    if (cancelada || indice >= tareas.length) return;
    cancelarTurno = programar(() => {
      if (cancelada) return;
      void tareas[indice++]!().catch(informar).then(siguiente);
    });
  };
  siguiente();
  return () => {
    cancelada = true;
    cancelarTurno();
  };
}
/** Solo el próximo paso en la llegada; construir y paneles conservan sus imports diferidos. */
export function precargarTrasLlegada(): () => void {
  return precargarEnTurnos([precargarVestidor], (tarea) => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(tarea);
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(tarea, PARAMETROS_PRECARGA_MODULOS.retardoMs);
    return () => window.clearTimeout(id);
  });
}
