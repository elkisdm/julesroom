/** Carga diferida de objetos colocados (three + instancias); solo dentro de la sala. */
import type { ComponentProps } from 'react';
import { Objetos3D } from './Objetos3D';

export function EscenaObjetosDentro(props: ComponentProps<typeof Objetos3D>) {
  return <Objetos3D {...props} />;
}
