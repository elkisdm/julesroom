import { useRef, useState } from 'react';
import { escribirPalanca } from '@oficina/motor';
import type { Mando } from '@oficina/motor';
import { normalizarPalanca, PARAMETROS_INTERFAZ } from './interaccion';
import { Icono } from './iconos';

/** Palanca visual y alternativa de teclado: las flechas usan la misma entrada del motor. */
export function Palanca({ mando }: { mando: Mando }) {
  const [punto, moverPunto] = useState({ x: 0, y: 0 });
  const activa = useRef(false);
  const mover = (x: number, y: number, r: DOMRect) => {
    const p = normalizarPalanca(x - r.left - r.width / 2, y - r.top - r.height / 2, r.width / 2);
    moverPunto(p);
    escribirPalanca(p.x, p.y, mando);
  };
  const soltar = () => {
    activa.current = false;
    moverPunto({ x: 0, y: 0 });
    escribirPalanca(0, 0, mando);
  };
  return (
    <div className="jr-palanca-zona">
      <button
        type="button"
        className="jr-palanca"
        aria-label="Mover personaje: arrastra o usa las flechas"
        onPointerDown={(e) => {
          activa.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          mover(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
        }}
        onPointerMove={(e) => {
          if (activa.current) mover(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onLostPointerCapture={soltar}
        onBlur={soltar}
      >
        <span
          style={{
            transform: `translate(${punto.x * PARAMETROS_INTERFAZ.recorridoPalanca}px, ${punto.y * PARAMETROS_INTERFAZ.recorridoPalanca}px)`,
          }}
        >
          <Icono nombre="moverse" />
        </span>
      </button>
      <span>Moverse</span>
    </div>
  );
}
