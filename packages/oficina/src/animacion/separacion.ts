/**
 * Separación suave del avatar propio respecto de otras personas y agentes. No es un muro: es un
 * empujón que crece al acercarse, para que el avatar nunca termine metido dentro de alguien.
 *
 * - Dentro de `radioAvatar + radioOtro` empuja hacia fuera con fuerza plena: si el avatar se
 *   detiene encima de alguien, se va deslizando hasta quedar a su lado.
 * - En la zona de desvío (`zonaDesvio` metros más allá) empuja menos, y solo mientras el avatar se
 *   mueve: al ir de frente contra alguien lo bordea por un lado en vez de frenar en seco.
 * - Solo mueve al avatar. Las personas remotas y los agentes NO se empujan entre sí (su posición la
 *   manda la red o su ruta), para no trabar una sala con 100.
 *
 * Todos los valores son parámetros (`PARAMETROS_SEPARACION`). Solo escribe en la salida y no asigna
 * memoria por cuadro.
 */

export interface ParametrosSeparacion {
  /** Radio (m) del cuerpo del avatar. */
  radioAvatar: number;
  /** Radio (m) del cuerpo de cualquier otra persona o agente. */
  radioOtro: number;
  /** Metros más allá del contacto en que empieza el desvío suave (solo en movimiento). */
  zonaDesvio: number;
  /** Rapidez máxima del empujón (m/s). */
  empujeMax: number;
  /** Cuánto del empujón se va de lado (para bordear) al ir de frente contra alguien. */
  fraccionLateral: number;
  /** Velocidad (m/s) con que el desvío de la zona exterior llega a su fuerza plena. */
  velocidadReferencia: number;
}

export const PARAMETROS_SEPARACION: ParametrosSeparacion = {
  radioAvatar: 0.3,
  radioOtro: 0.3,
  zonaDesvio: 0.5,
  empujeMax: 2.4,
  fraccionLateral: 0.9,
  velocidadReferencia: 1,
};

/** Posiciones de los demás en arreglos tipados reutilizables. */
export interface Otros {
  x: Float64Array;
  z: Float64Array;
  n: number;
}

export const crearOtros = (capacidad: number): Otros => ({
  x: new Float64Array(capacidad),
  z: new Float64Array(capacidad),
  n: 0,
});

export interface SalidaSeparacion {
  dx: number;
  dz: number;
}

/**
 * Desplazamiento (m) que este cuadro debe sumarse al avatar para separarse de los demás.
 * `velocidad` y la dirección de marcha (`dirX`, `dirZ`, unitaria; 0,0 si no hay) deciden el desvío.
 */
export function separacionDeAvatar(
  x: number,
  z: number,
  velocidad: number,
  otros: Otros,
  p: ParametrosSeparacion,
  dt: number,
  salida: SalidaSeparacion,
  dirX = 0,
  dirZ = 0,
): void {
  salida.dx = 0;
  salida.dz = 0;
  const minimo = p.radioAvatar + p.radioOtro;
  const alcance = minimo + p.zonaDesvio;
  const movimiento = Math.min(1, Math.max(0, velocidad / p.velocidadReferencia));
  for (let i = 0; i < otros.n; i++) {
    const rx = x - (otros.x[i] as number);
    const rz = z - (otros.z[i] as number);
    const d2 = rx * rx + rz * rz;
    if (d2 >= alcance * alcance) continue;
    const d = Math.sqrt(d2);
    // Dirección desde el otro hacia el avatar; encima exacto, una dirección fija.
    const nx = d > 1e-6 ? rx / d : 1;
    const nz = d > 1e-6 ? rz / d : 0;
    let fuerza: number;
    if (d < minimo) {
      fuerza = 1;
    } else {
      const t = (alcance - d) / p.zonaDesvio;
      fuerza = t * t * movimiento;
    }
    if (fuerza <= 0) continue;
    const empuje = p.empujeMax * fuerza * dt;
    salida.dx += nx * empuje;
    salida.dz += nz * empuje;
    // Yendo hacia el otro, parte del empujón se va de lado para bordearlo.
    const haciaOtro = -(nx * dirX + nz * dirZ);
    if (haciaOtro > 0.2 && movimiento > 0) {
      const px = -nz;
      const pz = nx;
      const lado = px * dirX + pz * dirZ >= 0 ? 1 : -1;
      const lateral = empuje * p.fraccionLateral * haciaOtro;
      salida.dx += px * lado * lateral;
      salida.dz += pz * lado * lateral;
    }
  }
  // Tope por cuadro: el empujón es suave aunque haya varios encima.
  const max = p.empujeMax * dt;
  const m = Math.hypot(salida.dx, salida.dz);
  if (m > max) {
    salida.dx *= max / m;
    salida.dz *= max / m;
  }
}
