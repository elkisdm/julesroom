/** Sin configuración completa la sala queda individual; el simulador no usa red ni claves. */
import { configuracionViva } from './configuracion';
import { crearSimulador } from '@oficina/agentes';
import type { EventoRespuesta } from '@oficina/agentes';

export const salaEnVivo = (env: Record<string, unknown>): boolean =>
  configuracionViva(env) !== null;

/** Lo que dice «Invitar» cuando no hay sala compartida; `null` si la hay (se muestra el enlace). */
export const avisoInvitar = (disponible: boolean): string | null =>
  disponible ? null : 'Por ahora entras solo. Pronto podrás traer a tu equipo.';

/** Respuesta del simulador local en el mismo formato de eventos que el servidor de agentes. */
export async function* respuestaLocal(
  agente: { nombre: string; rol: string },
  texto: string,
): AsyncGenerator<EventoRespuesta> {
  const proveedor = crearSimulador({ retardoMs: 60 });
  for await (const e of proveedor.transmitir({
    modelo: 'simulado',
    maxTokens: 0,
    sistema: `Eres ${agente.nombre}, ${agente.rol}.`,
    mensajes: [{ role: 'user', content: texto }],
  })) {
    yield e;
  }
}
