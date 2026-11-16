import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { levantarse, sentarEn } from '../animacion/avatar';
import type { Mando } from '../animacion/avatar';
import { accionesDe, crearSeleccionAccion, seleccionarAccion } from '../escenarios/acciones';
import type { Mesh } from 'three';
import type { Accion } from '../escenarios/tipos';
import type { FuentePresencia } from '../presencia/tipos';
import { useEscenario } from './escenarios/contexto';

/** Lo que `Acciones` lee del avatar propio: lo escribe quien recibe `AvatarPropio.alCambiar`. */
export interface EstadoAvatar {
  x: number;
  /** Los pies; sentado, el asiento. */
  y: number;
  z: number;
  rumbo: number;
  estado: 'de-pie' | 'sentado';
}

export const crearEstadoAvatar = (): EstadoAvatar => ({
  x: 0,
  y: 0,
  z: 0,
  rumbo: 0,
  estado: 'de-pie',
});

/** Cada cuántos segundos se busca la acción a mano. */
export const PERIODO_ACCIONES = 0.1;

const PARAMETROS_RESALTE_ACCION = {
  radioInterior: 0.36,
  radioExterior: 0.39,
  segmentos: 48,
  altura: 0.02,
  opacidad: 0.65,
};

interface Props {
  mando?: Mando;
  alAccion?: () => void;
  accionesExtra?: readonly Accion[];
  avatar: MutableRefObject<EstadoAvatar>;
  /** La acción a mano ahora (la lee quien atiende la tecla E). */
  accion: MutableRefObject<Accion | null>;
  /** Quién está sentado dónde: un asiento ocupado por otra persona no se ofrece. */
  fuente?: FuentePresencia | null;
  /** Se lee en cada revisión: puede cambiar sin que este componente se monte de nuevo. */
  onAccionCercana: MutableRefObject<((accion: Accion | null) => void) | undefined>;
}

/**
 * Avisa por `onAccionCercana` la acción del escenario que el avatar propio tiene a mano (sentarse en un
 * asiento, abrir un panel) y `null` cuando no hay ninguna o ya está sentado. Revisa cada
 * `PERIODO_ACCIONES` s y resalta el objetivo (la aplicación dibuja el aviso «E · sentarse»).
 */
export function Acciones({
  avatar,
  accion,
  fuente,
  onAccionCercana,
  accionesExtra,
  mando,
  alAccion,
}: Props) {
  const escenario = useEscenario();
  const acumulado = useRef(0);
  const escenarioVisto = useRef(escenario);
  const ocupados = useMemo(() => new Set<string>(), []);
  const seleccion = useMemo(crearSeleccionAccion, []);
  const pulsaciones = useRef(mando?.acciones ?? 0);
  const resalte = useRef<Mesh>(null);
  useEffect(
    () => () => {
      if (mando?.asientosOcupados === ocupados) mando.asientosOcupados = undefined;
      if (mando) mando.mirar = null;
    },
    [mando, ocupados],
  );

  useFrame((_, delta) => {
    ocupados.clear();
    for (const q of fuente?.personas() ?? [])
      if (q.estado === 'sentado' && q.asiento) ocupados.add(q.asiento);
    if (mando) mando.asientosOcupados = ocupados;
    const nuevas = mando?.acciones ?? 0;
    while (pulsaciones.current < nuevas) {
      pulsaciones.current++;
      alAccion?.();
    }
    if (escenarioVisto.current !== escenario) {
      escenarioVisto.current = escenario;
      if (accion.current !== null) onAccionCercana.current?.(null);
      accion.current = null;
      seleccion.accion = null;
      seleccion.disponibles.clear();
    }
    acumulado.current += delta;
    if (acumulado.current < PERIODO_ACCIONES) return;
    acumulado.current = 0;
    const a = avatar.current;
    const siguiente =
      a.estado === 'sentado'
        ? null
        : seleccionarAccion(
            seleccion,
            accionesExtra?.length
              ? [...accionesDe(escenario), ...accionesExtra]
              : accionesDe(escenario),
            a.x,
            a.z,
            a.y,
            a.rumbo,
            ocupados,
          );
    if (a.estado === 'sentado') seleccion.accion = null;
    if (mando) mando.mirar = siguiente && siguiente.tipo !== 'sentarse' ? siguiente : null;
    if (resalte.current) {
      resalte.current.visible = siguiente !== null;
      if (siguiente)
        resalte.current.position.set(
          siguiente.x,
          (siguiente.tipo === 'sentarse' ? siguiente.asiento.y : (siguiente.y ?? a.y)) +
            PARAMETROS_RESALTE_ACCION.altura,
          siguiente.z,
        );
    }
    if (siguiente === accion.current) return;
    accion.current = siguiente;
    onAccionCercana.current?.(siguiente);
  });

  const P = PARAMETROS_RESALTE_ACCION;
  return (
    <mesh ref={resalte} visible={false} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[P.radioInterior, P.radioExterior, P.segmentos]} />
      <meshBasicMaterial
        color={escenario.ambiente.paleta.acento}
        transparent
        opacity={P.opacidad}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Ejecuta una sola acción a mano; sentado, E siempre pide levantarse. */
export function ejecutarAccionAvatar(
  mando: Mando,
  avatar: EstadoAvatar,
  accion: Accion | null,
  alInteres?: (id: string) => void,
): void {
  if (avatar.estado === 'sentado') levantarse(mando);
  else if (accion?.tipo === 'sentarse') sentarEn(mando, accion);
  else if (accion?.tipo === 'abrir') alInteres?.(accion.interes);
  else if (accion?.tipo === 'hablar') accion.alEjecutar();
}
