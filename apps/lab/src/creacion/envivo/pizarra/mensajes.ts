import { LIMITES, validarPizarra, type Pizarra } from './modelo';
export interface PosicionPizarra {
  x: number;
  y: number;
  z: number;
  giro: number;
}
export interface FotoPizarra {
  tipo: 'd8:pizarra';
  revision: number;
  pizarra: Pizarra | null;
  posicion: PosicionPizarra | null;
  estado: 'lista' | 'pensando' | 'error';
  texto: string;
}
export const PEDIR_PIZARRA = '{"tipo":"d8:pedir"}';
/** La identidad llega del transporte autenticado, nunca del cuerpo del paquete. */
export function recibirPizarra(
  texto: string,
  emisor: string,
  dueno: string,
  revision: number,
): FotoPizarra | null {
  if (!dueno || emisor !== dueno || new TextEncoder().encode(texto).length > LIMITES.bytes)
    return null;
  try {
    const p = JSON.parse(texto);
    if (
      !p ||
      p.tipo !== 'd8:pizarra' ||
      !Number.isSafeInteger(p.revision) ||
      p.revision <= revision ||
      !['lista', 'pensando', 'error'].includes(p.estado) ||
      typeof p.texto !== 'string' ||
      p.texto.length > LIMITES.idea
    )
      return null;
    if (p.pizarra !== null && !validarPizarra(p.pizarra)) return null;
    if (
      p.posicion !== null &&
      (!p.posicion ||
        !['x', 'y', 'z', 'giro'].every(
          (k) => Number.isFinite(p.posicion[k]) && Math.abs(p.posicion[k]) < 10000,
        ))
    )
      return null;
    return p;
  } catch {
    return null;
  }
}

/** Mientras piensa se transmite el subtítulo, sin repetir un gráfico que está tapado. */
export function serializarPizarra(foto: FotoPizarra): string {
  return JSON.stringify(foto.estado === 'pensando' ? { ...foto, pizarra: null } : foto);
}
