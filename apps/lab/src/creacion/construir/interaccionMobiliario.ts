/**
 * Lo que el modo construir necesita calcular sin React: el fantasma, la lista y el encuadre del teléfono.
 */
import { encuadreGeneral, piezasMovibles } from '@oficina/motor';
import type { AjustesMuebles, Encuadre, Escenario, EstadoColocacion, Vistas } from '@oficina/motor';
import { PARAMETROS_ENCUADRE_CONSTRUIR } from './parametrosConstruir';

export interface Huella {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface FilaMueble {
  id: string;
  nombre: string;
  estado: 'movido' | 'quitado';
}

const GRADOS = Math.PI / 180;

/** El color del fantasma a partir del motivo que devuelve el motor. */
export function estadoDeMotivo(motivo: string | null): EstadoColocacion {
  if (!motivo) return 'libre';
  const t = motivo.toLowerCase();
  if (t.includes('fuera')) return 'fuera';
  if (t.includes('camino') || t.includes('paseo')) return 'bloquea';
  return 'choca';
}

/** La huella trasladada, sin girar: el arrastre no cambia el giro. */
export function cajaDesplazada(caja: Huella, dx: number, dz: number): Huella {
  return { x0: caja.x0 + dx, x1: caja.x1 + dx, z0: caja.z0 + dz, z1: caja.z1 + dz };
}

/** Muebles de la plantilla que ya no están donde venían, para la lista «En la sala». */
export function filasDeAjustes(e: Escenario, ajustes: AjustesMuebles): FilaMueble[] {
  const nombres = new Map(piezasMovibles(e).map((p) => [p.id, p.nombre]));
  const filas: FilaMueble[] = [];
  for (const [id, a] of Object.entries(ajustes)) {
    const nombre = nombres.get(id);
    if (!nombre) continue;
    filas.push({ id, nombre, estado: a === 'quitado' ? 'quitado' : 'movido' });
  }
  return filas;
}

/** NDC del punto `desplazamientoPx` por encima del dedo. Arriba en pantalla es +y. */
export function ndcSobreElDedo(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  desplazamientoPx: number,
): { x: number; y: number } {
  const y = clientY - desplazamientoPx;
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((y - rect.top) / rect.height) * 2 + 1,
  };
}

function elevacionDe(e: Encuadre): number {
  const dx = e.posicion.x - e.objetivo.x;
  const dy = e.posicion.y - e.objetivo.y;
  const dz = e.posicion.z - e.objetivo.z;
  return Math.atan2(dy, Math.hypot(dx, dz));
}

/**
 * Encuadre de construir en vertical: mira al piso, más alto y más cerca que la vista general.
 * En horizontal devuelve null: se queda la vista que ya tiene la sala.
 */
export function encuadreConstruir(vistas: Vistas, ancho: number, alto: number): Encuadre | null {
  const p = PARAMETROS_ENCUADRE_CONSTRUIR;
  if (!(alto > ancho * p.aspectoVertical)) return null;
  const base = encuadreGeneral(vistas, ancho, alto);
  const distancia = Math.min(p.distanciaMax, Math.max(p.distanciaMin, base.distancia * p.acerca));
  const elevacion = Math.min(
    p.elevacionMaxGrados * GRADOS,
    Math.max(elevacionDe(base), p.elevacionGrados * GRADOS),
  );
  const objetivo = {
    x: (vistas.general.x0 + vistas.general.x1) / 2,
    y: vistas.general.y0 + 0.2,
    z: (vistas.general.z0 + vistas.general.z1) / 2,
  };
  return {
    objetivo,
    distancia,
    posicion: {
      x: objetivo.x,
      y: objetivo.y + distancia * Math.sin(elevacion),
      z: objetivo.z + distancia * Math.cos(elevacion),
    },
  };
}
