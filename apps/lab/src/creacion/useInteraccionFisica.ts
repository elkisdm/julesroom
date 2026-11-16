import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { OcupanteAgente, Proyector, SalaGuardada } from '@oficina/motor';
import {
  actualizarAccionesHablar,
  crearAccionesHablar,
  miradasCercanas,
  miradasSiguientes,
  PARAMETROS_INTERACCION_FISICA,
} from './interaccionFisica';

/** Conecta posiciones y gestos con las acciones del motor, sin otro listener de teclado. */
export function useInteraccionFisica(
  sala: SalaGuardada,
  proyector: MutableRefObject<Proyector | null>,
  avatar: { x: number; y: number; z: number },
  alHablar: (id: string) => void,
  activo: boolean,
) {
  const callback = useRef(alHablar);
  callback.current = alHablar;
  const [saludando, setSaludando] = useState<{ id: string; numero: number } | null>(null);
  const [miradaAgentes, setMiradas] = useState<Record<string, string>>({});
  const agentes = useMemo(
    () => sala.ocupantes.filter((a): a is OcupanteAgente => a.tipo === 'agente'),
    [sala.ocupantes],
  );
  const accionesExtra = useMemo(
    () =>
      crearAccionesHablar(agentes, (id) => {
        setSaludando((antes) => ({ id, numero: (antes?.numero ?? 0) + 1 }));
        callback.current(id);
      }),
    [agentes],
  );
  useEffect(() => {
    if (!activo) {
      setMiradas((antes) => miradasSiguientes(antes, {}));
      setSaludando(null);
      return;
    }
    const actualizar = () => {
      actualizarAccionesHablar(accionesExtra, (id) => proyector.current?.mundo(id) ?? null);
      const nuevas = miradasCercanas(accionesExtra, avatar);
      setMiradas((antes) => miradasSiguientes(antes, nuevas));
    };
    actualizar();
    const t = window.setInterval(actualizar, PARAMETROS_INTERACCION_FISICA.periodoMs);
    return () => window.clearInterval(t);
  }, [accionesExtra, proyector, avatar, activo]);
  useEffect(() => {
    if (!saludando) return;
    const t = window.setTimeout(() => setSaludando(null), PARAMETROS_INTERACCION_FISICA.saludoMs);
    return () => window.clearTimeout(t);
  }, [saludando]);
  const gestoAgentes = useMemo(
    () => (saludando ? { [saludando.id]: 'saludo' as const } : {}),
    [saludando],
  );
  return { accionesExtra: activo ? accionesExtra : undefined, miradaAgentes, gestoAgentes };
}
