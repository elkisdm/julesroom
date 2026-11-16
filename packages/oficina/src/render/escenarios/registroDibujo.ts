/**
 * Dibujo 3D de cada escenario, registrado por el mismo id que el escenario (igual que los paquetes
 * de skins): así el contrato de datos (`escenarios/tipos.ts`) no depende de three.
 */
import type { ComponentType, MutableRefObject } from 'react';
import type { Vector3 } from 'three';
import type { Ambiente } from '../../mansion/plano';
import type { Escenario, VarianteEscenario } from '../../escenarios/tipos';
import type { Rig } from '../animador';
import type { PaletaLuz } from '../casa/luz';

/** Lo que recibe el dibujo de un escenario desde `<Oficina>`. */
export interface PropsDibujo {
  escenario: Escenario;
  /** Variante de luz y color elegida (ya resuelta: siempre una de `escenario.variantes`). */
  variante: VarianteEscenario;
  paleta: PaletaLuz;
  /** Sombras reales del sol (calidad alta en escritorio). */
  sombras: boolean;
  /** 0..1: velocidad de lo animado (menor con `prefers-reduced-motion`). */
  movimiento: number;
  rigs: MutableRefObject<Map<string, Rig>>;
  /** Ambiente al que se entró; `null` es la vista completa. */
  ambiente: Ambiente | null;
  /** Con la cámara siguiendo a la persona `seguirId`, el corte de casa se adapta a su piso. */
  seguirId?: string | null;
  /** Posición viva del orbe asistente (la misma referencia que mueve `Asistente`). */
  asistente: Vector3;
  /** Escala del asistente en reposo. */
  escalaAsistente: number;
  /** Solo para medir: omite la construcción (en la mansión, la casa) y deja el resto. */
  sinCasa: boolean;
  /**
   * Contenido que llega de fuera para una pantalla del escenario (id de `Escenario.pantallas`): un lienzo
   * o un video que el dibujo usa como textura en vez de su contenido de ejemplo. Puede cambiar en vivo.
   */
  contenidoPantallas: Readonly<Record<string, HTMLCanvasElement | HTMLVideoElement>>;
  /** El dibujo lo llama al hacer clic en lo que representa un punto de interés (`Escenario.intereses`). */
  onInteres: (id: string) => void;
}

const dibujos = new Map<string, ComponentType<PropsDibujo>>();

/** Registra el dibujo del escenario `id`; lanza si ya tiene uno. */
export function registrarDibujo(id: string, componente: ComponentType<PropsDibujo>): void {
  if (dibujos.has(id)) throw new Error(`El dibujo ya está registrado: «${id}»`);
  dibujos.set(id, componente);
}

/** El dibujo registrado para el escenario `id`, si lo hay. */
export function dibujoDe(id: string): ComponentType<PropsDibujo> | undefined {
  return dibujos.get(id);
}
