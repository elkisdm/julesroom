import { createContext, useContext } from 'react';
import { escenarioMansion } from '../../escenarios/mansion';
import type { Escenario } from '../../escenarios/tipos';

/** El escenario activo de la oficina; por defecto, la mansión. */
export const ContextoEscenario = createContext<Escenario>(escenarioMansion);

/** El escenario activo, para los componentes del lienzo. */
export function useEscenario(): Escenario {
  return useContext(ContextoEscenario);
}
