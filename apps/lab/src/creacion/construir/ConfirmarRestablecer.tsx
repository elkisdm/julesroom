/**
 * Confirmación propia de «Volver a como venía». No usa `confirm()` del navegador.
 */
import { useEffect, useRef } from 'react';
import './restablecer.css';

interface Props {
  titulo: string;
  detalle: string;
  alConfirmar: () => void;
  alCancelar: () => void;
}

export function ConfirmarRestablecer({ titulo, detalle, alConfirmar, alCancelar }: Props) {
  const dialogo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogo.current?.focus();
  }, []);
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        alConfirmar();
      }
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [alConfirmar]);

  return (
    <div className="cr-confirmar-fondo" onClick={alCancelar}>
      <div
        ref={dialogo}
        className="cr-confirmar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cr-confirmar-titulo"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <p id="cr-confirmar-titulo">{titulo}</p>
        <p className="cr-confirmar-detalle">{detalle}</p>
        <div className="cr-confirmar-acciones">
          <button type="button" className="cr-boton" onClick={alCancelar}>
            Cancelar
          </button>
          <button type="button" className="cr-boton cr-boton--prim" onClick={alConfirmar}>
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
