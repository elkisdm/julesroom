/**
 * Registro de escenarios por id (extensible, igual que los paquetes de skins): cada escenario se
 * registra una vez al importarse su módulo. La mansión viene registrada.
 */
import { escenarioMansion } from './mansion';
import type { Escenario } from './tipos';

const escenarios = new Map<string, Escenario>([[escenarioMansion.id, escenarioMansion]]);

/** Registra un escenario; lanza si ya hay uno con ese id. */
export function registrarEscenario(escenario: Escenario): void {
  if (escenarios.has(escenario.id))
    throw new Error(`El escenario ya está registrado: «${escenario.id}»`);
  escenarios.set(escenario.id, escenario);
}

/** ¿Hay un escenario registrado con ese id? */
export function hayEscenario(id: string): boolean {
  return escenarios.has(id);
}

/** El escenario con ese id; si no existe, la mansión (con un aviso en consola). */
export function escenarioPorId(id: string): Escenario {
  const e = escenarios.get(id);
  if (e) return e;
  console.warn(`Escenario desconocido «${id}»: se usa la mansión.`);
  return escenarioMansion;
}

/** Todos los escenarios registrados, en orden de registro. */
export function listarEscenarios(): Escenario[] {
  return [...escenarios.values()];
}
