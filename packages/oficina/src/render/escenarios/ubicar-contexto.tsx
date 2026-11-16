/**
 * Lleva el dibujo armado en la plantilla a los muebles de ahora (movidos o quitados).
 * Si nada cambió, el ubicador es identidad: las listas de ítems siguen siendo las mismas.
 */
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { escenarioPorId } from '../../escenarios/registro';
import type { Mueble } from '../../escenarios/tipos';
import { useEscenario } from './contexto';
import { crearUbicador } from './ubicar';
import type { Ubicador } from './ubicar';

const identidad = ((lista: readonly unknown[]) => lista) as Ubicador;
identidad.cajas = (c) => c;
identidad.grupo = () => null;

const ContextoUbicador = createContext<Ubicador>(identidad);

/** El ubicador del escenario activo. Identidad si el dibujo no está dentro del proveedor. */
export function useUbicador(): Ubicador {
  return useContext(ContextoUbicador);
}

/**
 * Compara la plantilla con los muebles visibles. `muebles` (el arrastre, todavía sin guardar) manda
 * sobre los del escenario físico.
 */
export function UbicacionDeEscenario({
  muebles,
  children,
}: {
  muebles?: readonly Mueble[] | null;
  children: ReactNode;
}) {
  const actual = useEscenario();
  const plantilla = useMemo(() => escenarioPorId(actual.id), [actual.id]);
  const destino = muebles ?? actual.planta.muebles;
  const ubicar = useMemo(
    () => crearUbicador(plantilla.planta.muebles, destino),
    [plantilla, destino],
  );
  return <ContextoUbicador.Provider value={ubicar}>{children}</ContextoUbicador.Provider>;
}

/** Grupo que sigue al mueble cuyo centro de planta es (x, z). Si se quitó, no dibuja. */
export function ConElMueble({ x, z, children }: { x: number; z: number; children: ReactNode }) {
  const ubicar = useUbicador();
  const g = ubicar.grupo(x, z);
  if (g === 'quitado') return null;
  if (!g) return children;
  return (
    <group position={[g.x, 0, g.z]} rotation={[0, g.giro, 0]}>
      {children}
    </group>
  );
}
