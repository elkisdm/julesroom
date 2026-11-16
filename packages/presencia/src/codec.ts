/** Versión del formato del paquete de posición. */
export const VERSION_PAQUETE = 1;
/** Largo en bytes del paquete de posición. */
export const LARGO_PAQUETE = 19;

const DOS_PI = Math.PI * 2;

/** Estado de posición de una persona tal como viaja por la red. */
export interface PaquetePosicion {
  seq: number;
  x: number;
  y: number;
  z: number;
  /** Radianes; al codificar se normaliza a 0..2π. */
  rumbo: number;
  saltos: number;
  sentado: boolean;
}

const finito = (n: number): number => (Number.isFinite(n) ? n : 0);

/**
 * Codifica un paquete de 19 bytes (little endian): versión u8, flags u8 (bit0 sentado), seq u16,
 * x/y/z f32, rumbo u16 (0..2π), saltos u8. Los valores no finitos se sanean a 0; `seq` y `saltos` envuelven.
 * @param destino buffer de 19 bytes a reutilizar (evita asignar en cada envío).
 */
export function codificar(
  p: PaquetePosicion,
  destino: Uint8Array = new Uint8Array(LARGO_PAQUETE),
): Uint8Array {
  const vista = new DataView(destino.buffer, destino.byteOffset, LARGO_PAQUETE);
  const rumbo = ((finito(p.rumbo) % DOS_PI) + DOS_PI) % DOS_PI;
  vista.setUint8(0, VERSION_PAQUETE);
  vista.setUint8(1, p.sentado ? 1 : 0);
  vista.setUint16(2, finito(p.seq) & 0xffff, true);
  vista.setFloat32(4, finito(p.x), true);
  vista.setFloat32(8, finito(p.y), true);
  vista.setFloat32(12, finito(p.z), true);
  vista.setUint16(16, Math.round((rumbo / DOS_PI) * 65536) & 0xffff, true);
  vista.setUint8(18, finito(p.saltos) & 0xff);
  return destino;
}

/** Decodifica un paquete; devuelve `null` si el largo no es 19 o la versión no es la 1. */
export function decodificar(bytes: Uint8Array): PaquetePosicion | null {
  if (bytes.length !== LARGO_PAQUETE) return null;
  const vista = new DataView(bytes.buffer, bytes.byteOffset, LARGO_PAQUETE);
  if (vista.getUint8(0) !== VERSION_PAQUETE) return null;
  return {
    sentado: (vista.getUint8(1) & 1) === 1,
    seq: vista.getUint16(2, true),
    x: vista.getFloat32(4, true),
    y: vista.getFloat32(8, true),
    z: vista.getFloat32(12, true),
    rumbo: (vista.getUint16(16, true) / 65536) * DOS_PI,
    saltos: vista.getUint8(18),
  };
}

/** `true` si `seq` es posterior a `ultimaSeq` con aritmética circular de 16 bits (descarta repetidos y viejos). */
export function esMasNuevo(seq: number, ultimaSeq: number): boolean {
  const diferencia = (seq - ultimaSeq) & 0xffff;
  return diferencia !== 0 && diferencia < 0x8000;
}
