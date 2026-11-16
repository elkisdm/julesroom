import { calcularPose, crearPose } from '../animacion/articulaciones';
import type { Rig } from './animador';
const saludos = new Map<string, number>();
const pose = crearPose();
const entrada = { fase: 0, postura: 'de_pie' as const, velocidad: 0, t: 0, saludando: true };
/** La aplicación registra el saludo validado; se reutiliza la pose del saludo existente. */
export function saludarD2(id: string, hasta: number) {
  saludos.set(id, hasta);
}
export function quitarSaludoD2(id: string) {
  saludos.delete(id);
}
/** Se aplica sobre la pose de marcha antes de escribir las instancias; no crea recursos por cuadro. */
export function posarSaludoD2(id: string, rig: Rig, ahora: number, reducido: boolean) {
  const hasta = saludos.get(id);
  if (hasta === undefined) return;
  if (ahora >= hasta) {
    saludos.delete(id);
    return;
  }
  entrada.t = reducido ? 0 : ahora / 1000;
  calcularPose(entrada, pose);
  const b = pose.brazos[1],
    brazo = rig.brazos[1];
  brazo.hombro.rotation.x = b.hombro;
  brazo.hombro.rotation.z = b.abduccion;
  brazo.codo.rotation.x = -b.codo;
}
