import { memo, useEffect, useMemo, useRef } from 'react';
import { Oficina, atuendoPorRol, escenarioPorId } from '@oficina/motor';
import type { Accion, AgenteOficina, Mando, MetricasRender, VistaOficina } from '@oficina/motor';
import { PARAMETROS_INTERFAZ } from './interaccion';
import { crearPresenciaDemo } from './escenaDemo';

const SIN_AGENTES: AgenteOficina[] = [];
export type AmbienteDemo = 'dia' | 'noche';

/** La misma escena y fuente simulada del laboratorio. No conoce servicios del producto. */
export const Escena = memo(function Escena({
  ambiente,
  vista,
  mando,
  visible,
  alMetricas,
  alMovimiento,
  alAccion,
  alSentarse,
  alPosicion,
}: {
  ambiente: AmbienteDemo;
  vista: VistaOficina;
  mando: Mando;
  visible: boolean;
  alMetricas: (m: MetricasRender) => void;
  alMovimiento: (m: boolean) => void;
  alAccion: (a: Accion | null) => void;
  alSentarse: (sentado: boolean) => void;
  alPosicion: (p: { x: number; y: number; z: number }) => void;
}) {
  const id = ambiente === 'dia' ? 'oficina' : 'trading';
  const escenario = useMemo(() => escenarioPorId(id), [id]);
  const fuente = useMemo(() => crearPresenciaDemo(escenario), [escenario]);
  const ultima = useRef({ movimiento: false, sentado: false, muestra: 0 });
  const avatar = useMemo(
    () => ({
      id: 'tu',
      nombre: 'Tú',
      atuendo: atuendoPorRol('diseno', PARAMETROS_INTERFAZ.indiceAtuendo),
      x: escenario.entradas[0]?.x ?? 0,
      z: escenario.entradas[0]?.z ?? 0,
      mando,
      alCambiar: (e: {
        x: number;
        y: number;
        z: number;
        velocidad: number;
        estado: 'de-pie' | 'sentado';
      }) => {
        const u = ultima.current;
        const sentado = e.estado === 'sentado';
        if (sentado !== u.sentado) {
          u.sentado = sentado;
          alSentarse(sentado);
        }
        if (performance.now() - u.muestra < PARAMETROS_INTERFAZ.muestraMovimiento) return;
        u.muestra = performance.now();
        alPosicion({ x: e.x, y: e.y, z: e.z });
        const moviendo = e.velocidad > PARAMETROS_INTERFAZ.umbralMovimiento;
        if (moviendo !== u.movimiento) {
          u.movimiento = moviendo;
          alMovimiento(moviendo);
        }
      },
    }),
    [escenario, mando, alMovimiento, alSentarse, alPosicion],
  );
  useEffect(() => {
    if (!visible) return;
    const reducir = matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let anterior = 0;
    const avanzar = (t: number) => {
      if (anterior && !reducir.matches && !document.hidden)
        fuente.avanzar(Math.min((t - anterior) / 1000, PARAMETROS_INTERFAZ.dtMaximo));
      anterior = t;
      raf = requestAnimationFrame(avanzar);
    };
    raf = requestAnimationFrame(avanzar);
    return () => cancelAnimationFrame(raf);
  }, [fuente, visible]);
  return (
    <Oficina
      agentes={SIN_AGENTES}
      escenario={id}
      variante={ambiente === 'dia' ? 'manana' : 'hora-azul'}
      calidad="media"
      fuentePresencia={fuente}
      avatarPropio={avatar}
      vista={vista}
      visible={visible}
      onMetricas={alMetricas}
      onAccionCercana={alAccion}
      interesesPorCercania={false}
    />
  );
});
