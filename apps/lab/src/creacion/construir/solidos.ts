/** Colisiones y superficies del catálogo: conserva el contrato de los muebles del motor. */
import { superficiesDeMuebles, tipoObjeto } from '@oficina/motor';
import type { Mueble, ObjetoColocado, Solido, Superficie } from '@oficina/motor';
const PARAMETROS_SUELOS_OBJETOS = { cuartoVuelta: Math.PI / 2, altoPlano: 0.03 };
/** Deriva cada volumen local, incluidos huecos y escalones, sin rellenar sus aberturas. */
export function suelosDeObjetos(
  objetos: readonly ObjetoColocado[],
  yPiso: number,
): { solidos: Solido[]; superficies: Superficie[] } {
  const solidos: Solido[] = [],
    superficies: Superficie[] = [];
  for (const o of objetos) {
    const t = tipoObjeto(o.tipo);
    if (!t || t.noBloqueaPaso || (t.pisable && t.alto <= PARAMETROS_SUELOS_OBJETOS.altoPlano))
      continue;
    const giro = o.giro * PARAMETROS_SUELOS_OBJETOS.cuartoVuelta,
      cos = Math.cos(giro),
      sen = Math.sin(giro);
    const bloques = t.colisiones ?? [
      { x: 0, z: 0, y: 0, ancho: t.ancho, fondo: t.fondo, alto: t.alto },
    ];
    for (const [i, b] of bloques.entries()) {
      const m: Mueble = {
        id: `obj-${o.id}${t.colisiones ? `-${i}` : ''}`,
        tipo: o.tipo,
        ambiente: '',
        x: o.x + b.x * cos + b.z * sen,
        z: o.z - b.x * sen + b.z * cos,
        y: 0,
        ancho: b.ancho,
        fondo: b.fondo,
        alto: b.alto,
        giro,
        conjunto: o.id,
        pisable: t.pisable,
      };
      const r = superficiesDeMuebles([m], () => yPiso + (t.elevacion ?? 0) + b.y);
      // Un dintel o dosel elevado conserva su techo real, sin prolongarse hacia arriba.
      if ((t.elevacion ?? 0) + b.y > 0)
        for (const solido of r.solidos) solido.infranqueable = false;
      solidos.push(...r.solidos);
      superficies.push(...r.superficies);
    }
  }
  return { solidos, superficies };
}
