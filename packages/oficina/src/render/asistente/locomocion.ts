import type { Group } from 'three';
import {
  calcularCaminata,
  crearSalidaCaminata,
  PARAMETROS_CAMINATA,
} from '../../animacion/caminata';
import type { Locomocion } from '../../animacion/locomocion';
import { ajustarAlTerreno, crearEstadoPies } from '../../animacion/pisada';
import type { Suelo } from '../../escenarios/suelo';

/** Articulaciones en unidades del modelo; el ciclo y el terreno trabajan en metros de mundo. */
export const PARAMETROS_MODELO = {
  escala: 0.95,
  get muslo() {
    return PARAMETROS_CAMINATA.muslo / this.escala;
  },
  get pantorrilla() {
    return PARAMETROS_CAMINATA.pantorrilla / this.escala;
  },
  get caderaY() {
    return this.muslo + this.pantorrilla;
  },
  get caderaX() {
    return PARAMETROS_CAMINATA.separacionCadera / this.escala;
  },
  velocidadGesto: 0.3,
};

export interface RigAsistente {
  raiz: Group;
  pelvis: Group;
  columna: Group;
  piernas: [{ cadera: Group; rodilla: Group }, { cadera: Group; rodilla: Group }];
}

export const crearMarchaAsistente = () => ({
  pose: crearSalidaCaminata(),
  pies: crearEstadoPies(),
});

/** Adapta las articulaciones propias de Jules al mismo ciclo y apoyo de pies del avatar. */
export function aplicarLocomocion(
  rig: RigAsistente,
  e: ReturnType<typeof crearMarchaAsistente>,
  l: Locomocion,
  dt: number,
  suelo?: Suelo | null,
  ySuelo = 0,
): void {
  const p = PARAMETROS_MODELO;
  rig.raiz.rotation.y = l.rumbo;
  const c = calcularCaminata(l.fase, l.velocidad, e.pose);
  if (suelo)
    ajustarAlTerreno(e.pies, suelo, c, l.x, l.z, l.rumbo, l.giro, ySuelo, l.velocidad, l.fase, dt);
  rig.pelvis.position.set(0, p.caderaY + c.pelvisY / p.escala, 0);
  rig.pelvis.rotation.set(0, c.pelvisGiro, c.pelvisLadeo);
  rig.columna.position.x = c.pelvisX / p.escala;
  rig.columna.rotation.set(
    c.inclinacion + l.inclinacion.x,
    c.torsoGiro,
    -c.pelvisLadeo - l.alabeo.x,
  );
  for (let k = 0; k < 2; k++) {
    const i = k as 0 | 1;
    const pierna = rig.piernas[i];
    pierna.cadera.rotation.order = 'YXZ';
    pierna.cadera.rotation.set(c.cadera[i], -c.pelvisGiro, -c.pelvisLadeo);
    pierna.rodilla.rotation.x = c.rodilla[i];
  }
}
