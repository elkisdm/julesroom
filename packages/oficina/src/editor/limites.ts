/** Límites del editor de salas. Valores iniciales parametrizables (ADR-0012): luego se fijan desde el panel por organización. */
export interface LimitesSala {
  /** Objetos máximos que se pueden colocar. */
  maxObjetos: number;
  /** Paso de la rejilla de colocación (m). */
  paso: number;
  /** Pasos de deshacer que se recuerdan. */
  historia: number;
  /** Lado de la celda (m) de la rejilla del chequeo de paso. */
  celdaPaso: number;
  /** Ancho mínimo (m) de pasillo que debe quedar. */
  anchoPaso: number;
}

export const LIMITES_SALA: LimitesSala = {
  maxObjetos: 60,
  paso: 0.5,
  historia: 100,
  celdaPaso: 0.25,
  anchoPaso: 0.6,
};
