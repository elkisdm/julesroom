/** Conserva el anclaje, pero deja el texto completo dentro de la ventana. */
export function encuadrarBurbuja(
  p: { x: number; y: number },
  ancho: number,
  alto: number,
  ventanaAncho: number,
  ventanaAlto: number,
) {
  const margen = 12;
  return {
    x: Math.max(margen + ancho / 2, Math.min(ventanaAncho - margen - ancho / 2, p.x)),
    y: Math.max(margen + alto + 18, Math.min(ventanaAlto - 180, p.y)),
  };
}
