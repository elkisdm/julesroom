import type { Escenario, VarianteEscenario } from '@oficina/motor';
import { encuadreGeneral, FOV_VERTICAL } from '@oficina/motor';
import { paletaLuz } from '@oficina/motor';
import type { RGB } from '@oficina/motor';
import { PLANTILLAS } from '../plantillas';

export const PARAMETROS_MUNDOS = {
  vueloSegundos: 1.35,
  objetosPorTurno: 32,
  fundidoMs: 80,
  calentamientoPx: 8,
  turnoMaximoMs: 120,
  arco: 0.18,
  acercamiento: 0.12,
  deslizamientoPx: 44,
  esperaMaximaMs: 15000,
  miniaturaAncho: 480,
  miniaturaAlto: 270,
  escalaAsistente: 1.45,
  giroPorPixel: 0.003,
  giroMaximo: 0.45,
  fov: FOV_VERTICAL,
  cerca: 0.5,
  lejos: 600,
};
export type EstadoPrecarga = 'pendiente' | 'lista' | 'error';

/** Navegación circular en el orden editorial de las plantillas. */
export function navegarMundo(id: string, delta: number): string {
  const i = Math.max(
    0,
    PLANTILLAS.findIndex((p) => p.id === id),
  );
  return PLANTILLAS[(((i + delta) % PLANTILLAS.length) + PLANTILLAS.length) % PLANTILLAS.length]!
    .id;
}

export function accionDeTecla(tecla: string, modificada = false) {
  if (modificada) return null;
  const acciones: Record<string, 'anterior' | 'siguiente' | 'confirmar' | 'volver'> = {
    ArrowLeft: 'anterior',
    ArrowRight: 'siguiente',
    Enter: 'confirmar',
    Escape: 'volver',
  };
  return acciones[tecla] ?? null;
}

export function direccionDeslizamiento(x0: number, x1: number, dy: number): number {
  const dx = x1 - x0;
  return Math.abs(dx) >= PARAMETROS_MUNDOS.deslizamientoPx && Math.abs(dx) > Math.abs(dy)
    ? dx < 0
      ? 1
      : -1
    : 0;
}

/** Las cifras cambian automáticamente cuando cambia el escenario. */
export function datosMundo(e: Escenario) {
  return {
    nombre: e.nombre,
    puestos: e.planta.lugares.filter((l) => l.departamento !== null && !l.extra).length,
    zonas: e.vistas.zonas.length,
    plantas: e.planta.niveles.length,
  };
}

export function estiloMundo(variantes: readonly VarianteEscenario[], id?: string) {
  const elegida = variantes.find((v) => v.id === id) ?? variantes[0];
  const colores = elegida
    ? [
        ...new Set(
          [elegida.paleta.fondo, ...Object.values(elegida.paleta.materiales ?? {})].filter(
            (c): c is string => Boolean(c),
          ),
        ),
      ].slice(0, 3)
    : [];
  if (elegida && colores.length === 0) {
    const luz = paletaLuz(elegida.paleta.hora);
    const rgb = (c: RGB) =>
      `rgb(${Math.round(c.r * 255)} ${Math.round(c.g * 255)} ${Math.round(c.b * 255)})`;
    colores.push(...[luz.cielo.cenit, luz.sol.color, luz.interior.color].map(rgb));
  }
  return { visible: variantes.length > 1, elegida, colores };
}

/** Arco de presentación que termina en el encuadre calculado por el motor. */
export function cuadroVuelo(
  vistas: Escenario['vistas'],
  ancho: number,
  alto: number,
  progreso: number,
  reducir: boolean,
) {
  const fin = encuadreGeneral(vistas, ancho, alto);
  const t = reducir ? 1 : Math.min(1, Math.max(0, progreso));
  const resto = (1 - t) ** 3;
  const brazo = {
    x: fin.posicion.x - fin.objetivo.x,
    y: fin.posicion.y - fin.objetivo.y,
    z: fin.posicion.z - fin.objetivo.z,
  };
  const angulo = PARAMETROS_MUNDOS.arco * resto;
  const escala = 1 - PARAMETROS_MUNDOS.acercamiento * resto;
  return {
    ...fin,
    posicion: {
      x: fin.objetivo.x + (brazo.x * Math.cos(angulo) + brazo.z * Math.sin(angulo)) * escala,
      y: fin.objetivo.y + brazo.y * escala,
      z: fin.objetivo.z + (-brazo.x * Math.sin(angulo) + brazo.z * Math.cos(angulo)) * escala,
    },
  };
}

/** Órbita horizontal de exploración sobre el mismo punto de mira. */
export function cuadroExploracion(c: ReturnType<typeof cuadroVuelo>, giro: number) {
  const x = c.posicion.x - c.objetivo.x;
  const z = c.posicion.z - c.objetivo.z;
  return {
    ...c,
    posicion: {
      x: c.objetivo.x + x * Math.cos(giro) + z * Math.sin(giro),
      y: c.posicion.y,
      z: c.objetivo.z - x * Math.sin(giro) + z * Math.cos(giro),
    },
  };
}

export function giroPorArrastre(inicial: number, x0: number, x1: number) {
  return Math.max(
    -PARAMETROS_MUNDOS.giroMaximo,
    Math.min(PARAMETROS_MUNDOS.giroMaximo, inicial + (x0 - x1) * PARAMETROS_MUNDOS.giroPorPixel),
  );
}
