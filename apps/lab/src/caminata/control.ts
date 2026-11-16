/** Estado compartido (mutable, sin React) entre el panel y las escenas: se lee en cada cuadro. */
export type Camara = 'juego' | 'lateral' | 'frontal' | 'atras' | 'cerca' | 'fija';
export type Vista = 'ahora' | 'antes' | 'lado';

export interface Control {
  programa: string;
  camara: Camara;
  vista: Vista;
  velocidad: number;
  pausa: boolean;
  /** Cuadros que quedan por avanzar estando en pausa (botón «cuadro»). */
  cuadros: number;
  huellas: boolean;
  teclas: { x: number; z: number; correr: boolean; saltar: boolean };
  reiniciar: { ahora: boolean; antes: boolean };
  lectura: { alto: number; velocidad: number; fase: number; salto: string };
}

export const crearControl = (): Control => ({
  programa: 'paseo',
  camara: 'juego',
  vista: 'ahora',
  velocidad: 1,
  pausa: false,
  cuadros: 0,
  huellas: true,
  teclas: { x: 0, z: 0, correr: false, saltar: false },
  reiniciar: { ahora: false, antes: false },
  lectura: { alto: 1.6, velocidad: 0, fase: 0, salto: 'suelo' },
});
