import { useState } from 'react';
import { ACTIVOS, TEMPORALIDADES, analizar, buscarActivo } from './analisis';
import type { ActivoId, Temporalidad } from './analisis';
import { precio } from './agentes';
import { Grafico } from './Grafico';
import { Hoja } from './Hoja';
import { Segmentos } from './Segmentos';
import type { PropsHoja } from './tipos';

/** El muro y las mesas de mercado en grande: un gráfico de ejemplo del activo elegido. */
export function PanelMercado({ activoInicial, ...hoja }: { activoInicial: ActivoId } & PropsHoja) {
  const [activo, setActivo] = useState<ActivoId>(activoInicial);
  const [tf, setTf] = useState<Temporalidad>('1h');
  const a = analizar(activo, tf);
  return (
    <Hoja
      titulo="Muro de mercado"
      bajada="Datos de ejemplo generados para la demostración. No es información de mercado real."
      {...hoja}
    >
      <div className="pn-fila">
        <Segmentos
          etiqueta="Activo"
          valor={activo}
          opciones={ACTIVOS.map((x) => ({ id: x.id, etiqueta: x.simbolo }))}
          alCambiar={setActivo}
        />
        <Segmentos etiqueta="Temporalidad" valor={tf} opciones={TEMPORALIDADES} alCambiar={setTf} />
      </div>
      <Grafico activo={activo} tf={tf} />
      <dl className="pn-datos">
        <div>
          <dt>Último</dt>
          <dd>{precio(activo, a.precio)}</dd>
        </div>
        <div>
          <dt>Soporte {a.soportes[0]!.id}</dt>
          <dd>{precio(activo, a.soportes[0]!.precio)}</dd>
        </div>
        <div>
          <dt>Resistencia {a.resistencias[0]!.id}</dt>
          <dd>{precio(activo, a.resistencias[0]!.precio)}</dd>
        </div>
        <div>
          <dt>Tendencia</dt>
          <dd>{a.tendencia.direccion}</dd>
        </div>
      </dl>
      <p className="pn-nota">
        {buscarActivo(activo).simbolo}: probabilidad estimada de ejemplo, alcista {a.probabilidades.alcista} % ·
        lateral {a.probabilidades.lateral} % · bajista {a.probabilidades.bajista} %. Material educativo, no una
        recomendación.
      </p>
    </Hoja>
  );
}
