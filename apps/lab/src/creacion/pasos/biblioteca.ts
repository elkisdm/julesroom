export const PARAMETROS_ENTRADA = { diaMs: 86400000 };
/** Una sola decisión primaria; la primera sala del índice es la última usada. */
export function accionLlegada(salas: readonly { nombre: string }[]) {
  return {
    principal: salas.length ? `Entrar a ${salas[0]!.nombre}` : 'Crear mi sala',
    conSalas: salas.length > 0,
  };
}
/** Fecha relativa por duración, independiente de la hora local. */
export function fechaRelativa(fecha: number, ahora = Date.now()) {
  const dias = Math.max(0, Math.floor((ahora - fecha) / PARAMETROS_ENTRADA.diaMs));
  return dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
}
/** Flechas circulares para la biblioteca. */
export function moverSala(actual: number, cantidad: number, tecla: string) {
  if (!cantidad) return -1;
  const avance = ['ArrowRight', 'ArrowDown'].includes(tecla)
    ? 1
    : ['ArrowLeft', 'ArrowUp'].includes(tecla)
      ? -1
      : 0;
  return (actual + avance + cantidad) % cantidad;
}
