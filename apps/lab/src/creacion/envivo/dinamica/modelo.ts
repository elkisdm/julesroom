export const D2 = {
  invitacionMs: 5000,
  reaccionMs: 3200,
  cuotaMs: 800,
  pasoMs: 200,
  separacion: 1,
  radio: 3,
  maxRadio: 16,
  maxPersonas: 25,
  maxPaquete: 12000,
  filaPublico: 1.3,
  arcoPublico: 1.2,
  columnasSeguimiento: 4,
  distanciaSeguimiento: 2.5,
  filaSeguimiento: 1.2,
  columnaSeguimiento: 1.1,
  umbralSeguimiento: 1,
  alturaAnfitrion: 2.65,
  alturaReaccion: 3.3,
  festejoMs: 2400,
};
export interface PuntoD2 {
  x: number;
  y: number;
  z: number;
  rumbo: number;
}
export type OrdenD2 =
  | { tipo: 'd2-llamada'; revision: number; seguir: boolean; lugares: Record<string, PuntoD2> }
  | { tipo: 'd2-parar'; revision: number };
export type MensajeD2 = OrdenD2 | { tipo: 'd2-reaccion'; reaccion: number; activa: boolean };
const punto = (p: unknown): p is PuntoD2 => {
  if (!p || typeof p !== 'object') return false;
  const q = p as PuntoD2;
  return [q.x, q.y, q.z, q.rumbo].every(
    (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000,
  );
};
/** Valida datos y autoridad usando la identidad del transporte, nunca campos del paquete. */
export function leerD2(
  texto: string,
  emisor: string,
  dueno: string,
  presentes: readonly string[],
): MensajeD2 | null {
  if (texto.length > D2.maxPaquete || !presentes.includes(emisor)) return null;
  let p: MensajeD2;
  try {
    p = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object') return null;
  if (p.tipo === 'd2-reaccion')
    return Number.isInteger(p.reaccion) &&
      p.reaccion >= 1 &&
      p.reaccion <= 5 &&
      typeof p.activa === 'boolean'
      ? p
      : null;
  if (emisor !== dueno || !('revision' in p) || !Number.isSafeInteger(p.revision) || p.revision < 1)
    return null;
  if (p.tipo === 'd2-parar') return p;
  if (
    p.tipo !== 'd2-llamada' ||
    typeof p.seguir !== 'boolean' ||
    !p.lugares ||
    typeof p.lugares !== 'object' ||
    Array.isArray(p.lugares)
  )
    return null;
  const lugares = Object.entries(p.lugares);
  return lugares.length <= D2.maxPersonas &&
    lugares.every(([id, q]) => id.length <= 100 && punto(q))
    ? p
    : null;
}
/** Semicírculos concéntricos, del centro hacia los lados; no asigna un sitio bloqueado o ya ocupado. */
export function formarPublico(
  anfitrion: PuntoD2,
  cantidad: number,
  libre: (p: PuntoD2) => boolean,
): PuntoD2[] {
  const salida: PuntoD2[] = [];
  for (
    let radio = D2.radio;
    radio <= D2.maxRadio && salida.length < cantidad;
    radio += D2.separacion * D2.filaPublico
  ) {
    const pasos = Math.floor((Math.PI * radio) / (D2.separacion * D2.arcoPublico));
    for (let i = 0; i < pasos && salida.length < cantidad; i++) {
      const angulo = anfitrion.rumbo + ((i % 2 ? -1 : 1) * Math.ceil(i / 2) * Math.PI) / pasos;
      const p = {
        x: anfitrion.x + Math.sin(angulo) * radio,
        y: anfitrion.y,
        z: anfitrion.z + Math.cos(angulo) * radio,
        rumbo: anfitrion.rumbo,
      };
      if (libre(p) && salida.every((q) => Math.hypot(q.x - p.x, q.z - p.z) >= D2.separacion))
        salida.push(p);
    }
  }
  return salida;
}
/** Una cuota independiente por emisor, con memoria acotada por el cupo de sala. */
export function crearCuota(ms: number) {
  const ultimas = new Map<string, number>();
  return (id: string, ahora: number) => {
    if (ahora - (ultimas.get(id) ?? -Infinity) < ms) return false;
    if (!ultimas.has(id) && ultimas.size >= D2.maxPersonas)
      ultimas.delete(ultimas.keys().next().value!);
    ultimas.set(id, ahora);
    return true;
  };
}
export function teclaD2(
  key: string,
  escribiendo: boolean,
  modificador: boolean,
): number | 'grabar' | 'salir' | null {
  if (escribiendo || modificador) return null;
  if (/^[1-5]$/.test(key)) return Number(key);
  if (key.toLowerCase() === 'h') return 'grabar';
  return key === 'Escape' ? 'salir' : null;
}
