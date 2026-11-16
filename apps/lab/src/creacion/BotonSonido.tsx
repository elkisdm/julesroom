import { useState } from 'react';
import { fijarSonido, sonidoEncendido } from './sonido';

/** Enciende o apaga los sonidos de interfaz (apagados por defecto). */
export function BotonSonido() {
  const [si, setSi] = useState(sonidoEncendido);
  return (
    <button
      className="cr-icono"
      aria-pressed={si}
      aria-label={si ? 'Apagar sonidos' : 'Encender sonidos'}
      title={si ? 'Sonidos encendidos' : 'Sonidos apagados'}
      onClick={() => {
        fijarSonido(!si);
        setSi(!si);
      }}
    >
      {si ? '♪' : '♪̸'}
    </button>
  );
}
