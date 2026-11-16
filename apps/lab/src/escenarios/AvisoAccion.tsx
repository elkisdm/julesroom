import type { Accion } from '@oficina/motor';
import { textoAviso } from './aviso';
import './avisoAccion.css';

/**
 * Aviso «E · sentarse» / «E · abrir …» de la acción que el avatar tiene a mano (`onAccionCercana`) y, mientras
 * está sentado, «E · levantarse».
 */
export function AvisoAccion({
  accion,
  sentado,
  abierto = false,
  alAccion,
}: {
  accion: Accion | null;
  sentado: boolean;
  /** El panel de esta acción ya está abierto: el aviso ofrece cerrarlo. */
  abierto?: boolean;
  alAccion?: () => void;
}) {
  const texto = textoAviso(accion, sentado, abierto);
  if (!texto) return null;
  const contenido = (
    <>
      <kbd>E</kbd>
      <span>{texto.verbo}</span>
      {texto.objeto && <span className="esc-accion-objeto">{texto.objeto}</span>}
    </>
  );
  return alAccion ? (
    <button type="button" className="esc-accion esc-accion--boton" onClick={alAccion}>
      {contenido}
    </button>
  ) : (
    <div className="esc-accion" role="status" key={sentado ? 'levantarse' : accion?.id}>
      {contenido}
    </div>
  );
}
