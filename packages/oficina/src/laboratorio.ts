/**
 * Piezas sueltas del motor para las páginas del laboratorio (`apps/lab`), que afinan una técnica
 * fuera de la oficina completa: el personaje real (`Persona` + `Flota`, mismas piezas y
 * materiales), su cuerpo (`aplicarCuerpo`) con la locomoción y el salto, la luz de la casa y los
 * parámetros que se afinan con deslizadores. No es API de producto.
 */
export { Persona } from './render/Persona';
export { Flota } from './render/flota';
export { Luces } from './render/Luces';
export { paletaLuz } from './render/casa/luz';
export { aplicarCuerpo, crearEstadoCuerpo } from './render/cuerpo';
export type { EstadoCuerpo } from './render/cuerpo';
export type { Rig } from './render/animador';
export { conducir, irHacia, PARAMETROS_LOCOMOCION } from './animacion/locomocion';
export type { ParametrosLocomocion } from './animacion/locomocion';
export {
  calcularCaminata,
  crearSalidaCaminata,
  factorCarrera,
  cadencia,
  PARAMETROS_CAMINATA,
  PARAMETROS_POSE_SALTO,
} from './animacion/caminata';
export type { ParametrosCaminata } from './animacion/caminata';
export { PARAMETROS_SALTO, pedirSalto } from './animacion/salto';
export type { ParametrosSalto } from './animacion/salto';
