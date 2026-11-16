import type { NivelCalidad } from './calidad';

/**
 * Interruptores de cada técnica gráfica. Cada nivel de calidad trae los suyos y quien monta la
 * oficina puede sobrescribir cualquiera (la página de medición del lab lo hace para comparar
 * una técnica encendida y apagada sobre la misma escena).
 */
export interface Tecnicas {
  /** Resolución adaptable según el costo de cuadro medido. */
  dprAdaptable: boolean;
  /** Caja simple en vez de la geometría completa para las personas lejanas. */
  lod: boolean;
  /** No dibujar (ni recalcular matrices de) quien está fuera de cámara. */
  descarte: boolean;
  /** Sombreado de rampa (media luz) con sombras que van a tono frío. */
  volumen: boolean;
  /** Luz de contorno (Fresnel modulado por la normal hacia arriba). */
  rim: boolean;
  /** Sombra de contacto (mancha suave) bajo cada persona. */
  blob: boolean;
  /** Contorno de casco invertido solo en quien está seleccionado o hablando. */
  contorno: boolean;
  /** Nombres sobre la cabeza (texto SDF instanciado) para cercanos y seleccionados. */
  etiquetas: boolean;
  /** Anisotropía de las texturas de atlas (caras y torsos). */
  anisotropia: number;
  /** Subir solo el rango de instancias que cambió (`addUpdateRange`). */
  rangosParciales: boolean;
}

export const TECNICAS_POR_NIVEL: Record<NivelCalidad, Tecnicas> = {
  alta: {
    dprAdaptable: true,
    lod: true,
    descarte: true,
    volumen: true,
    rim: true,
    blob: true,
    contorno: true,
    etiquetas: true,
    anisotropia: 8,
    rangosParciales: false,
  },
  media: {
    dprAdaptable: true,
    lod: true,
    descarte: true,
    volumen: true,
    rim: true,
    blob: true,
    contorno: true,
    etiquetas: true,
    anisotropia: 4,
    rangosParciales: false,
  },
  baja: {
    dprAdaptable: true,
    lod: true,
    descarte: true,
    volumen: false,
    rim: false,
    blob: true,
    contorno: false,
    etiquetas: true,
    anisotropia: 2,
    rangosParciales: false,
  },
};

/** Técnicas de un nivel con las sobrescrituras pedidas (las que no vienen quedan como el nivel). */
export function tecnicasDe(nivel: NivelCalidad, sobrescribir?: Partial<Tecnicas>): Tecnicas {
  return { ...TECNICAS_POR_NIVEL[nivel], ...sobrescribir };
}
