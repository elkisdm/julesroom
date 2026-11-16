import { useEffect, useRef } from 'react';
import { navegarBotones } from './navegacionOpciones';

/** Escucha en captura: construir detiene las flechas del avatar antes de que alcancen el DOM. */
export function useNavegacionOpciones<T extends HTMLElement>() {
  const grupo = useRef<T>(null);
  useEffect(() => {
    const alTecla = (evento: KeyboardEvent) => {
      if (grupo.current?.contains(evento.target as Node)) navegarBotones(evento, grupo.current);
    };
    window.addEventListener('keydown', alTecla, true);
    return () => window.removeEventListener('keydown', alTecla, true);
  }, []);
  return grupo;
}
