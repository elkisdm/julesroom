/**
 * Interruptores de las técnicas de movimiento (lista «Equipo de movimiento» de
 * `investigacion-videojuegos.md`). Con todo encendido (valor por defecto) el personaje usa las
 * mejoras; apagar una devuelve el comportamiento anterior de ESA técnica, para medir y mostrar
 * qué aporta cada una (página `apps/lab/movimiento.html`). Es un objeto único y mutable: el bucle
 * lo lee en cada cuadro sin asignar memoria.
 */
export interface OpcionesMovimiento {
  /** 1. Suavizado exponencial independiente del framerate (`1 - exp(-λ·dt)`) en vez de `lerp(k·dt)`. */
  suavizadoExp: boolean;
  /** 2. Remotos: instantáneas dibujadas en el pasado (≈3 intervalos) con Hermite. */
  snapshots: boolean;
  /** 3. Avatar propio: respuesta en el mismo cuadro. Apagado, la orden llega con un retardo de red simulado. */
  prediccionAvatar: boolean;
  /** 4. Marcha por distancia (la fase avanza con lo recorrido, pies sin patinar). */
  marchaPorDistancia: boolean;
  /** 5. Resorte crítico en inclinación, altura y giro (aceleración y frenado con curvas). */
  resorteCritico: boolean;
  /** 6. Resorte subamortiguado: rebase al frenar y al aterrizar. */
  resorteRebase: boolean;
  /** 7. Cámara con zona muerta, anticipación y resorte. Apagado, sigue rígida. */
  camaraSeguimiento: boolean;
  /** 8. Presupuesto de animación en ms con importancia y tasa mínima. */
  presupuestoLod: boolean;
  /** 9. Pausa de la animación fuera de pantalla, con salto a la fase correcta al volver. */
  pausaFueraDePantalla: boolean;
  /** 10. Aplastar, estirar y anticipación sobre el torso. */
  aplastarEstirar: boolean;
  /** Extra: vida en reposo (respiración, cambio de peso, deriva de cabeza, parpadeo y gestos propios). */
  vida: boolean;
  /** Extra: transiciones suaves (sentarse con anticipación, saludo con rebase). */
  transiciones: boolean;
  /** Extra: la mirada sigue a quien habla o pasa cerca. */
  interes: boolean;
  /** Extra: el avatar propio se separa de otras personas (las bordea; no se mete dentro). */
  separacion: boolean;
  /** Caminata por poses, carrera y salto (`caminata.ts`, `salto.ts`). Apagado, la marcha de antes. */
  caminataPoses: boolean;
}

export const OPCIONES: OpcionesMovimiento = {
  suavizadoExp: true,
  snapshots: true,
  prediccionAvatar: true,
  marchaPorDistancia: true,
  resorteCritico: true,
  resorteRebase: true,
  camaraSeguimiento: true,
  presupuestoLod: true,
  pausaFueraDePantalla: true,
  aplastarEstirar: true,
  vida: true,
  transiciones: true,
  interes: true,
  separacion: true,
  caminataPoses: true,
};

/** Cambia varias opciones a la vez (la página del laboratorio, las pruebas y las mediciones). */
export function fijarOpciones(cambios: Partial<OpcionesMovimiento>): void {
  Object.assign(OPCIONES, cambios);
}

/** Todo apagado: equivale al movimiento de la línea base. */
export function apagarTodo(): void {
  for (const k of Object.keys(OPCIONES) as (keyof OpcionesMovimiento)[]) OPCIONES[k] = false;
}

export function encenderTodo(): void {
  for (const k of Object.keys(OPCIONES) as (keyof OpcionesMovimiento)[]) OPCIONES[k] = true;
}
