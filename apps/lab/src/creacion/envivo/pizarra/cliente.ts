import { validarPizarra, type Pizarra } from './modelo';
export const COMANDO_PUENTE = 'pnpm --filter @oficina/lab pizarra';
export function comandoPuente(origen: string): string {
  return origen === 'http://127.0.0.1:5381'
    ? COMANDO_PUENTE
    : `PIZARRA_ORIGEN='${new URL(origen).origin}' ${COMANDO_PUENTE}`;
}
const TIEMPOS = { saludMs: 2000, respuestaMs: 185000 };
const URL_PUENTE = 'http://127.0.0.1:5390';
export async function salud(codigo: string): Promise<{ simulada: boolean }> {
  const r = await fetch(`${URL_PUENTE}/salud`, {
    headers: { 'X-Pizarra-Codigo': codigo },
    signal: AbortSignal.timeout(TIEMPOS.saludMs),
  });
  if (!r.ok)
    throw new Error(
      r.status === 401
        ? 'El código no coincide. Copia el código que muestra la terminal.'
        : 'El puente rechazó la conexión. Revisa PIZARRA_ORIGEN.',
    );
  return r.json();
}
export async function explicar(
  codigo: string,
  idea: string,
  intencion: 'explicar' | 'investigar',
  actual?: Pizarra,
): Promise<{ pizarra: Pizarra; latenciaMs: number; simulada: boolean; respaldo: boolean }> {
  const r = await fetch(`${URL_PUENTE}/pizarra`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pizarra-Codigo': codigo },
    body: JSON.stringify({ idea, intencion, ...(actual ? { actual } : {}) }),
    signal: AbortSignal.timeout(TIEMPOS.respuestaMs),
  });
  const datos = await r.json();
  if (!r.ok) throw new Error(datos.error ?? 'No pude conectar con el puente.');
  const pizarra = validarPizarra(datos.pizarra);
  if (!pizarra) throw new Error('La explicación llegó incompleta. Intenta de nuevo.');
  return { ...datos, pizarra };
}
