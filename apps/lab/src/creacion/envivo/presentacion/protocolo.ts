/** Protocolo independiente: solo la identidad firmada del dueño cambia la presentación. */
export const PARAMETROS_PRESENTACION = {
  maxLaminas: 40,
  maxBytesImagen: 200 * 1024,
  ladoMayor: 1600,
  bytesMensaje: 15000,
  caracteresTrozo: 10000,
  maxTrozos: 28,
  envioCadaMs: 60,
  reintentoMs: 3000,
  intentos: 3,
  pedirCadaMs: 2200,
  laserHz: 15,
  ancho: 6,
  anchoMin: 1.6,
  pasoReduccion: 0.2,
  distancia: 4,
  pasoMover: 0.5,
  pasoGiro: Math.PI / 12,
  marco: 0.12,
  pie: 0.45,
  profundidad: 0.3,
  margenEncuadre: 0.9,
};
export interface PosicionPantalla {
  x: number;
  y: number;
  z: number;
  giro: number;
  ancho: number;
}
export type Lamina =
  | { id: string; tipo: 'imagen'; nombre: string }
  | { id: string; tipo: 'texto'; titulo: string; lineas: string[] };
export interface EstadoPresentacion {
  tipo: 'd3/estado';
  revision: number;
  pantalla: PosicionPantalla | null;
  actual: number;
  laminas: Lamina[];
}
export interface TrozoImagen {
  tipo: 'd3/trozo';
  id: string;
  n: number;
  total: number;
  datos: string;
}
export type MensajePresentacion =
  | EstadoPresentacion
  | TrozoImagen
  | { tipo: 'd3/pedir'; id: string }
  | { tipo: 'd3/acuse'; id: string }
  | { tipo: 'd3/laser'; lamina: string; x: number; y: number; visible: boolean };
const objeto = (p: unknown): p is Record<string, unknown> => !!p && typeof p === 'object';
const texto = (p: unknown, max: number): p is string => typeof p === 'string' && p.length <= max;
const id = (p: unknown): p is string => typeof p === 'string' && /^[\w-]{1,80}$/.test(p);
const numero = (p: unknown, max = 1000): p is number =>
  typeof p === 'number' && Number.isFinite(p) && Math.abs(p) <= max;
export const estadoInicialPresentacion = (): EstadoPresentacion => ({
  tipo: 'd3/estado',
  revision: 0,
  pantalla: null,
  actual: 0,
  laminas: [],
});
/** Valida antes de reservar memoria; ni metadata ni campos del mensaje conceden autoridad. */
export function leerPresentacion(
  serial: string,
  emisor: string,
  dueno: string,
): MensajePresentacion | null {
  if (
    serial.length > PARAMETROS_PRESENTACION.bytesMensaje ||
    new TextEncoder().encode(serial).length > PARAMETROS_PRESENTACION.bytesMensaje
  )
    return null;
  let p: unknown;
  try {
    p = JSON.parse(serial);
  } catch {
    return null;
  }
  if (!objeto(p)) return null;
  if (p.tipo === 'd3/pedir' || p.tipo === 'd3/acuse')
    return texto(p.id, 80) && (p.id === '' || id(p.id)) ? (p as MensajePresentacion) : null;
  if (!dueno || emisor !== dueno) return null;
  if (p.tipo === 'd3/estado') {
    const s = p.pantalla;
    if (!(
      s === null ||
      (objeto(s) &&
        numero(s.x) &&
        numero(s.y) &&
        numero(s.z) &&
        numero(s.giro, 100) &&
        numero(s.ancho, PARAMETROS_PRESENTACION.ancho) &&
        s.ancho >= PARAMETROS_PRESENTACION.anchoMin)
    ))
      return null;
    if (
      !Number.isSafeInteger(p.revision) ||
      (p.revision as number) < 0 ||
      !Array.isArray(p.laminas) ||
      p.laminas.length > PARAMETROS_PRESENTACION.maxLaminas
    )
      return null;
    if (
      !Number.isInteger(p.actual) ||
      (p.actual as number) < 0 ||
      (p.actual as number) >= Math.max(1, p.laminas.length)
    )
      return null;
    const ids = new Set<string>();
    for (const l of p.laminas) {
      if (!objeto(l) || !id(l.id) || ids.has(l.id)) return null;
      ids.add(l.id);
      if (l.tipo === 'imagen') {
        if (!texto(l.nombre, 120)) return null;
      } else if (l.tipo === 'texto') {
        if (
          !texto(l.titulo, 90) ||
          !Array.isArray(l.lineas) ||
          l.lineas.length > 5 ||
          !l.lineas.every((s) => texto(s, 100))
        )
          return null;
      } else return null;
    }
    return p as unknown as EstadoPresentacion;
  }
  if (
    p.tipo === 'd3/trozo' &&
    id(p.id) &&
    Number.isInteger(p.n) &&
    Number.isInteger(p.total) &&
    (p.total as number) > 0 &&
    (p.total as number) <= PARAMETROS_PRESENTACION.maxTrozos &&
    (p.n as number) >= 0 &&
    (p.n as number) < (p.total as number) &&
    texto(p.datos, PARAMETROS_PRESENTACION.caracteresTrozo) &&
    /^[A-Za-z0-9+/=]+$/.test(p.datos)
  )
    return p as unknown as TrozoImagen;
  if (
    p.tipo === 'd3/laser' &&
    id(p.lamina) &&
    numero(p.x, 1) &&
    p.x >= 0 &&
    numero(p.y, 1) &&
    p.y >= 0 &&
    typeof p.visible === 'boolean'
  )
    return p as MensajePresentacion;
  return null;
}
/** JPEG en base64: el encabezado se reconstruye localmente, nunca admite una URL remota. */
export function trocearImagen(id: string, imagen: string): TrozoImagen[] {
  const datos = imagen.replace(/^data:image\/jpeg;base64,/, '');
  const total = Math.ceil(datos.length / PARAMETROS_PRESENTACION.caracteresTrozo);
  if (!datos.startsWith('/9j/') || total > PARAMETROS_PRESENTACION.maxTrozos)
    throw new Error('La imagen supera el límite de envío.');
  return Array.from({ length: total }, (_, n) => ({
    tipo: 'd3/trozo',
    id,
    n,
    total,
    datos: datos.slice(
      n * PARAMETROS_PRESENTACION.caracteresTrozo,
      (n + 1) * PARAMETROS_PRESENTACION.caracteresTrozo,
    ),
  }));
}
export function reunirImagen(trozos: TrozoImagen[]): string | null {
  const primero = trozos[0];
  if (!primero) return null;
  const partes = new Map<number, string>();
  for (const t of trozos) {
    if (t.id !== primero.id || t.total !== primero.total) return null;
    partes.set(t.n, t.datos);
  }
  if (partes.size !== primero.total) return null;
  const datos = Array.from({ length: primero.total }, (_, i) => partes.get(i) ?? '').join('');
  if (
    !datos.startsWith('/9j/') ||
    datos.length > Math.ceil(PARAMETROS_PRESENTACION.maxBytesImagen / 3) * 4
  )
    return null;
  return `data:image/jpeg;base64,${datos}`;
}
