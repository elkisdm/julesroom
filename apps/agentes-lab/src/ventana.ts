/** Tamaño visible de la ventana (con el teclado del móvil levantado, el de `visualViewport`) y preferencias. */
export function tamanoVisible(): { ancho: number; alto: number } {
  const vv = window.visualViewport;
  return { ancho: vv?.width ?? window.innerWidth, alto: vv?.height ?? window.innerHeight };
}

export const prefiereMenosMovimiento = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Alto (px) que ocupa el compositor fijo `.barra` desde el borde inferior visible; 96 px si no se puede medir. */
export function reservaCompositor(): number {
  const barra = document.querySelector('.barra');
  if (!barra) return 96;
  const vv = window.visualViewport;
  const fondo = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight);
  const reserva = fondo - barra.getBoundingClientRect().top;
  return reserva > 0 ? Math.ceil(reserva) : 96;
}
