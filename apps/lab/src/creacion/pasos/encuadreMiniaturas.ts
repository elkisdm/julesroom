import type { Categoria } from './estadoPersonaje';

export const PARAMETROS_MINIATURAS = {
  cuerpo: { altura: 0.95, escala: 1.2 },
  busto: { altura: 1.48, escala: 0.48 },
  ropa: { altura: 1.05, escala: 0.67 },
  abajo: { altura: 0.35, escala: 0.48 },
};

/** Acerca cada muestra al rasgo editado; los extras conservan la silueta completa. */
export function encuadreMiniatura(campo: Categoria['id'], busto: boolean) {
  const p = PARAMETROS_MINIATURAS;
  if (busto) return p.busto;
  if (campo === 'top') return p.ropa;
  if (campo === 'bottom') return p.abajo;
  return p.cuerpo;
}
