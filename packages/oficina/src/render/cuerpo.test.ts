import * as v8 from 'node:v8';
import * as vm from 'node:vm';
import { Group, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BufferGeometry } from 'three';
import { calcularPose, crearPose } from '../animacion/articulaciones';
import { crearCandidatos } from '../animacion/interes';
import { fraccionApoyo } from '../animacion/caminata';
import { PARAMETROS_LOCOMOCION, conducir } from '../animacion/locomocion';
import { apagarTodo, encenderTodo, fijarOpciones } from '../animacion/opciones';
import { avanzarMarchaRemota, crearMarchaRemota } from '../presencia/marcha-remota';
import type { Rig } from './animador';
import type { Estilo } from './flota';
import type { Parte } from './Pieza';
import { aplicarCuerpo, crearEstadoCuerpo, elegirMirada } from './cuerpo';
import type { EstadoCuerpo } from './cuerpo';

// Las celdas del atlas se dibujan en un <canvas>; aquí solo importa el movimiento.
vi.mock('./texturas', () => ({ celdasCara: () => [0, 1], celdaIcono: () => 0 }));

const parte = (): Parte => ({
  ancla: new Group(),
  geometria: {} as BufferGeometry,
  estilo: {} as Estilo,
  celda: 0,
  cartel: false,
});

interface RigPrueba {
  rig: Rig;
  pies: [Group, Group];
}

