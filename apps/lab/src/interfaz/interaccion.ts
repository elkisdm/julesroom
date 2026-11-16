export const MODOS = [
  'moverse',
  'construir',
  'personas',
  'conversacion',
  'presentar',
  'ajustes',
] as const;
export type Modo = (typeof MODOS)[number];
export const PARAMETROS_INTERFAZ = {
  aviso: 3200,
  anchoMovil: 600,
  recorridoPalanca: 26,
  caracteresMensaje: 500,
  semilla: 17,
  dtMaximo: 0.05,
  muestraMovimiento: 200,
  umbralMovimiento: 0.05,
  indiceAtuendo: 2,
} as const;

/** Navegación cíclica compartida por selector, menú y pestañas. */
export function indicePorTecla(tecla: string, actual: number, cantidad: number): number | null {
  if (cantidad < 1) return null;
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return cantidad - 1;
  if (tecla === 'ArrowDown' || tecla === 'ArrowRight') return (actual + 1) % cantidad;
  if (tecla === 'ArrowUp' || tecla === 'ArrowLeft') return (actual - 1 + cantidad) % cantidad;
  return null;
}

/** Un solo modo posee el panel; activar el mismo lo pliega. */
export function cambiarModo(actual: Modo, siguiente: Modo): Modo {
  return actual === siguiente ? 'moverse' : siguiente;
}

/** Alt+n evita competir con WASD, escritura y accesos del sistema. */
export function modoPorAtajo(e: {
  key: string;
  code?: string;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  escribiendo?: boolean;
}): Modo | null {
  if (!e.altKey || e.metaKey || e.ctrlKey || e.escribiendo) return null;
  const numero = e.code?.match(/^Digit([1-6])$/)?.[1] ?? e.key;
  return MODOS[Number(numero) - 1] ?? null;
}

/** Coordenadas del pulgar limitadas al disco, independientes de su tamaño. */
export function normalizarPalanca(dx: number, dy: number, radio: number) {
  if (radio <= 0) return { x: 0, y: 0 };
  const escala = Math.max(radio, Math.hypot(dx, dy));
  return { x: dx / escala, y: dy / escala };
}

/** La conversación del prototipo solo acepta texto acotado, nunca HTML. */
export function prepararMensaje(texto: string): string | null {
  return texto.trim().slice(0, PARAMETROS_INTERFAZ.caracteresMensaje) || null;
}

/** En un viewport estrecho el avatar debe estar a la vista desde el primer cuadro. */
export function vistaInicial(ancho: number): 'seguir' | 'general' {
  return ancho <= PARAMETROS_INTERFAZ.anchoMovil ? 'seguir' : 'general';
}
