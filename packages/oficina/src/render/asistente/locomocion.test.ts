import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { avanzarFaseCaminata, largoZancada, PARAMETROS_CAMINATA } from '../../animacion/caminata';
import { crearLocomocion } from '../../animacion/locomocion';
import {
  aplicarLocomocion,
  crearMarchaAsistente,
  PARAMETROS_MODELO,
  type RigAsistente,
} from './locomocion';
import { geometriasAsistente } from './modelo';
import '../../escenarios/mansion';
import { escenarioPorId } from '../../escenarios/registro';
import { alturaEn, sueloDe } from '../../escenarios/suelo';

function banco() {
  const raiz = new Group(),
    pelvis = new Group(),
    columna = new Group();
  raiz.add(pelvis);
  pelvis.add(columna);
  const piernas = [0, 1].map((i) => {
    const cadera = new Group(),
      rodilla = new Group();
    cadera.position.x = (i ? 1 : -1) * PARAMETROS_MODELO.caderaX;
    rodilla.position.y = -PARAMETROS_MODELO.muslo;
    pelvis.add(cadera);
    cadera.add(rodilla);
    return { cadera, rodilla };
  }) as RigAsistente['piernas'];
  const rig: RigAsistente = { raiz, pelvis, columna, piernas };
  raiz.scale.setScalar(PARAMETROS_MODELO.escala);
  return { rig, marcha: crearMarchaAsistente(), loc: crearLocomocion(0, 0, 0) };
}
describe('Jules usa la caminata compartida', () => {
  it('apoya el rig articulado en el terreno real de la escalera', () => {
    const { rig, marcha, loc } = banco();
    const suelo = sueloDe(escenarioPorId('mansion'));
    loc.x = 3.2;
    loc.z = 0.5;
    loc.rumbo = Math.PI;
    loc.velocidad = 1.2;
    const y = alturaEn(suelo, loc.x, loc.z, 3.9);
    for (let i = 0; i < 60; i++) {
      loc.fase = avanzarFaseCaminata(loc.fase, loc.velocidad, 1 / 60);
      aplicarLocomocion(rig, marcha, loc, 1 / 60, suelo, y);
      expect(Number.isFinite(rig.pelvis.position.y)).toBe(true);
      for (const rodilla of marcha.pose.rodilla) expect(rodilla).toBeGreaterThanOrEqual(0);
    }
    expect(marcha.pies.iniciado).toBe(true);
    expect(marcha.pies.terreno.some((altura) => altura > 0)).toBe(true);
  });
  it('el rumbo dibujado coincide con el físico al girar', () => {
    const { rig, marcha, loc } = banco();
    loc.rumbo = Math.PI / 2;
    aplicarLocomocion(rig, marcha, loc, 1 / 60);
    expect(rig.raiz.rotation.y).toBe(loc.rumbo);
  });
  it('las piernas están separadas del torso con muslo y pantorrilla coloreados', () => {
    const g = geometriasAsistente();
    for (const parte of [g.muslo, g.pantorrilla]) {
      expect(parte.getAttribute('position').count).toBeGreaterThan(0);
      expect(parte.getAttribute('color').count).toBe(parte.getAttribute('position').count);
    }
    g.cuerpo.computeBoundingBox();
    expect(g.cuerpo.boundingBox!.min.y).toBeGreaterThan(0.6);
  });
  it.each([2.3, 4.8])('avanza una zancada por ciclo y mantiene el apoyo a %s m/s', (velocidad) => {
    const { rig, marcha, loc } = banco();
    const dt = 1 / 600;
    loc.velocidad = velocidad;
    const largo = largoZancada(velocidad);
    let vueltas = 0,
      distancia = 0;
    let anterior: number | null = null;
    let apoyo: number | null = null;
    const pie = new Vector3();
    for (let i = 0; i < Math.ceil((600 * largo) / velocidad); i++) {
      const fase = loc.fase;
      loc.fase = avanzarFaseCaminata(fase, velocidad, dt);
      if (loc.fase < fase) vueltas++;
      loc.z += velocidad * dt;
      distancia += velocidad * dt;
      rig.raiz.position.z = loc.z;
      aplicarLocomocion(rig, marcha, loc, dt);
      rig.raiz.updateMatrixWorld(true);
      pie.set(0, -PARAMETROS_MODELO.pantorrilla, 0);
      rig.piernas[0].rodilla.localToWorld(pie);
      if (marcha.pose.apoyado[0] && anterior !== null)
        expect(Math.abs(pie.z - anterior)).toBeLessThan(0.003);
      if (marcha.pose.apoyado[0]) {
        apoyo ??= pie.z;
        expect(Math.abs(pie.z - apoyo)).toBeLessThan(0.015);
        expect(Math.abs(pie.y)).toBeLessThan(0.006);
      } else apoyo = null;
      anterior = marcha.pose.apoyado[0] ? pie.z : null;
    }
    expect(vueltas).toBe(1);
    expect(Math.abs(distancia - largo)).toBeLessThanOrEqual(velocidad * dt);
    expect(PARAMETROS_MODELO.muslo * PARAMETROS_MODELO.escala).toBe(PARAMETROS_CAMINATA.muslo);
  });
  it('quieta no avanza la fase ni desplaza los pies', () => {
    const { rig, marcha, loc } = banco();
    aplicarLocomocion(rig, marcha, loc, 1 / 60);
    for (const angulo of marcha.pose.cadera) expect(angulo).toBeCloseTo(0);
    expect(loc.fase).toBe(0);
    expect(rig.pelvis.position.y).toBeCloseTo(PARAMETROS_MODELO.caderaY);
  });
});
