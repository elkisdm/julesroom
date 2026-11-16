import { createContext, useContext } from 'react';
import type { ConfigLod } from './lod';
import { LOD_INICIAL } from './lod';
import type { Tecnicas } from '../rendimiento/tecnicas';
import { TECNICAS_POR_NIVEL } from '../rendimiento/tecnicas';

/** Lo que las piezas del render necesitan saber del nivel de calidad vigente. */
export interface ValorGrafica {
  tecnicas: Tecnicas;
  lod: ConfigLod;
  maxEtiquetas: number;
  distanciaEtiquetas: number;
}

const POR_DEFECTO: ValorGrafica = {
  tecnicas: TECNICAS_POR_NIVEL.alta,
  lod: LOD_INICIAL,
  maxEtiquetas: 40,
  distanciaEtiquetas: 22,
};

export const ContextoGrafica = createContext<ValorGrafica>(POR_DEFECTO);
export const useGrafica = (): ValorGrafica => useContext(ContextoGrafica);
