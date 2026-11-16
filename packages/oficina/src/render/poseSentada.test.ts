import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { PELVIS_DE_PIE, PELVIS_SENTADA } from '../animacion/sentarse';
import type { Rig } from './animador';
import {
  alturaParaPresencia,
  crearSentadasRemotas,
  DURACION_SENTADA_REMOTA,
  posarRemota,
  posarSentado,
} from './poseSentada';

/** Esqueleto mínimo con las articulaciones que toca la pose sentada (posiciones de `Persona.tsx`). */
function crearRig(): Rig {
  const raiz = new Group();
  const pelvis = new Group();
  pelvis.position.set(0, PELVIS_DE_PIE, 0);
  raiz.add(pelvis);
  const columna = new Group();
  pelvis.add(columna);
  const piernas = [0, 1].map(() => {
    const cadera = new Group();
    const rodilla = new Group();
    cadera.add(rodilla);
    pelvis.add(cadera);
    return { cadera, rodilla };
  });
  const brazos = [0, 1].map(() => {
    const hombro = new Group();
    const codo = new Group();
    hombro.add(codo);
    columna.add(hombro);
    return { hombro, codo };
  });
  return { raiz, pelvis, columna, piernas, brazos } as unknown as Rig;
}

describe('pose sentada', () => {
  it('con peso 0 no cambia nada', () => {
    const rig = crearRig();
    rig.piernas[0].cadera.rotation.x = 0.3;
    posarSentado(rig, 0, 0);
    expect(rig.piernas[0].cadera.rotation.x).toBe(0.3);
    expect(rig.pelvis.position.y).toBe(PELVIS_DE_PIE);
  });

  it('con peso 1: muslos horizontales, rodillas a 90°, pelvis en su altura y torso recto', () => {
    const rig = crearRig();
    rig.piernas[0].cadera.rotation.x = 0.4;
    rig.pelvis.position.y = 0.66; // rebote de la marcha
    rig.columna.rotation.x = 0.06;
    posarSentado(rig, 1, 0);
    for (const p of rig.piernas) {
      expect(p.cadera.rotation.x).toBeCloseTo(-Math.PI / 2, 6);
      expect(p.rodilla.rotation.x).toBeCloseTo(Math.PI / 2, 6);
    }
    expect(rig.pelvis.position.y).toBeCloseTo(PELVIS_DE_PIE, 6);
    expect(rig.columna.rotation.x).toBeCloseTo(0, 6);
    expect(rig.brazos[0].hombro.rotation.x).toBeCloseTo(-0.55, 6);
  });

  it('a medias queda entre las dos poses y la inclinación se suma al torso', () => {
    const rig = crearRig();
    posarSentado(rig, 0.5, 0.2);
    expect(rig.piernas[0].cadera.rotation.x).toBeCloseTo(-Math.PI / 4, 6);
    expect(rig.columna.rotation.x).toBeCloseTo(0.2, 6);
  });
});

describe('personas remotas sentadas', () => {
  const DT = 1 / 60;

  it('de pie y sin transición pendiente: no toca el rig', () => {
    const rig = crearRig();
    const estado = crearSentadasRemotas();
    expect(posarRemota(rig, false, 0, DT, estado)).toBe(false);
    expect(estado.size).toBe(0);
  });

  it('al sentarse (y = asiento) la raíz baja de los pies al asiento sin saltos', () => {
    const rig = crearRig();
    const estado = crearSentadasRemotas();
    const asiento = 0.45;
    let anterior = asiento - PELVIS_SENTADA; // los pies, donde estaba
    let saltoMax = 0;
    for (let t = 0; t < DURACION_SENTADA_REMOTA + 0.1; t += DT) {
      expect(posarRemota(rig, true, asiento, DT, estado)).toBe(true);
      saltoMax = Math.max(saltoMax, Math.abs(rig.raiz.position.y - anterior));
      anterior = rig.raiz.position.y;
    }
    expect(saltoMax).toBeLessThan(0.05);
    expect(rig.raiz.position.y + PELVIS_DE_PIE).toBeCloseTo(asiento, 3);
    expect(estado.get(rig)).toBe(1);
  });

  it('al levantarse (y = pies) sube a su altura y suelta el estado', () => {
    const rig = crearRig();
    const estado = crearSentadasRemotas();
    for (let t = 0; t < 1; t += DT) posarRemota(rig, true, 0.45, DT, estado);
    let anterior = rig.raiz.position.y;
    let saltoMax = 0;
    let n = 0;
    while (posarRemota(rig, false, 0, DT, estado) && n++ < 200) {
      saltoMax = Math.max(saltoMax, Math.abs(rig.raiz.position.y - anterior));
      anterior = rig.raiz.position.y;
    }
    expect(saltoMax).toBeLessThan(0.05);
    expect(estado.size).toBe(0);
    expect(n).toBeLessThan(200);
  });

  it('una remota sentada se posa UNA sola vez: la raíz queda en y - PELVIS_DE_PIE, sin bajar de nuevo', () => {
    const rig = crearRig();
    const estado = crearSentadasRemotas();
    const asiento = 0.45;
    for (let t = 0; t < DURACION_SENTADA_REMOTA + 0.5; t += DT)
      posarRemota(rig, true, asiento, DT, estado);
    // La pelvis queda a la altura del asiento y las piernas, sentadas, sin sumar otra bajada.
    expect(rig.raiz.position.y + rig.pelvis.position.y).toBeCloseTo(asiento, 3);
    expect(rig.raiz.position.y).toBeCloseTo(asiento - PELVIS_DE_PIE, 3);
  });
});

describe('altura que el avatar entrega a la presencia', () => {
  const base = { estado: 'de-pie', enSuelo: true, y: 1, ySuelo: 1, sentarse: { asiento: null } };

  it('de pie en el suelo: los pies', () => {
    expect(alturaParaPresencia(base)).toBe(1);
  });

  it('saltando: el piso (ySuelo), no la altura física del arco', () => {
    expect(alturaParaPresencia({ ...base, enSuelo: false, y: 1.4 })).toBe(1);
  });

  it('cayendo sobre una cara más alta que el despegue (una mesa), la base sube a esa cara', () => {
    const cayendo = { ...base, enSuelo: false, y: 1.1, vy: -3 };
    expect(alturaParaPresencia(cayendo, 0.74)).toBe(1);
    expect(alturaParaPresencia({ ...cayendo, ySuelo: 0 }, 0.74)).toBe(0.74);
    // Subiendo, o sin cara debajo, sigue siendo el piso de despegue.
    expect(alturaParaPresencia({ ...cayendo, ySuelo: 0, vy: 4 }, 0.74)).toBe(0);
    expect(alturaParaPresencia({ ...cayendo, ySuelo: 0 }, Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('sentado: el asiento', () => {
    const a = { ...base, estado: 'sentado', sentarse: { asiento: { y: 0.45 } } };
    expect(alturaParaPresencia(a)).toBe(0.45);
  });
});
