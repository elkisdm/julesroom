import { crearAvatar, RADIO_AVATAR, type Avatar, type Mando } from '../animacion/avatar';
import { puntoLibre, type MapaColision } from '../animacion/colision';
import { alturaEn, SIN_SUELO } from '../escenarios/suelo';
export interface MandoD2 extends Mando {
  trasladoD2?: { x: number; y: number; z: number; rumbo: number };
}
/** Consume un traslado consentido; el mapa real vuelve a validar muebles, muros y piso. */
export function consumirTrasladoD2(mando: MandoD2, avatar: Avatar, mapa: MapaColision): boolean {
  const p = mando.trasladoD2;
  if (!p) return false;
  delete mando.trasladoD2;
  if (
    ![p.x, p.y, p.z, p.rumbo].every(Number.isFinite) ||
    !puntoLibre(mapa, p.x, p.z, RADIO_AVATAR, p.y)
  )
    return false;
  if (mapa.suelo) {
    const y = alturaEn(mapa.suelo, p.x, p.z, p.y);
    if (y === SIN_SUELO || Math.abs(y - p.y) > 0.2) return false;
  }
  mando.destino = null;
  mando.idDestino++;
  mando.sentar = null;
  mando.idSentar++;
  Object.assign(avatar, crearAvatar(p.x, p.z, p.rumbo, p.y));
  return true;
}
