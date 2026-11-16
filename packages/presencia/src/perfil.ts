import type { Atuendo } from '@oficina/motor';
export interface PerfilWire {
  n: string;
  a: Atuendo;
  e: string;
  s: string | null;
}
const CAMPOS = [
  'skin',
  'face',
  'hair',
  'hairColor',
  'top',
  'topColor',
  'print',
  'bottom',
  'bottomColor',
  'shoes',
] as const;
/** Los metadatos de otro cliente son entrada no confiable, igual que sus posiciones. */
export function leerPerfil(texto: string | undefined): PerfilWire | null {
  if (!texto || texto.length > 4096) return null;
  try {
    const m = JSON.parse(texto);
    if (
      !m ||
      typeof m.n !== 'string' ||
      m.n.length < 1 ||
      m.n.length > 40 ||
      typeof m.e !== 'string' ||
      m.e.length > 64 ||
      !m.a ||
      typeof m.a !== 'object'
    )
      return null;
    if (!CAMPOS.every((k) => typeof m.a[k] === 'string' && m.a[k].length <= 80)) return null;
    if (
      !Array.isArray(m.a.acc) ||
      m.a.acc.length > 20 ||
      m.a.acc.some((x: unknown) => typeof x !== 'string' || x.length > 80)
    )
      return null;
    if (m.s != null && (typeof m.s !== 'string' || m.s.length > 128)) return null;
    return { n: m.n.replace(/[\u0000-\u001f]/g, ''), a: m.a, e: m.e, s: m.s ?? null };
  } catch {
    return null;
  } // Perfil malformado: no se crea la persona hasta recibir uno válido.
}
