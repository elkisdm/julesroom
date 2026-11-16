import type { Escenario } from '../escenarios/tipos';
import { crearMapaColisionDe, crearMapaDeSuelo, puntoLibre } from '../animacion/colision';
import { alturaEn, sueloDe, SIN_SUELO } from '../escenarios/suelo';
const ESPACIO_D2 = { radio: 0.4, toleranciaAltura: 0.2 };
/** Consulta reutilizable del mismo suelo y obstáculos que usa el avatar; se crea al cambiar el mundo. */
export function espacioD2(escenario: Escenario, y: number) {
  const suelo = sueloDe(escenario);
  const mapa = suelo ? crearMapaDeSuelo(suelo) : crearMapaColisionDe(escenario, y);
  return (p: { x: number; y: number; z: number }) => {
    if (!puntoLibre(mapa, p.x, p.z, ESPACIO_D2.radio, p.y)) return false;
    if (!suelo) return true;
    const altura = alturaEn(suelo, p.x, p.z, p.y);
    return altura !== SIN_SUELO && Math.abs(altura - p.y) <= ESPACIO_D2.toleranciaAltura;
  };
}
