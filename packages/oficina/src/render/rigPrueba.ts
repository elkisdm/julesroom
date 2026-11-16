import { Group } from 'three';
import type { BufferGeometry } from 'three';
import type { Rig } from './animador';
import type { Estilo } from './flota';
import type { Parte } from './Pieza';

const parte = (): Parte => ({
  ancla: new Group(),
  geometria: {} as BufferGeometry,
  estilo: {} as Estilo,
  celda: 0,
  cartel: false,
});

/**
 * Esqueleto de pruebas con las posiciones locales de `Persona.tsx` y un punto en cada pie (la suela):
 * con él se mide la cinemática directa del cuerpo (dónde queda cada pie en el mundo). Solo para pruebas.
 */
export function crearRigPrueba(): { rig: Rig; pies: [Group, Group] } {
  const raiz = new Group();
  const pelvis = new Group();
  pelvis.position.set(0, 0.62, 0);
  raiz.add(pelvis);
  const columna = new Group();
  pelvis.add(columna);
  const torso = new Group();
  columna.add(torso);
  const cabeza = new Group();
  cabeza.position.set(0, 0.83, 0);
  columna.add(cabeza);
  const caderas: Group[] = [];
  const rodillas: Group[] = [];
  const pies: Group[] = [];
  const hombros: Group[] = [];
  const codos: Group[] = [];
  for (const x of [-0.135, 0.135]) {
    const cadera = new Group();
    cadera.position.set(x, 0, 0);
    pelvis.add(cadera);
    const rodilla = new Group();
    rodilla.position.set(0, -0.32, 0);
    cadera.add(rodilla);
    const pie = new Group();
    pie.position.set(0, -0.3, 0);
    rodilla.add(pie);
    caderas.push(cadera);
    rodillas.push(rodilla);
    pies.push(pie);
    const hombro = new Group();
    hombro.position.set(x, 0.55, 0);
    columna.add(hombro);
    const codo = new Group();
    codo.position.set(0, -0.27, 0);
    hombro.add(codo);
    hombros.push(hombro);
    codos.push(codo);
  }
  const rig: Rig = {
    raiz,
    pelvis,
    columna,
    torso,
    cabeza,
    piernas: [
      { cadera: caderas[0] as Group, rodilla: rodillas[0] as Group },
      { cadera: caderas[1] as Group, rodilla: rodillas[1] as Group },
    ],
    brazos: [
      { hombro: hombros[0] as Group, codo: codos[0] as Group },
      { hombro: hombros[1] as Group, codo: codos[1] as Group },
    ],
    taza: parte(),
    hoja: parte(),
    telefono: parte(),
    cara: parte(),
    icono: parte(),
    anillo: new Group(),
    partes: [],
    caraFija: null,
    tazaEquipada: false,
    alturaIcono: 1.9,
  };
  return { rig, pies: [pies[0] as Group, pies[1] as Group] };
}
