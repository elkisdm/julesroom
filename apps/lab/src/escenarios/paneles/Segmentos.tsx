/** Grupo de botones excluyentes (activo, temporalidad…). */
export function Segmentos<T extends string>({
  etiqueta,
  valor,
  opciones,
  alCambiar,
}: {
  etiqueta: string;
  valor: T;
  opciones: readonly { id: T; etiqueta: string }[];
  alCambiar: (id: T) => void;
}) {
  return (
    <div className="pn-segmentos" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === valor} onClick={() => alCambiar(o.id)}>
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
