import { tipoObjeto } from '@oficina/motor';
import type { AccionSentarse, ObjetoColocado } from '@oficina/motor';
export const PARAMETROS_ASIENTOS_CATALOGO = {
  radio: 1.3,
  holgura: 0.55,
};
/** Acciones de las plazas colocadas; siguen el giro del objeto y su altura de piso. */
export function accionesDeObjetos(
  objetos: readonly ObjetoColocado[],
  yPiso: number,
): AccionSentarse[] {
  const acciones: AccionSentarse[] = [];
  for (const o of objetos) {
    const t = tipoObjeto(o.tipo);
    if (!t?.sentable || !t.asientos) continue;
    const giro = (o.giro * Math.PI) / 2,
      c = Math.cos(giro),
      s = Math.sin(giro);
    for (const [i, a] of t.asientos.entries()) {
      const yaw = giro + a.yaw;
      const x = o.x + a.x * c + a.z * s,
        z = o.z - a.x * s + a.z * c;
      const distancia = t.fondo / 2 + PARAMETROS_ASIENTOS_CATALOGO.holgura;
      acciones.push({
        id: `objeto:${o.id}:${i}`,
        tipo: 'sentarse',
        nombre: t.nombre,
        x,
        y: yPiso,
        z,
        radio: PARAMETROS_ASIENTOS_CATALOGO.radio,
        asiento: {
          x,
          z,
          y: yPiso + a.y,
          yaw,
          aproximacion: {
            x: o.x + a.x * c + distancia * s,
            y: yPiso,
            z: o.z - a.x * s + distancia * c,
          },
        },
      });
    }
  }
  return acciones;
}
