import type { Planta } from '../escenarios/tipos';
import type { Punto3 } from './camara';
import type { Caja3 } from './visual';

/**
 * Primer contacto de un volumen de cámara en el segmento mira→cámara. Expandir cada
 * caja por el radio equivale a barrer un cubo conservador que contiene la esfera.
 * Devuelve Infinity si todo el segmento está libre; no muestrea y no pierde muros finos.
 */
export function distanciaLibreVolumen(
  mira: Punto3,
  camara: Punto3,
  cajas: readonly Caja3[],
  radio: number,
): number {
  const dx = camara.x - mira.x;
  const dy = camara.y - mira.y;
  const dz = camara.z - mira.z;
  const largo = Math.hypot(dx, dy, dz);
  let libre = Infinity;
  for (const c of cajas) {
    let entrada = 0;
    let salida = 1;
    for (let eje = 0; eje < 3; eje++) {
      const origen = eje === 0 ? mira.x : eje === 1 ? mira.y : mira.z;
      const delta = eje === 0 ? dx : eje === 1 ? dy : dz;
      const min = (eje === 0 ? c.x0 : eje === 1 ? c.y0 : c.z0) - radio;
      const max = (eje === 0 ? c.x1 : eje === 1 ? c.y1 : c.z1) + radio;
      if (delta === 0) {
        if (origen < min || origen > max) {
          salida = -1;
          break;
        }
      } else {
        const a = (min - origen) / delta;
        const b = (max - origen) / delta;
        entrada = Math.max(entrada, Math.min(a, b));
        salida = Math.min(salida, Math.max(a, b));
      }
    }
    if (entrada <= salida) libre = Math.min(libre, entrada * largo);
  }
  return libre;
}

/**
 * Cajas de los muros de borde de una sala de un solo nivel (ladrillo con ventanales: opacos vistos desde
 * fuera). No acortan la cámara, que puede quedar al otro lado: se desvanecen mientras tapan al avatar.
 * En la mansión el borde es vidrio y no hay nada que desvanecer.
 */
export function cajasDeEnvolvente(
  planta: Pick<Planta, 'muros' | 'niveles'>,
  alto: number,
  espesor: number,
): Caja3[] {
  if (planta.niveles.length > 1) return [];
  return planta.muros
    .filter((m) => m.tipo === 'borde')
    .map((m) =>
      m.eje === 'x'
        ? {
            x0: m.pos - espesor / 2,
            x1: m.pos + espesor / 2,
            y0: 0,
            y1: alto,
            z0: m.desde,
            z1: m.hasta,
          }
        : {
            x0: m.desde,
            x1: m.hasta,
            y0: 0,
            y1: alto,
            z0: m.pos - espesor / 2,
            z1: m.pos + espesor / 2,
          },
    );
}
