/**
 * Pose sentada sobre un rig ya posado (avatar propio y personas remotas sentadas): mezcla las piernas, los
 * brazos, la pelvis y el torso con la pose sentada de los agentes (`calcularPose` con postura `sentado`).
 * Se llama DESPUÉS de `aplicarCuerpo`, que escribe la marcha o el reposo de pie; con `peso` 0 no cambia nada.
 *
 * Alturas: sentada, la raíz del rig baja `PELVIS_DE_PIE − PELVIS_SENTADA` (0,17) respecto de los pies y la
 * pelvis queda en el asiento. El avatar lleva esa altura en `Avatar.yRaiz`; una persona remota la saca
 * `posarRemota` (su `y` es el asiento mientras esté sentada).
 *
 * Lo de las remotas (`crearSentadasRemotas`, `posarRemota`) lleva un peso por persona para que entre y salga
 * del asiento con transición en el cliente, aunque la presencia llegue a 10 Hz. No asigna al repetirse.
 */
import { calcularPose, crearPose } from '../animacion/articulaciones';
import { PELVIS_DE_PIE, PELVIS_SENTADA } from '../animacion/sentarse';
import {
  avanzarPeso,
  crearSalidaSentarse,
  curvaSentarse,
  type SalidaSentarse,
} from '../animacion/transicion';
import type { Rig } from './animador';

/** Segundos de la transición de una persona remota al sentarse o levantarse. */
export const DURACION_SENTADA_REMOTA = 0.8;

const POSE = calcularPose({ fase: 0, postura: 'sentado', velocidad: 0, t: 0 }, crearPose());
const BAJA = PELVIS_DE_PIE - PELVIS_SENTADA;

const lerp = (a: number, b: number, w: number) => a + (b - a) * w;

/** Lleva el rig hacia la pose sentada en `pesoSentado` (0 de pie … 1 sentado) con el torso inclinado `inclinacion` rad. */
export function posarSentado(rig: Rig, pesoSentado: number, inclinacion: number): void {
  const w = pesoSentado < 0 ? 0 : pesoSentado > 1 ? 1 : pesoSentado;
  if (w === 0 && inclinacion === 0) return;
  const resto = 1 - w;
  for (let k = 0; k < 2; k++) {
    const pierna = rig.piernas[k as 0 | 1];
    const p = POSE.piernas[k as 0 | 1];
    pierna.cadera.rotation.x = lerp(pierna.cadera.rotation.x, p.cadera, w);
    pierna.cadera.rotation.y *= resto;
    pierna.cadera.rotation.z *= resto;
    pierna.rodilla.rotation.x = lerp(pierna.rodilla.rotation.x, p.rodilla, w);
    const brazo = rig.brazos[k as 0 | 1];
    const b = POSE.brazos[k as 0 | 1];
    brazo.hombro.rotation.x = lerp(brazo.hombro.rotation.x, b.hombro, w);
    brazo.hombro.rotation.z = lerp(brazo.hombro.rotation.z, (k === 0 ? -1 : 1) * b.abduccion, w);
    brazo.codo.rotation.x = lerp(brazo.codo.rotation.x, -b.codo, w);
  }
  rig.pelvis.position.x *= resto;
  rig.pelvis.position.y = lerp(rig.pelvis.position.y, PELVIS_DE_PIE, w);
  rig.pelvis.rotation.y *= resto;
  rig.pelvis.rotation.z *= resto;
  rig.columna.position.x *= resto;
  rig.columna.rotation.x = rig.columna.rotation.x * resto + POSE.columna * w + inclinacion;
  rig.columna.rotation.y *= resto;
  rig.columna.rotation.z *= resto;
}

/**
 * La `y` que el avatar propio entrega a la presencia: el asiento si está sentado; si no, los pies, y en el
 * aire el piso (`ySuelo`), no la altura física: el arco del salto lo simula cada cliente con `saltos`.
 * Al caer sobre algo más alto que el piso de despegue (una mesa), `pisoBajo` —la cara donde va a aterrizar—
 * sube esa base mientras desciende: el visitante remoto aterriza arriba y no se hunde en el mueble.
 */
export function alturaParaPresencia(
  a: {
    estado: string;
    enSuelo: boolean;
    y: number;
    ySuelo: number;
    vy?: number;
    sentarse: { asiento: { y: number } | null };
  },
  pisoBajo = Number.NEGATIVE_INFINITY,
): number {
  if (a.estado === 'sentado') return a.sentarse.asiento?.y ?? a.y;
  if (a.enSuelo) return a.y;
  return (a.vy ?? 0) < 0 ? Math.max(a.ySuelo, pisoBajo) : a.ySuelo;
}

/** Progreso (0..1) de la transición de cada persona remota sentada o a punto de levantarse. */
export type SentadasRemotas = Map<Rig, number>;

export const crearSentadasRemotas = (): SentadasRemotas => new Map();

const scratch: SalidaSentarse = crearSalidaSentarse();
const peso = { valor: 0 };

/**
 * Pose de una persona remota: hace avanzar su transición (`dt` s) hacia sentada (`sentada`) o de pie, posa
 * el rig y deja en `rig.raiz.position.y` la altura de la raíz. `y` es el que entrega la presencia: el
 * asiento si `sentada`, los pies si no. Devuelve `false` (y no toca nada) si ya está de pie del todo.
 */
export function posarRemota(
  rig: Rig,
  sentada: boolean,
  y: number,
  dt: number,
  estado: SentadasRemotas,
): boolean {
  const antes = estado.get(rig);
  if (antes === undefined && !sentada) return false;
  peso.valor = antes ?? 0;
  avanzarPeso(peso, sentada ? 1 : 0, dt, DURACION_SENTADA_REMOTA);
  if (peso.valor <= 0 && !sentada) {
    estado.delete(rig);
    return false;
  }
  estado.set(rig, peso.valor);
  curvaSentarse(peso.valor, scratch);
  posarSentado(rig, scratch.altura, scratch.inclinacionTorso);
  rig.raiz.position.y =
    y - (sentada ? PELVIS_SENTADA : 0) - BAJA * (scratch.altura > 1 ? 1 : scratch.altura);
  return true;
}
