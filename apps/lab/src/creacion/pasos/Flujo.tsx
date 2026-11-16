import { useEffect, useRef } from 'react';
import type { Paso } from '../Crear';
import { accionFlujo, NOMBRES_FLUJO, PASOS_FLUJO } from './estadoFlujo';
import './flujo.css';

/** Captura antes de la activación nativa del control: Enter siempre confirma el paso. */
export function useTecladoFlujo(
  paso: Paso,
  seguir: () => void,
  volver?: () => void,
  activo = true,
) {
  const acciones = useRef({ seguir, volver });
  acciones.current = { seguir, volver };
  useEffect(() => {
    if (!activo) return;
    const teclado = (e: KeyboardEvent) => {
      const control = e.target as HTMLElement | null;
      const accion = accionFlujo(e, paso, control?.tagName);
      if (!accion) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (accion === 'seguir') acciones.current.seguir();
      else if (accion === 'volver') acciones.current.volver?.();
      else control?.click();
    };
    window.addEventListener('keydown', teclado, true);
    return () => window.removeEventListener('keydown', teclado, true);
  }, [paso, activo]);
}

export function Flujo({ paso, alIr }: { paso: Paso; alIr: (paso: Paso) => void }) {
  const actual = PASOS_FLUJO.findIndex((p) => p === paso);
  const volver = () => alIr(actual > 0 ? PASOS_FLUJO[actual - 1]! : 'llegada');
  useTecladoFlujo(paso, () => alIr('nombre'), volver, paso === 'sala');
  return (
    <header className="fl-cabecera">
      <button
        className="cr-boton cr-boton--chico fl-volver"
        onClick={volver}
        aria-label="Volver al paso anterior"
      >
        ← <span>Volver</span>
      </button>
      <nav className="fl-pasos" aria-label="Pasos de creación">
        {PASOS_FLUJO.map((p, i) => (
          <button
            key={p}
            disabled={i > actual}
            aria-label={`${i + 1} ${NOMBRES_FLUJO[i]}`}
            aria-current={p === paso ? 'step' : undefined}
            onClick={() => alIr(p)}
          >
            <b>{i + 1}</b>
            <span>{NOMBRES_FLUJO[i]}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
