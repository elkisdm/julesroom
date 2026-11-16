import { useFrame } from '@react-three/fiber';
import type { MutableRefObject } from 'react';

/** Escribe `gl.info.render.calls` cada cuadro en `destino` (para Playwright / medición). */
export function MedidorDrawCalls({ destino }: { destino: MutableRefObject<number> }) {
  useFrame(({ gl }) => {
    destino.current = gl.info.render.calls;
  });
  return null;
}
