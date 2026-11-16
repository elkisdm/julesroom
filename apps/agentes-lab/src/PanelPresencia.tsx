import { useEffect, useRef, useState } from 'react';
import type { PresenciaConversacion } from '@oficina/agentes';
import { useAlmacen } from './almacen';
import type { Almacen } from './almacen';
import { presenciaPropia } from './presenciaPropia';

/** Recuadro de desarrollo: lo que viajaría por presencia mientras tú conversas (estado, no contenido). */
export function PanelPresencia({ almacen }: { almacen: Almacen }) {
  const fase = useAlmacen(almacen, (e) => e.fase);
  const agenteId = useAlmacen(almacen, (e) => e.agenteId);
  const anterior = useRef<PresenciaConversacion | null>(null);
  const [presencia, setPresencia] = useState<PresenciaConversacion | null>(null);

  useEffect(() => {
    anterior.current = presenciaPropia(fase, agenteId, Date.now(), anterior.current);
    setPresencia(anterior.current);
  }, [fase, agenteId]);

  return (
    <details className="presencia">
      <summary>Presencia: lo que viajaría</summary>
      <pre>{presencia ? JSON.stringify(presencia, null, 2) : 'Sin conversación abierta.'}</pre>
    </details>
  );
}
