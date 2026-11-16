import { EQUIPO_EJEMPLO, frasesDeErrorPorDefecto, type DefinicionAgente } from '@oficina/agentes';
import type { SalaGuardada } from '@oficina/motor';
import { LIMITES_VIVO } from './protocolo';

/** Personalidades del paquete existente con la identidad elegida para esta sala. */
export function equipoDeSala(sala: SalaGuardada): DefinicionAgente[] {
  return sala.ocupantes
    .filter((o) => o.tipo === 'agente')
    .map((o, i) => ({
      ...EQUIPO_EJEMPLO[i % EQUIPO_EJEMPLO.length]!,
      id: `${sala.plano.plantilla}-${o.id}`,
      nombre: o.nombre,
      rol: o.rol,
      personalidad: `Eres ${o.nombre}. Tu especialidad es ${o.rol}. Ayudas al equipo con claridad y reconoces cuando no sabes algo.`,
      saludo: `Hola, soy ${o.nombre}. ¿Qué necesitas sobre ${o.rol.toLowerCase()}?`,
      frasesError: frasesDeErrorPorDefecto(o),
      maxCaracteresEntrada: LIMITES_VIVO.caracteres,
    }));
}
