import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import { Scene, Vector3 } from 'three';
import type { Escenario, VarianteEscenario } from '@oficina/motor';
import { dibujoDe } from '@oficina/motor';
import { ContextoEscenario } from '@oficina/motor';
import { Luces } from '@oficina/motor';
import { paletaLuz } from '@oficina/motor';
import { paletaConVariante } from '@oficina/motor';
import { PARAMETROS_MUNDOS } from './mundos';
import type { Rig } from '@oficina/motor';

import { alEstarActivo } from './bancosInactivos';

const SIN_PANTALLAS = {};
const ignorarInteres = () => undefined;

/** Mantener los materiales montados mantiene sus programas en la caché del MISMO renderer. */
export const BancoMundo = memo(function BancoMundo({
  escenario,
  variante,
  movimiento,
  activo,
  registrar,
}: {
  escenario: Escenario;
  movimiento: number;
  activo: boolean;
  variante: VarianteEscenario;
  registrar: (id: string, escena: Scene) => void;
}) {
  const actividad = useRef(activo);
  actividad.current = activo;
  const interno = useThree((s) => s.internal);
  // El portal comparte el bucle del renderer: filtrar sus suscripciones evita animar los ocultos.
  const internoBanco = useMemo(
    () => ({
      ...interno,
      subscribe: ((ref, prioridad, store) =>
        interno.subscribe(
          {
            current: alEstarActivo(actividad, (...args) => ref.current(...args)),
          },
          prioridad,
          store,
        )) as typeof interno.subscribe,
    }),
    [interno],
  );
  const escena = useMemo(() => new Scene(), []);
  const rigs = useRef(new Map<string, Rig>());
  const asistente = useMemo(
    () =>
      new Vector3(
        escenario.planta.asistente.x,
        escenario.planta.asistente.y,
        escenario.planta.asistente.z,
      ),
    [escenario],
  );
  const paleta = useMemo(
    () => paletaConVariante(paletaLuz(variante.paleta.hora), variante.paleta),
    [escenario, variante],
  );
  const Dibujo = dibujoDe(escenario.id);
  // La construcción concurrente puede durar varios cuadros: registrar solo tras el commit completo.
  useLayoutEffect(() => {
    registrar(`${escenario.id}:${variante.id}`, escena);
  }, [registrar, escenario.id, variante.id, escena]);
  return createPortal(
    <ContextoEscenario.Provider value={escenario}>
      {Dibujo && (
        <Dibujo
          escenario={escenario}
          variante={variante}
          paleta={paleta}
          sombras={false}
          movimiento={movimiento}
          rigs={rigs}
          ambiente={null}
          asistente={asistente}
          escalaAsistente={PARAMETROS_MUNDOS.escalaAsistente}
          sinCasa={false}
          contenidoPantallas={SIN_PANTALLAS}
          onInteres={ignorarInteres}
        />
      )}
      <Luces paleta={paleta} sombras={false} puntuales={escenario.ambiente.tipo === 'exterior'} />
    </ContextoEscenario.Provider>,
    escena,
    { internal: internoBanco },
  );
});
