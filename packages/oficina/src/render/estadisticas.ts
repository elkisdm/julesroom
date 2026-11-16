/**
 * Contadores del último cuadro, para medir desde fuera (página de medición del lab). Se
 * reescriben en cada cuadro; leerlos no cuesta nada ni asigna.
 */
export const estadisticasGrafica = {
  personas: 0,
  descartadas: 0,
  lodSimple: 0,
  /** Piezas escritas en la flota este cuadro. */
  piezas: 0,
  /** Piezas de contorno (seleccionado / hablando) escritas este cuadro. */
  contorno: 0,
};
