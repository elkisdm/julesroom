import { Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { escenarioMansion } from '../escenarios/mansion';
import { alturaEn, alturaPie, SIN_SUELO, sueloDe } from '../escenarios/suelo';
import { NIVEL_Y } from '../mansion/plano';
import { encenderTodo } from '../animacion/opciones';
import { PARAMETROS_ESCALERA as PE, pendienteSuelo } from '../animacion/pisada';
import { alimentarLocomocion, aplicarCuerpo, crearEstadoCuerpo } from './cuerpo';
import type { EstadoCuerpo } from './cuerpo';
import { crearRigPrueba as crearRig } from './rigPrueba';

vi.mock('./texturas', () => ({ celdasCara: () => [0, 1], celdaIcono: () => 0 }));

const DT = 1 / 60;
const suelo = sueloDe(escenarioMansion);

/** Trayectoria de la persona en función de la distancia recorrida: posición y altura de la losa o peldaño. */
type Recorrido = (s: number) => { x: number; z: number };

interface Cuadro {
  t: number;
  /** Pies en el mundo. */
  pie: [Vector3, Vector3];
  apoyado: [boolean, boolean];
  ySuelo: number;
  yMira: number;
  pelvisY: number;
  inclinacion: number;
}

/**
 * Lleva a una persona por `recorrido` a `velocidad` constante (como una remota: la locomoción se deriva de
 * la posición) con el piso que sigue el avatar (apoyo suavizado a 30/s) y registra, tras cada
 * `aplicarCuerpo`, los pies reales del rig (cinemática directa).
 */
function recorrer(recorrido: Recorrido, velocidad: number, segundos: number, y0: number): Cuadro[] {
  encenderTodo();
  const { rig, pies } = crearRig();
  const e: EstadoCuerpo = crearEstadoCuerpo('prueba');
  e.suelo = suelo;
  const salida: Cuadro[] = [];
  let s = 0;
  let ySuelo = y0;
  let rumbo = 0;
  const n = Math.round(segundos / DT);
  for (let i = 0; i < n; i++) {
    const t = i * DT;
    s += velocidad * DT;
    const p = recorrido(s);
    const q = recorrido(s + 0.05);
    rumbo = Math.atan2(q.x - p.x, q.z - p.z);
    const meta = alturaEn(suelo, p.x, p.z, ySuelo);
    ySuelo += ((meta === SIN_SUELO ? ySuelo : meta) - ySuelo) * (1 - Math.exp(-30 * DT));
    alimentarLocomocion(e.loc, p.x, p.z, rumbo, DT);
    rig.raiz.position.set(p.x, ySuelo, p.z);
    e.ySuelo = ySuelo;
    aplicarCuerpo(rig, e, t, DT);
    rig.raiz.updateMatrixWorld(true);
    salida.push({
      t,
      pie: [pies[0].getWorldPosition(new Vector3()), pies[1].getWorldPosition(new Vector3())],
      apoyado: [e.caminata.apoyado[0], e.caminata.apoyado[1]],
      ySuelo,
      yMira: rig.columna.getWorldPosition(new Vector3()).y,
      pelvisY: rig.pelvis.getWorldPosition(new Vector3()).y,
      inclinacion: rig.columna.rotation.x,
    });
  }
  return salida;
}

/** Escultórica 1–2: del pie (z = 2,6) a la pasarela (z = −2,6) por x = 3,2. */
const RECTA_SUBE: Recorrido = (s) => ({ x: 3.2, z: 4.6 - s });
const RECTA_BAJA: Recorrido = (s) => ({ x: 3.2, z: -3.6 + s });
/** Caracol: centro y radio medio del recorrido (peldaños entre 0,09 y 1,05 m). */
const C = { x: 2.8, z: 0.7, r: 0.7 };
/** Caracol: sube con el ángulo decreciente (parte del rellano, a0 = 0,35) y baja desde la torre (a0 = −3π − 0,35). */
const caracol =
  (sentido: 1 | -1): Recorrido =>
  (s) => {
    const a = (sentido === 1 ? 0.35 : -3 * Math.PI - 0.35) - sentido * (s / C.r);
    return { x: C.x + C.r * Math.cos(a), z: C.z + C.r * Math.sin(a) };
  };

/** Tolerancia (m) pedida a la altura del pie apoyado respecto de su peldaño. */
const TOLERANCIA = 0.01;
/** Cuadros iniciales que se descartan (la locomoción derivada aún acelera). */
const ARRANQUE = 60;

/**
 * Cuadros donde el pie `k` está en apoyo y sin una arista a menos de 4 mm de su centro (ahí la cara
 * depende de la milésima de milímetro), con la cara bajo el pie según el suelo.
 */
function apoyos(cuadros: Cuadro[], k: 0 | 1): { dy: number; cara: number }[] {
  const salida: { dy: number; cara: number }[] = [];
  let enApoyo = 0; // cuadros seguidos en apoyo
  for (const [i, c] of cuadros.entries()) {
    enApoyo = c.apoyado[k] ? enApoyo + 1 : 0;
    // Los primeros cuadros tras posarse el pie se acomoda a su cara si cayó sobre una arista.
    if (i < ARRANQUE || enApoyo <= PE.cuadrosAcomodo) continue;
    const p = c.pie[k];
    const cara = alturaPie(suelo, p.x, p.z, c.ySuelo);
    if (cara === SIN_SUELO) continue;
    const vecinos = [
      [0.004, 0],
      [-0.004, 0],
      [0, 0.004],
      [0, -0.004],
    ].map(([dx, dz]) => alturaPie(suelo, p.x + (dx as number), p.z + (dz as number), c.ySuelo));
    if (vecinos.some((h) => h !== cara)) continue;
    salida.push({ dy: p.y - cara, cara });
  }
  return salida;
}

beforeEach(() => encenderTodo());
afterEach(() => encenderTodo());

describe('pies en los peldaños (rig completo, cinemática directa)', () => {
  it.each([
    ['escalera recta subiendo, caminando', RECTA_SUBE, PE.velocidadSube, 3.2, 0],
    ['escalera recta bajando, caminando', RECTA_BAJA, PE.velocidadBaja, 3.7, NIVEL_Y.piso2],
    ['escalera recta subiendo, corriendo', RECTA_SUBE, PE.velocidadSubeCorriendo, 2.2, 0],
  ])(
    '%s: el pie apoyado queda a ±1 cm de su peldaño, ni flota ni se hunde',
    (_n, ruta, v, seg, y0) => {
      const cuadros = recorrer(ruta, v, seg + 1, y0);
      for (const k of [0, 1] as const) {
        const a = apoyos(cuadros, k);
        expect(a.length).toBeGreaterThan(20);
        const peor = Math.max(...a.map((m) => Math.abs(m.dy)));
        expect(peor).toBeLessThanOrEqual(TOLERANCIA);
        // De verdad pisó peldaños distintos (no es una prueba en llano).
        const caras = new Set(a.map((m) => m.cara.toFixed(3)));
        expect(caras.size).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it.each([
    ['caracol subiendo', caracol(1), PE.velocidadSube, NIVEL_Y.piso3],
    ['caracol bajando', caracol(-1), PE.velocidadBaja, NIVEL_Y.torre],
  ])('%s: lo mismo en la escalera de caracol', (_n, ruta, v, y0) => {
    const cuadros = recorrer(ruta, v, 3, y0);
    let medidos = 0;
    for (const k of [0, 1] as const) {
      const a = apoyos(cuadros, k).filter(
        (m) => m.cara > NIVEL_Y.piso3 + 0.1 && m.cara < NIVEL_Y.torre - 0.1,
      );
      medidos += a.length;
      for (const m of a) expect(Math.abs(m.dy)).toBeLessThanOrEqual(TOLERANCIA);
    }
    expect(medidos).toBeGreaterThan(20);
  });

  it('el pie en balanceo nunca baja de la cara que tiene debajo (la arista del peldaño siguiente)', () => {
    for (const [ruta, v, y0] of [
      [RECTA_SUBE, PE.velocidadSube, 0],
      [RECTA_SUBE, PE.velocidadSubeCorriendo, 0],
      [RECTA_BAJA, PE.velocidadBaja, NIVEL_Y.piso2],
      [caracol(1), PE.velocidadSube, NIVEL_Y.piso3],
    ] as const) {
      const cuadros = recorrer(ruta, v, 3, y0);
      let enBalanceo = 0;
      for (const c of cuadros.slice(ARRANQUE)) {
        for (const k of [0, 1] as const) {
          if (c.apoyado[k]) continue;
          const p = c.pie[k];
          const cara = alturaPie(suelo, p.x, p.z, c.ySuelo);
          if (cara === SIN_SUELO) continue;
          enBalanceo++;
          expect(p.y).toBeGreaterThanOrEqual(cara - TOLERANCIA);
        }
      }
      expect(enBalanceo).toBeGreaterThan(20);
    }
  });

  it('los pies y la pelvis suben sin saltos de un cuadro al siguiente', () => {
    // Límites por cuadro a 60 cuadros/s (0,1 m = 6 m/s): el pie se levanta o cae rápido en el balanceo pero
    // nunca da un salto de peldaño; la pelvis, 0,03 m subiendo caminando, 0,045 corriendo (~1,7 m/s de promedio) y 0,11 bajando (el alcance de la pierna la obliga a seguir al pie que cae).
    for (const [ruta, v, y0, limitePie, limitePelvis] of [
      [RECTA_SUBE, PE.velocidadSube, 0, 0.13, 0.03],
      [RECTA_BAJA, PE.velocidadBaja, NIVEL_Y.piso2, 0.17, 0.11],
      [caracol(1), PE.velocidadSube, NIVEL_Y.piso3, 0.17, 0.03],
      [RECTA_SUBE, PE.velocidadSubeCorriendo, 0, 0.17, 0.045],
    ] as const) {
      const cuadros = recorrer(ruta, v, 3, y0).slice(ARRANQUE);
      let saltoPie = 0;
      let saltoPelvis = 0;
      for (let i = 1; i < cuadros.length; i++) {
        const a = cuadros[i - 1] as Cuadro;
        const c = cuadros[i] as Cuadro;
        saltoPie = Math.max(
          saltoPie,
          Math.abs(c.pie[0].y - a.pie[0].y),
          Math.abs(c.pie[1].y - a.pie[1].y),
        );
        saltoPelvis = Math.max(saltoPelvis, Math.abs(c.pelvisY - a.pelvisY));
      }
      expect(saltoPie).toBeLessThan(limitePie);
      expect(saltoPelvis).toBeLessThan(limitePelvis);
    }
  });

  it('la pelvis sube con la altura media de los pies, sin hundirse ni estirarse', () => {
    const cuadros = recorrer(RECTA_SUBE, PE.velocidadSube, 4, 0).slice(ARRANQUE);
    for (const c of cuadros) {
      const media = 0.5 * (c.pie[0].y + c.pie[1].y);
      const sobrePies = c.pelvisY - media;
      // La pierna mide 0,62: con un pie un peldaño más arriba la pelvis queda a 0,28–0,66 m de la media.
      expect(sobrePies).toBeGreaterThan(0.28);
      expect(sobrePies).toBeLessThan(0.66);
    }
  });

  it('el cuerpo se inclina hacia delante al subir y algo menos al bajar; en llano casi nada', () => {
    const media = (cuadros: Cuadro[]) => {
      const lista = cuadros.slice(ARRANQUE + 30);
      return lista.reduce((suma, c) => suma + c.inclinacion, 0) / lista.length;
    };
    const sube = media(recorrer(RECTA_SUBE, PE.velocidadSube, 3.2, 0));
    const baja = media(recorrer(RECTA_BAJA, PE.velocidadBaja, 3.2, NIVEL_Y.piso2));
    const llano = media(recorrer((s) => ({ x: -8, z: 6 - 0.5 * s }), 1.25, 3, 0));
    expect(sube).toBeGreaterThan(baja + 0.04);
    expect(baja).toBeGreaterThan(llano);
    expect(sube - llano).toBeGreaterThan(0.1);
    expect(sube - llano).toBeLessThan(0.35);
  });

  it('en llano la pose no cambia: el terreno plano no toca las piernas', () => {
    encenderTodo();
    const { rig } = crearRig();
    const sin = crearEstadoCuerpo('a');
    const con = crearEstadoCuerpo('a');
    con.suelo = suelo;
    const { rig: rig2 } = crearRig();
    for (let i = 0; i < 90; i++) {
      const z = 6 - 0.04 * i;
      for (const [e, r] of [
        [sin, rig],
        [con, rig2],
      ] as const) {
        alimentarLocomocion(e.loc, -8, z, Math.PI, DT);
        r.raiz.position.set(-8, 0, z);
        e.ySuelo = 0;
        aplicarCuerpo(r, e, i * DT, DT);
      }
    }
    expect(rig2.pelvis.position.y).toBeCloseTo(rig.pelvis.position.y, 9);
    expect(rig2.piernas[0].cadera.rotation.x).toBeCloseTo(rig.piernas[0].cadera.rotation.x, 9);
    expect(rig2.piernas[1].rodilla.rotation.x).toBeCloseTo(rig.piernas[1].rodilla.rotation.x, 9);
  });
});

describe('ritmo en escalera', () => {
  it('la pendiente se mide en la escalera y la velocidad máxima baja al subir', () => {
    expect(pendienteSuelo(suelo, 3.2, 0, Math.PI, 1.9)).toBeGreaterThan(PE.pendienteMinima);
    expect(pendienteSuelo(suelo, 3.2, 0, 0, 1.9)).toBeLessThan(-PE.pendienteMinima);
    expect(pendienteSuelo(suelo, -8, 6, 0, 0)).toBeCloseTo(0, 6);
  });
});
