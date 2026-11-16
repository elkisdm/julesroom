import type { FuenteLiveKit } from '@oficina/presencia';
import { useSyncExternalStore } from 'react';

interface ConexionD2 {
  fuente: FuenteLiveKit | null;
  dueno: string;
  invitado: boolean;
  yo: string;
}
let conexion: ConexionD2 = { fuente: null, dueno: '', invitado: true, yo: '' };
const oyentes = new Set<() => void>();
/** Puente entre los hermanos Presencia, Conversacion y Dentro, sin alterar Crear/useEnVivo. */
export function conectarD2(cambio: Partial<ConexionD2>) {
  conexion = { ...conexion, ...cambio };
  for (const fn of oyentes) fn();
}
export function useConexionD2() {
  return useSyncExternalStore(
    (fn) => {
      oyentes.add(fn);
      return () => {
        oyentes.delete(fn);
      };
    },
    () => conexion,
  );
}
