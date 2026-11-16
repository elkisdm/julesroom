/** Valores iniciales de la voz por cercanía (parametrizables), en metros. */
export const PARAMETROS_VOZ = { radio: 4.5, factorSalida: 1.25, distanciaPlena: 1 };

export type ParametrosVoz = typeof PARAMETROS_VOZ;

export interface Punto3 {
  x: number;
  y: number;
  z: number;
}

export interface PosicionVoz extends Punto3 {
  /** Sala cerrada en que está; dos personas en la misma sala se oyen siempre. */
  sala?: string | null;
}

const VOLUMEN_MINIMO_SALA = 0.35;

/** Distancia euclídea en 3D (la altura cuenta: otra planta queda lejos). */
export function distancia3(a: Punto3, b: Punto3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Volumen 0..1: 1 hasta `distanciaPlena`, cae de forma cuadrática hasta 0 en `radio × factorSalida`. */
export function ganancia(distancia: number, parametros: ParametrosVoz = PARAMETROS_VOZ): number {
  const salida = parametros.radio * parametros.factorSalida;
  if (distancia <= parametros.distanciaPlena) return 1;
  if (distancia >= salida) return 0;
  const t = (distancia - parametros.distanciaPlena) / (salida - parametros.distanciaPlena);
  return (1 - t) * (1 - t);
}

/**
 * Decide a quién oír y a qué volumen. Histéresis para no suscribir y desuscribir en cada cuadro:
 * quien no estaba suscrito entra a ≤ `radio`; quien ya lo estaba sale a > `radio × factorSalida`.
 * La misma sala cuenta siempre (volumen mínimo 0.35).
 */
export function planVoz(
  yo: PosicionVoz,
  otros: ReadonlyArray<PosicionVoz & { id: string }>,
  previo: ReadonlySet<string>,
  parametros: ParametrosVoz = PARAMETROS_VOZ,
): { suscritos: Set<string>; volumen: Map<string, number> } {
  const suscritos = new Set<string>();
  const volumen = new Map<string, number>();
  const limiteSalida = parametros.radio * parametros.factorSalida;

  for (const otro of otros) {
    const d = distancia3(yo, otro);
    const curva = ganancia(d, parametros);
    if (yo.sala != null && otro.sala === yo.sala) {
      suscritos.add(otro.id);
      volumen.set(otro.id, Math.max(curva, VOLUMEN_MINIMO_SALA));
      continue;
    }
    const cerca = previo.has(otro.id) ? d <= limiteSalida : d <= parametros.radio;
    if (cerca) {
      suscritos.add(otro.id);
      volumen.set(otro.id, curva);
    }
  }
  return { suscritos, volumen };
}
