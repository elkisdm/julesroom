import { memo, useEffect, useMemo, useState } from 'react';
import { Oficina } from '@oficina/motor';
import type {
  Accion,
  GestoAgente,
  AgenteOficina,
  AvatarPropio,
  Departamento,
  FuentePresencia,
  Proyector,
} from '@oficina/motor';
import { useAlmacen } from './almacen';
import type { Almacen } from './almacen';
import { hablaEn, PARAMETROS_VIDA, aplicarVida, vidaDeFase } from './vidaAgente';
import type { Vida } from './vidaAgente';

interface Props {
  almacen: Almacen;
  accionesExtra: readonly Accion[];
  agentesBase: AgenteOficina[];
  departamentos: Departamento[];
  fuente: FuentePresencia;
  avatar: AvatarPropio;
  /** Se muta en el lugar: el motor lo lee en cada cuadro, sin pintar de nuevo la oficina. */
  hablandoIds: Set<string>;
  /** Agente con el que otra persona conversa ahora (se levanta y mira, igual que con quien le habla). */
  agenteOcupadoPorOtro: string | null;
  alProyector: (p: Proyector) => void;
  alAccionCercana: (a: Accion | null) => void;
  alHablarAgente: (id: string) => void;
}

/**
 * La oficina y la vida de los agentes. Se suscribe solo a la fase y al agente de la conversación: un trozo de
 * texto que llega no la vuelve a pintar. Los agentes que no cambian conservan su objeto, para que el motor no
 * reinicie la escena.
 */
export const Escena = memo(function Escena({
  almacen,
  accionesExtra,
  agentesBase,
  departamentos,
  fuente,
  avatar,
  hablandoIds,
  agenteOcupadoPorOtro,
  alProyector,
  alAccionCercana,
  alHablarAgente,
}: Props) {
  const fase = useAlmacen(almacen, (e) => e.fase);
  const agenteId = useAlmacen(almacen, (e) => e.agenteId);

  // Con la conversación abierta el agente reacciona; al cerrarla vuelve a lo suyo tras un momento.
  const [vidaConversacion, setVidaConversacion] = useState<{ id: string; vida: Vida } | null>(null);
  useEffect(() => {
    const vida = vidaDeFase(fase);
    if (agenteId && vida) {
      setVidaConversacion({ id: agenteId, vida });
      return;
    }
    const t = setTimeout(() => setVidaConversacion(null), PARAMETROS_VIDA.retornoMs);
    return () => clearTimeout(t);
  }, [fase, agenteId]);

  const agentes = useMemo(() => {
    const vida: Record<string, Vida | undefined> = {};
    if (agenteOcupadoPorOtro) vida[agenteOcupadoPorOtro] = { estado: 'esperando_decision' };
    if (vidaConversacion) vida[vidaConversacion.id] = vidaConversacion.vida;
    return aplicarVida(agentesBase, vida);
  }, [agentesBase, vidaConversacion, agenteOcupadoPorOtro]);

  useEffect(() => {
    hablandoIds.clear();
    if (agenteId && hablaEn(fase)) hablandoIds.add(agenteId);
  }, [fase, agenteId, hablandoIds]);

  const miradaAgentes = useMemo(
    () => (agenteId && fase !== 'cerrada' ? { [agenteId]: avatar.id } : {}),
    [agenteId, fase, avatar.id],
  );
  const gestoAgentes = useMemo<Record<string, GestoAgente>>(
    () => (agenteId && hablaEn(fase) ? { [agenteId]: 'explicar' } : {}),
    [agenteId, fase],
  );

  return (
    <Oficina
      agentes={agentes}
      miradaAgentes={miradaAgentes}
      gestoAgentes={gestoAgentes}
      accionesExtra={accionesExtra}
      departamentos={departamentos}
      escenario="oficina"
      calidad="auto"
      vista="seguir"
      seguirAvatar
      fuentePresencia={fuente}
      avatarPropio={avatar}
      hablandoIds={hablandoIds}
      seleccionadoId={agenteId}
      onProyector={alProyector}
      onAccionCercana={alAccionCercana}
      onHablarAgente={alHablarAgente}
    />
  );
});
