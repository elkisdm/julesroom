import type { EstadoPrecarga } from './mundos';
/** La llegada depende de una sola sala, nunca del catálogo completo. */
export function estadoElegido(estados: Record<string, EstadoPrecarga>, clave: string) {
  const estado = estados[clave] ?? 'pendiente';
  return {
    terminada: estado !== 'pendiente',
    porcentaje: estado === 'pendiente' ? 0 : 100,
    fallos: estado === 'error' ? 1 : 0,
  };
}
