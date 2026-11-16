import { Plane, Vector3 } from 'three';
import { corteSeguirSuave, SIN_CORTE } from './corte';

/**
 * Plano horizontal compartido por los materiales de la casa. El corte del avatar
 * tiene prioridad sobre dibujos de previsualización que pidan mostrar todos los pisos.
 */
export const planoCorte = new Plane(new Vector3(0, -1, 0), SIN_CORTE);

let corteEscena = SIN_CORTE;
let corteSeguimiento = SIN_CORTE;
Object.defineProperty(planoCorte, 'constant', {
  enumerable: true,
  configurable: true,
  get: () => Math.min(corteEscena, corteSeguimiento),
  set: (altura: number) => {
    corteEscena = altura;
  },
});

/** Prioriza el cielo del avatar activo; `null` devuelve el control al dibujo de la escena. */
export function actualizarCorteSeguimiento(y: number | null, dt: number): void {
  corteSeguimiento = y === null ? SIN_CORTE : corteSeguirSuave(corteSeguimiento, y, dt);
}
