/**
 * Acciones propias de la sala de trading: las butacas del aula (no son muebles del plano: se dibujan en
 * `render/escenarios/trading/Mobiliario.tsx` y son sólidos del suelo). Miran a la pantalla (−z); se llega
 * por el frente, a la altura de la grada que haya allí.
 */
import { PARAMETROS_ACCIONES } from '../acciones';
import { alturaEn, crearSuelo } from '../suelo';
import type { AccionSentarse } from '../tipos';
import { sueloTrading } from './suelo';
import { AULA } from './plano';

/** Cara del asiento de la butaca sobre su grada (m) y retroceso de la pelvis hacia el respaldo. */
const ASIENTO_BUTACA = { cara: 0.51, pelvis: 0.52, atras: 0.04 } as const;
/** Distancia (m) delante del asiento a la que se espera para sentarse. */
const DELANTE = 0.8;

function crearAccionesAula(): AccionSentarse[] {
  const suelo = crearSuelo(sueloTrading);
  const acciones: AccionSentarse[] = [];
  AULA.filas.forEach((f, fila) => {
    AULA.butacasX.forEach((x, k) => {
      const az = f.z - DELANTE;
      acciones.push({
        id: `sentarse:butaca-${fila + 1}-${k + 1}`,
        tipo: 'sentarse',
        nombre: 'Butaca',
        x,
        z: f.z,
        y: f.y,
        radio: PARAMETROS_ACCIONES.radioSentarse,
        asiento: {
          x,
          z: f.z + ASIENTO_BUTACA.atras,
          y: f.y + ASIENTO_BUTACA.pelvis,
          yaw: Math.PI,
          aproximacion: { x, y: alturaEn(suelo, x, az, f.y), z: az },
        },
      });
    });
  });
  return acciones;
}

/** Las 12 butacas del aula (se arman una vez al importar; son datos). */
export const accionesAula: AccionSentarse[] = crearAccionesAula();
