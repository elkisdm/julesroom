import type { SalaGuardada } from '@oficina/motor';
import { leerPaquete, type BurbujaViva } from './protocolo';
export const LIMITES_CANAL = { paquetesSegundo: 40 };
/** Enruta únicamente datos de presentes; el orden fiable nunca retrocede una respuesta. */
export function crearEnrutador(limites = LIMITES_CANAL, ahora = Date.now) {
  const tiempos = new Map<string, number[]>();
  const turnos = new Map<string, BurbujaViva>();
  const fases = { pensando: 0, texto: 1, fin: 2, error: 2 };
  return {
    recibir(texto: string, emisor: string, sala: SalaGuardada, presentes: readonly string[]) {
      for (const id of tiempos.keys())
        if (!presentes.includes(id)) {
          tiempos.delete(id);
          turnos.delete(id);
        }
      if (!presentes.includes(emisor)) return null;
      const vivos = (tiempos.get(emisor) ?? []).filter((t) => ahora() - t < 1000);
      if (vivos.length >= limites.paquetesSegundo) return null;
      tiempos.set(emisor, [...vivos, ahora()]);
      const p = leerPaquete(texto);
      if (p?.tipo === 'burbuja') {
        if (!sala.ocupantes.some((o) => o.tipo === 'agente' && o.id === p.agente)) return null;
        const antes = turnos.get(emisor);
        if (
          antes?.id === p.id &&
          (fases[p.fase] < fases[antes.fase] ||
            (p.fase === 'texto' && p.texto.length < antes.texto.length))
        )
          return null;
        turnos.set(emisor, p);
      }
      return p;
    },
  };
}
