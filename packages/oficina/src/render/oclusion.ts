/**
 * Oclusión de personas en la cámara que sigue al avatar: quién se interpone entre la cámara y el
 * avatar. Puro y sin asignar memoria (solo números), para llamarlo por persona y cuadro.
 *
 * Cada persona es un cilindro vertical (radio + margen, desde sus pies hasta `alto`); se interpone si
 * el segmento cámara→cabeza del avatar lo atraviesa.
 */

export interface PuntoOclusion {
  x: number;
  y: number;
  z: number;
}

/**
 * ¿La persona de pies (`px`,`py`,`pz`) tapa el segmento `camara`→`cabeza`? `radio` es el de su cuerpo
 * y `margen` la holgura que se le suma (así se desvanece antes de que el borde roce al avatar).
 */
export function ocluye(
  camara: PuntoOclusion,
  cabeza: PuntoOclusion,
  px: number,
  py: number,
  pz: number,
  radio: number,
  alto: number,
  margen: number,
): boolean {
  const dx = cabeza.x - camara.x;
  const dz = cabeza.z - camara.z;
  const largo2 = dx * dx + dz * dz;
  // Parámetro del punto del segmento (en planta) más cercano a la persona.
  let t = largo2 < 1e-9 ? 0 : ((px - camara.x) * dx + (pz - camara.z) * dz) / largo2;
  if (t < 0 || t > 1) return false;
  const ex = camara.x + dx * t - px;
  const ez = camara.z + dz * t - pz;
  const r = radio + margen;
  if (ex * ex + ez * ez > r * r) return false;
  t = Math.min(1, Math.max(0, t));
  const y = camara.y + (cabeza.y - camara.y) * t;
  return y >= py && y <= py + alto;
}

/** Quién sigue oculto un instante después de dejar de tapar: evita el parpadeo al pasar junto al borde. */
export interface MemoriaOclusion {
  /** Anota que `id` tapa en el instante `t` (s). */
  marcar(id: string, t: number): void;
  /** ¿Sigue oculta en `t`? */
  oculta(id: string, t: number): boolean;
  /** Olvida a quienes ya no están (`vigentes`). */
  olvidar(vigentes: ReadonlySet<string>): void;
}

export function crearMemoriaOclusion(retardo: number): MemoriaOclusion {
  const hasta = new Map<string, number>();
  return {
    marcar: (id, t) => {
      hasta.set(id, t + retardo);
    },
    oculta: (id, t) => (hasta.get(id) ?? -Infinity) >= t,
    olvidar: (vigentes) => {
      for (const id of hasta.keys()) if (!vigentes.has(id)) hasta.delete(id);
    },
  };
}

interface ParteVisible {
  ancla: { visible: boolean };
}

/**
 * Rescate cuando una órbita contra un muro deja la cámara dentro del cuerpo propio.
 * Oculta únicamente sus piezas instanciadas y conserva accesorios ya invisibles.
 */
export function crearOcultacionCercana() {
  const originales = new Map<ParteVisible['ancla'], boolean>();
  let partesAnteriores: readonly ParteVisible[] | null = null;
  let oculto = false;
  const restaurar = () => {
    for (const [ancla, visible] of originales) ancla.visible = visible;
    originales.clear();
    partesAnteriores = null;
    oculto = false;
  };
  return {
    restaurar,
    actualizar(
      partes: readonly ParteVisible[],
      distancia: number,
      ocultar: number,
      mostrar: number,
    ) {
      if (partesAnteriores !== partes) restaurar();
      partesAnteriores = partes;
      oculto = distancia < (oculto ? mostrar : ocultar);
      if (!oculto) {
        restaurar();
        return;
      }
      for (const { ancla } of partes) {
        if (!originales.has(ancla)) originales.set(ancla, ancla.visible);
        ancla.visible = false;
      }
    },
  };
}
