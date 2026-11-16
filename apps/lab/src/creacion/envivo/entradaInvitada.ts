import type { SalaGuardada } from '@oficina/motor';
import type { Paso } from '../Crear';
import { atuendoInicial, ID_YO } from '../plantillas';
import { sorprender } from '../pasos/estadoPersonaje';

/** La invitación no recorre las decisiones de creación del anfitrión. */
export function pasoInvitado(paso: Paso): Paso {
  if (paso === 'sala' || paso === 'llegada') return 'nombre';
  if (paso === 'agentes' || paso === 'invitar') return 'dentro';
  return paso;
}
/** Usa el catálogo probado del vestidor, sin cargar recursos adicionales. */
export function personajeRapido(sala: SalaGuardada, semilla: number): SalaGuardada {
  return {
    ...sala,
    ocupantes: sala.ocupantes.map((o) =>
      o.id === ID_YO ? { ...o, atuendo: sorprender(o.atuendo ?? atuendoInicial(3), semilla) } : o,
    ),
  };
}