/** Esqueleto con las mismas posiciones locales que `Persona.tsx` y un punto en cada pie. */
function crearRig(): RigPrueba {
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

const DT = 1 / 60;
/** Fracción de ciclo que se descarta al inicio y al final del apoyo al medir el patinaje. */
const MARGEN_APOYO = 0.06;
const P = PARAMETROS_LOCOMOCION;

/** Camina `segundos` hacia +z al paso máximo. Llama a `cuadro` tras cada aplicarCuerpo. */
function caminar(
  e: EstadoCuerpo,
  rig: Rig,
  segundos: number,
  t0 = 0,
  cuadro?: (t: number) => void,
): number {
  let t = t0;
  const n = Math.round(segundos / DT);
  for (let i = 0; i < n; i++, t += DT) {
    conducir(e.loc, 0, 1, 1, P, DT);
    rig.raiz.position.set(e.loc.x, 0, e.loc.z);
    aplicarCuerpo(rig, e, t, DT);
    cuadro?.(t);
  }
  return t;
}

beforeEach(() => encenderTodo());
afterEach(() => encenderTodo());

describe('aplicarCuerpo', () => {
  it.each([
    ['caminando', false],
    ['corriendo', true],
  ])('%s, el pie de apoyo no patina ni se hunde en el rig completo', (_n, correr) => {
    const { rig, pies } = crearRig();
    const e = crearEstadoCuerpo('ana');
    e.loc.correr = correr;
    const t0 = caminar(e, rig, 3);
    const v = e.loc.velocidad;
    const apoyo = fraccionApoyo(v);
    const p = new Vector3();
    const previo: Vector3[] = [new Vector3(), new Vector3()];
    const enApoyo = [false, false];
    let tiene = false;
    let maxVel = 0;
    let medidos = 0;
    let maxAltura = 0;
    caminar(e, rig, 2, t0, () => {
      rig.raiz.updateMatrixWorld(true);
      for (let k = 0; k < 2; k++) {
        (pies[k] as Group).getWorldPosition(p);
        const q = previo[k] as Vector3;
        // Apoyo = interior de la fase de apoyo de esa pierna (la 1 va medio ciclo detrás).
        const u = (e.loc.fase + 0.5 * k) % 1;
        const dentro = u > MARGEN_APOYO && u < apoyo - MARGEN_APOYO;
        if (tiene && dentro && enApoyo[k]) {
          maxVel = Math.max(maxVel, Math.hypot(p.x - q.x, p.z - q.z) / DT);
          maxAltura = Math.max(maxAltura, Math.abs(p.y));
          medidos++;
        }
        enApoyo[k] = dentro;
        q.copy(p);
      }
      tiene = true;
    });
    expect(v).toBeCloseTo(correr ? P.velCorrer : P.velMax, 3);
    expect(medidos).toBeGreaterThan(20);
    // Apoyado, el pie queda quieto respecto del suelo mientras el cuerpo avanza a v, y toca el suelo.
    expect(maxVel).toBeLessThan(0.05 * v);
    expect(maxAltura).toBeLessThan(0.012);
  });

  it('quieto respira y su cabeza se mueve', () => {
    const { rig } = crearRig();
    const e = crearEstadoCuerpo('luis');
    let minEscala = Infinity;
    let maxEscala = -Infinity;
    let minYaw = Infinity;
    let maxYaw = -Infinity;
    for (let i = 0, t = 0; i < 60 * 12; i++, t += DT) {
      aplicarCuerpo(rig, e, t, DT);
      minEscala = Math.min(minEscala, rig.torso.scale.y);
      maxEscala = Math.max(maxEscala, rig.torso.scale.y);
      minYaw = Math.min(minYaw, rig.cabeza.rotation.y);
      maxYaw = Math.max(maxYaw, rig.cabeza.rotation.y);
    }
    expect(maxEscala - minEscala).toBeGreaterThan(0.01);
    expect(maxYaw - minYaw).toBeGreaterThan(0.02);
  });

  it('dos ids distintos nunca están en fase', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const series = ids.map((id) => {
      const { rig } = crearRig();
      const e = crearEstadoCuerpo(id);
      const s: number[] = [];
      for (let i = 0, t = 0; i < 60 * 10; i++, t += DT) {
        aplicarCuerpo(rig, e, t, DT);
        s.push(rig.torso.scale.y + rig.cabeza.rotation.y);
      }
      return s;
    });
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        let dif = 0;
        for (let i = 0; i < 600; i++)
          dif += Math.abs((series[a] as number[])[i]! - (series[b] as number[])[i]!);
        expect(dif).toBeGreaterThan(0.5);
      }
    }
  });

  it('todo apagado equivale al camino anterior (marcha senoidal, torso que respira)', () => {
    apagarTodo();
    const { rig } = crearRig();
    const e = crearEstadoCuerpo('vieja');
    const marcha = crearMarchaRemota(0, 0);
    const pose = crearPose();
    const entrada = { fase: 0, postura: 'de_pie' as 'de_pie' | 'caminando', velocidad: 0, t: 0 };
    let t = 0;
    for (let i = 0; i < 240; i++, t += DT) {
      conducir(e.loc, 0, 1, 1, P, DT);
      aplicarCuerpo(rig, e, t, DT);
      avanzarMarchaRemota(marcha, e.loc.x, e.loc.z, DT);
      entrada.fase = marcha.fase;
      entrada.postura = marcha.marcha > 0.03 ? 'caminando' : 'de_pie';
      entrada.velocidad = marcha.marcha;
      entrada.t = t;
      calcularPose(entrada, pose);
    }
    expect(rig.piernas[0].cadera.rotation.x).toBeCloseTo(pose.piernas[0].cadera, 10);
    expect(rig.piernas[1].rodilla.rotation.x).toBeCloseTo(pose.piernas[1].rodilla, 10);
    expect(rig.pelvis.position.y).toBeCloseTo(0.62 + pose.pelvisY, 10);
    expect(rig.brazos[0].hombro.rotation.x).toBeCloseTo(pose.brazos[0].hombro, 10);
    expect(rig.columna.rotation.x).toBeCloseTo(0.06 * Math.min(1, e.loc.velocidad / 1.15), 10);
    expect(rig.cabeza.rotation.x).toBe(-0);
    expect(rig.cabeza.rotation.y).toBe(0);
    const respiro = Math.sin((t - DT) * 1.7);
    expect(rig.torso.scale.y).toBeCloseTo(1 + respiro * 0.012, 10);
    expect(rig.torso.scale.x).toBeCloseTo(1 + respiro * 0.008, 10);
  });

  it('marchaPorDistancia: apagada usa la marcha senoidal; encendida, la zancada', () => {
    const resultado = (activa: boolean) => {
      fijarOpciones({ marchaPorDistancia: activa });
      const { rig } = crearRig();
      const e = crearEstadoCuerpo('m');
      caminar(e, rig, 1.5);
      return [rig.piernas[0].cadera.rotation.x, rig.pelvis.position.y];
    };
    const nueva = resultado(true);
    const vieja = resultado(false);
    expect(nueva[0]).not.toBeCloseTo(vieja[0] as number, 3);
    expect(nueva[1]).not.toBeCloseTo(vieja[1] as number, 4);
  });

  it('resorteCritico y resorteRebase: apagados, la inclinación vuelve a ser proporcional a la velocidad', () => {
    const inclinacion = (c: boolean, r: boolean) => {
      fijarOpciones({ resorteCritico: c, resorteRebase: r, caminataPoses: false });
      const { rig } = crearRig();
      const e = crearEstadoCuerpo('i');
      let maximo = -Infinity;
      caminar(e, rig, 1, 0, () => {
        maximo = Math.max(maximo, rig.columna.rotation.x);
      });
      return { maximo, final: rig.columna.rotation.x, v: e.loc.velocidad };
    };
    const sinResorte = inclinacion(false, false);
    expect(sinResorte.final).toBeCloseTo(0.06 * Math.min(1, sinResorte.v / P.velMax), 10);
    const rebase = inclinacion(true, true);
    const critico = inclinacion(true, false);
    // El resorte subamortiguado rebasa su objetivo; el crítico no.
    expect(rebase.maximo).toBeGreaterThan(critico.maximo);
    expect(critico.maximo).toBeGreaterThan(0.02);
    expect(critico.final).not.toBeCloseTo(sinResorte.final, 3);
  });

  it('aplastarEstirar: una pisada aplasta el torso y baja la pelvis; apagado, no', () => {
    const rango = (activa: boolean) => {
      fijarOpciones({ aplastarEstirar: activa });
      const { rig } = crearRig();
      const e = crearEstadoCuerpo('s');
      let minY = Infinity;
      let minPelvis = Infinity;
      let maxXZ = -Infinity;
      caminar(e, rig, 3, 0, () => {
        minY = Math.min(minY, rig.torso.scale.y);
        minPelvis = Math.min(minPelvis, rig.pelvis.position.y);
        maxXZ = Math.max(maxXZ, rig.torso.scale.x);
      });
      return { minY, minPelvis, maxXZ };
    };
    const con = rango(true);
    const sin = rango(false);
    expect(con.minY).toBeLessThan(sin.minY - 0.005);
    expect(con.minPelvis).toBeLessThan(sin.minPelvis);
    expect(con.maxXZ).toBeGreaterThan(sin.maxXZ);
  });

  it('vida: apagada, quieto no mueve la cabeza ni parpadea; encendida, sí', () => {
    const correr = (activa: boolean) => {
      fijarOpciones({ vida: activa });
      const { rig } = crearRig();
      const e = crearEstadoCuerpo('v');
      let yaw = 0;
      const celdas = new Set<number>();
      for (let i = 0, t = 0; i < 60 * 20; i++, t += DT) {
        aplicarCuerpo(rig, e, t, DT);
        yaw = Math.max(yaw, Math.abs(rig.cabeza.rotation.y));
        celdas.add(rig.cara!.celda);
      }
      return { yaw, parpadeos: celdas.size };
    };
    const con = correr(true);
    const sin = correr(false);
    expect(sin.yaw).toBe(0);
    expect(sin.parpadeos).toBe(1);
    expect(con.yaw).toBeGreaterThan(0.02);
    expect(con.parpadeos).toBe(2);
  });

  it('interes: la cabeza gira hacia quien está cerca; apagado, no', () => {
    const girar = (activa: boolean) => {
      fijarOpciones({ interes: activa, vida: false });
      const { rig } = crearRig();
      const e = crearEstadoCuerpo('mirón');
      const c = crearCandidatos(2);
      c.x[0] = 2; // a la izquierda del cuerpo (mira a +z)
      c.z[0] = 0;
      c.id[0] = 7;
      for (let i = 0, t = 0; i < 60 * 3; i++, t += DT) {
        elegirMirada(e, c, 1, t, DT);
        aplicarCuerpo(rig, e, t, DT);
      }
      return rig.cabeza.rotation.y;
    };
    expect(girar(true)).toBeGreaterThan(0.5);
    expect(girar(false)).toBe(0);
  });

  it('suavizadoExp apagado cambia solo cómo se acerca la mirada', () => {
    const paso = (activa: boolean) => {
      fijarOpciones({ suavizadoExp: activa, vida: false });
      const { rig } = crearRig();
      const e = crearEstadoCuerpo('x');
      const c = crearCandidatos(1);
      c.x[0] = 2;
      c.id[0] = 7;
      for (let i = 0, t = 0; i < 30; i++, t += DT) {
        elegirMirada(e, c, 1, t, DT);
        aplicarCuerpo(rig, e, t, DT);
      }
      return rig.cabeza.rotation.y;
    };
    expect(paso(true)).not.toBeCloseTo(paso(false), 4);
  });

  it('accesorios: los grupos de rig.secundarios siguen el movimiento con retraso', () => {
    const { rig } = crearRig();
    const capa = new Group();
    rig.secundarios = [capa];
    const e = crearEstadoCuerpo('capa');
    let maximo = 0;
    caminar(e, rig, 2, 0, () => {
      maximo = Math.max(maximo, Math.abs(capa.rotation.x));
    });
    expect(maximo).toBeGreaterThan(0.05);
    fijarOpciones({ resorteRebase: false });
    aplicarCuerpo(rig, e, 99, DT);
    expect(capa.rotation.x).toBe(0);
  });

  it('20 000 cuadros no hacen crecer el heap más de 2 MB', () => {
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc') as () => void;
    const { rig } = crearRig();
    rig.secundarios = [new Group(), new Group()];
    const e = crearEstadoCuerpo('heap');
    const c = crearCandidatos(4);
    for (let i = 0; i < 4; i++) {
      c.x[i] = 2 + i;
      c.z[i] = i;
      c.id[i] = i + 1;
    }
    let t = 0;
    const ciclo = (n: number) => {
      for (let i = 0; i < n; i++, t += DT) {
        if (i % 600 < 300) conducir(e.loc, 0, 1, 1, P, DT);
        else conducir(e.loc, 0, 1, 0, P, DT);
        elegirMirada(e, c, 4, t, DT);
        aplicarCuerpo(rig, e, t, DT);
      }
    };
    ciclo(3000);
    gc();
    const antes = process.memoryUsage().heapUsed;
    ciclo(20_000);
    gc();
    expect(process.memoryUsage().heapUsed - antes).toBeLessThan(2 * 1024 * 1024);
  });
});
