import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

interface Props {
  nombre: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  onCambio: (v: number) => void;
}

const decimales = (paso: number) => Math.max(0, Math.ceil(-Math.log10(paso)));

/** Deslizador propio (no el control nativo): arrastre con puntero y flechas del teclado. */
export function Deslizador({ nombre, valor, min, max, paso, onCambio }: Props) {
  const riel = useRef<HTMLDivElement>(null);
  const fraccion = Math.min(1, Math.max(0, (valor - min) / (max - min)));
  const fijar = (v: number) => {
    const redondo = Math.round(v / paso) * paso;
    onCambio(Number(Math.min(max, Math.max(min, redondo)).toFixed(decimales(paso))));
  };
  const desdePuntero = (e: PointerEvent<HTMLDivElement>) => {
    const caja = riel.current?.getBoundingClientRect();
    if (!caja) return;
    fijar(min + ((e.clientX - caja.left) / caja.width) * (max - min));
  };
  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    const grande = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') fijar(valor + paso * grande);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') fijar(valor - paso * grande);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div className="cam-desl">
      <div className="cam-desl-cab">
        <span>{nombre}</span>
        <span className="cam-desl-valor">{valor.toFixed(decimales(paso))}</span>
      </div>
      <div
        ref={riel}
        className="cam-desl-riel"
        role="slider"
        aria-label={nombre}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={valor}
        tabIndex={0}
        onKeyDown={teclado}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          desdePuntero(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) desdePuntero(e);
        }}
      >
        <div className="cam-desl-lleno" style={{ width: `${fraccion * 100}%` }} />
        <div className="cam-desl-pomo" style={{ left: `${fraccion * 100}%` }} />
      </div>
    </div>
  );
}
