import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Rig } from './animador';
import { useEscenario } from './escenarios/contexto';
import { HISTERESIS_INTERES, interesCercano, PERIODO_INTERES } from './cercaniaInteres';

interface Props {
  /** Id del avatar propio: solo con él hay cercanía. */
  avatarId: string | null;
  rigs: MutableRefObject<Map<string, Rig>>;
  /** Se lee en cada revisión: puede cambiar sin que este componente se monte de nuevo. */
  onInteres: MutableRefObject<((id: string | null) => void) | undefined>;
}

/**
 * Avisa por `onInteres` cuándo el avatar propio entra en el radio de un interés del escenario y cuándo
 * sale (`null`). Revisa cada `PERIODO_INTERES` s; no dibuja nada.
 */
export function Intereses({ avatarId, rigs, onInteres }: Props) {
  const escenario = useEscenario();
  const actual = useRef<string | null>(null);
  const acumulado = useRef(0);
  const escenarioVisto = useRef(escenario);

  useFrame((_, delta) => {
    // Al cambiar de escenario, lo que estaba activo ya no existe: se avisa la salida.
    if (escenarioVisto.current !== escenario) {
      escenarioVisto.current = escenario;
      if (actual.current !== null) onInteres.current?.(null);
      actual.current = null;
    }
    acumulado.current += delta;
    if (acumulado.current < PERIODO_INTERES) return;
    acumulado.current = 0;
    const p = avatarId ? rigs.current.get(avatarId)?.raiz.position : undefined;
    const siguiente = p
      ? interesCercano(escenario.intereses, p.x, p.z, actual.current, HISTERESIS_INTERES)
      : null;
    if (siguiente === actual.current) return;
    actual.current = siguiente;
    onInteres.current?.(siguiente);
  });

  return null;
}
