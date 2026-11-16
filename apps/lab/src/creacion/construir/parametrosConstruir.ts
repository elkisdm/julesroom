/** Distancias, tiempos y tamaños del modo construir. Nada de números sueltos en la interfaz. */
export const PARAMETROS_CONSTRUIR = {
  /** Por debajo de este ancho (px) la barra de acciones baja al muelle y la cámara se acerca. */
  anchoTelefono: 720,
  /** El fantasma sube estos píxeles sobre el dedo para que el dedo no lo tape. */
  desplazamientoDedoPx: 84,
  /**
   * Cuánto se sostiene el encuadre cenital al entrar a construir en vertical (ms).
   * Tiene que durar más que el viaje de la vista general (lerp a 2,5/s) para quedarse.
   */
  sujetarEncuadreMs: 5000,
  /** El aviso de «no cabe» se va solo. */
  avisoMs: 2600,
  /**
   * Píxeles de movimiento a partir de los cuales un presionado sobre un objeto
   * es arrastre. Por debajo es un clic: selecciona y no lo mueve.
   */
  umbralArrastrePx: 6,
  /** Objetivo táctil mínimo. */
  objetivoMinPx: 44,
  /**
   * Gestos de OrbitControls mientras se construye en teléfono.
   * Un dedo desplaza (`TOUCH.PAN` = 1); dos dedos hacen zoom y desplazan (`TOUCH.DOLLY_PAN` = 2).
   */
  toque: { unDedo: 1, dosDedos: 2 },
} as const;

/** Encuadre de construir en pantallas altas: más cenital y más cerca que la vista general. */
export const PARAMETROS_ENCUADRE_CONSTRUIR = {
  /** Alto/ancho a partir del cual aplica (390×844 y 320×640 entran; 1440×900 no). */
  aspectoVertical: 1.05,
  /** Grados sobre el horizonte. El tope de la órbita es 65. */
  elevacionGrados: 64,
  /** Tope para no pelear con el límite de la órbita. */
  elevacionMaxGrados: 64,
  /** Fracción de la vista general: más cerca, sin salir del perímetro de la sala. */
  acerca: 0.24,
  distanciaMin: 14,
  distanciaMax: 22,
} as const;
