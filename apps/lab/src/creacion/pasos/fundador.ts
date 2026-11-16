import type { Atuendo } from '@oficina/motor';
const HASH_SHA256 = /^[a-f0-9]{64}$/i;
/** Exclusividad de interfaz, no autorización de servidor. */
export function puedeOfrecerFundador(hash: string | undefined, desbloqueado: boolean): boolean {
  return Boolean(hash && HASH_SHA256.test(hash) && desbloqueado);
}
/** El código nunca se guarda; la comparación usa Web Crypto en contexto seguro. */
export async function verificarCodigoFundador(codigo: string, hash?: string): Promise<boolean> {
  if (!codigo || !hash || !HASH_SHA256.test(hash)) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codigo));
  const recibido = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return recibido === hash.toLowerCase();
}
/** Conserva identidad; reemplaza todas las prendas del conjunto. */
export function vestirFundador(a: Atuendo): Atuendo {
  return {
    ...a,
    top: 'fundador',
    topColor: '#242830',
    bottom: 'pantalon',
    bottomColor: '#15181e',
    shoes: '#101318',
    print: '',
    acc: [],
  };
}
