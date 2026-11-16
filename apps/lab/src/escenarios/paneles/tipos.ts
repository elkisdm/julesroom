/** Props comunes de todo panel: lo que pide el marco `Hoja`. */
export interface PropsHoja {
  fijado: boolean;
  alFijar: (fijado: boolean) => void;
  alCerrar: () => void;
}
