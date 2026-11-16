import { D2, crearCuota } from './modelo';
export const REACCIONES = [
  { numero: 1, icono: '👋', nombre: 'Saludar' },
  { numero: 2, icono: '👏', nombre: 'Aplaudir' },
  { numero: 3, icono: '✋', nombre: 'Levantar la mano' },
  { numero: 4, icono: '😄', nombre: 'Risa' },
  { numero: 5, icono: '👍', nombre: 'Me gusta' },
] as const;
const GRUPO = { ventanaMs: 1500, personas: 3, descansoMs: 4500 };
/** Estado efímero acotado por presentes; manos y reacción breve son independientes. */
export function crearReacciones() {
  const breves = new Map<string, { numero: number; hasta: number }>();
  const manos = new Map<string, number>();
  const aplausos = new Map<string, number>();
  const cuota = crearCuota(D2.cuotaMs);
  let festejo = -Infinity;
  return {
    recibir(id: string, numero: number, activa: boolean, ahora: number) {
      if (!cuota(id, ahora)) return false;
      if (numero === 3) {
        if (activa) {
          if (!manos.has(id)) manos.set(id, ahora);
        } else manos.delete(id);
      } else breves.set(id, { numero, hasta: ahora + D2.reaccionMs });
      if (numero !== 2) return false;
      aplausos.set(id, ahora);
      const cantidad = [...aplausos.values()].filter((t) => ahora - t <= GRUPO.ventanaMs).length;
      if (cantidad < GRUPO.personas || ahora - festejo < GRUPO.descansoMs) return false;
      festejo = ahora;
      return true;
    },
    limpiar(ahora: number, presentes: readonly string[]) {
      let cambio = false;
      for (const [id, r] of breves)
        if (r.hasta <= ahora || !presentes.includes(id)) {
          breves.delete(id);
          cambio = true;
        }
      for (const id of manos.keys())
        if (!presentes.includes(id)) {
          manos.delete(id);
          cambio = true;
        }
      for (const [id, t] of aplausos)
        if (ahora - t > GRUPO.ventanaMs || !presentes.includes(id)) aplausos.delete(id);
      return cambio;
    },
    manos: () => [...manos.keys()],
    visibles: () => breves,
  };
}
