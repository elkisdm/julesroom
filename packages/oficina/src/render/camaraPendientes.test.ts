import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { encenderTodo } from '../animacion/opciones';
import { RADIO_AVATAR } from '../animacion/avatar';
import { crearMapaDeSuelo, puntoLibre } from '../animacion/colision';
import { escenarioMansion } from '../escenarios/mansion';
import { escenarioOficina } from '../escenarios/oficina';
import { escenarioTrading } from '../escenarios/trading';
import { sueloDe } from '../escenarios/suelo';
import { cajaDe, ESPESOR_LOSA, NIVEL_Y } from '../mansion/plano';
import { avanzarSeguimiento, crearSeguimiento, PARAMETROS_SEGUIMIENTO as P } from './camara';
import type { EntradaSeguimiento, EstadoSeguimiento } from './camara';
import { separarObstaculos } from './camaraObstaculos';
import { alturaDeCorteSeguir } from './casa/corte';
import { cajasDeLaCasa, lineaLibre, posicionDe } from './visual';
import type { Caja3 } from './visual';

const DT = 1 / 60;
const TOPE = P.velocidadDistanciaBrazo * DT + 1e-6;
afterEach(encenderTodo);

const entrada = (escenario = escenarioTrading): EntradaSeguimiento => ({
  dt: DT,
  x: 0,
  y: 0,
  z: 0,
  adelante: 0,
  lateral: 0,
  azimut: 0,
  elevacion: (escenario.vistas.seguir.elevacion * Math.PI) / 180,
  distanciaActual: escenario.vistas.seguir.distancia,
  cajas: cajasDeLaCasa(escenario.planta),
  orbitando: true,
});
function paso(s: EstadoSeguimiento, e: EntradaSeguimiento, p = P) {
  avanzarSeguimiento(s, e, p);
  e.distanciaActual = s.distancia;
  e.azimut = s.azimut;
}
const dentro = (c: { x: number; y: number; z: number }, k: Caja3) =>
  c.x > k.x0 && c.x < k.x1 && c.y > k.y0 && c.y < k.y1 && c.z > k.z0 && c.z < k.z1;

/**
 * Cuántos cuadros seguidos lleva cada caja tapando al avatar desde la cámara; tras 3 cuadros de gracia
 * (el desvanecimiento tiene su media vida) la caja tiene que estar casi invisible.
 */
function vigilarTapados(s: EstadoSeguimiento, e: EntradaSeguimiento, racha: Map<Caja3, number>) {
  const cam = posicionDe(s.mira, {
    azimut: s.azimut,
    elevacion: e.elevacion,
    distancia: s.distancia,
  });
  const pecho = { x: e.x, y: e.y + 1, z: e.z };
  s.obstaculos.forEach((k, i) => {
    if (lineaLibre(cam, pecho, [k])) {
      racha.set(k, 0);
      return;
    }
    const n = (racha.get(k) ?? 0) + 1;
    racha.set(k, n);
    if (n > 3) expect(s.opacidadObstaculos[i]).toBeLessThan(0.5);
  });
  return cam;
}

describe('obstáculo angosto: se desvanece en vez de acercar la cámara (órbita manual)', () => {
  for (const escenario of [escenarioTrading, escenarioOficina]) {
    const mapa = crearMapaDeSuelo(sueloDe(escenario));
    const todas = cajasDeLaCasa(escenario.planta);
    const { angostas } = separarObstaculos(todas, P);
    const tapadas: boolean[] = [];
    afterAll(() => {
      expect(tapadas.some(Boolean)).toBe(true);
    });
    for (const columna of escenario.planta.muebles.filter((m) => m.tipo === 'columna')) {
      const c = cajaDe(columna);
      let spot: { x: number; z: number } | null = null;
      for (let lado = 0; lado < 8 && !spot; lado++) {
        const a = (lado * Math.PI) / 4;
        const radio = Math.max(c.x1 - c.x0, c.z1 - c.z0) / 2 + 1;
        const x = columna.x + radio * Math.sin(a);
        const z = columna.z + radio * Math.cos(a);
        if (puntoLibre(mapa, x, z, RADIO_AVATAR, 0)) spot = { x, z };
      }
      it(`${escenario.id}/${columna.id}: 360° a 1 m, sin acortar por la columna y con tope por cuadro`, () => {
        expect(spot).not.toBeNull();
        expect(angostas.length).toBeGreaterThan(0);
        const e = entrada(escenario);
        const { macizas, angostas: propias } = separarObstaculos(e.cajas, P);
        const angostasPropias = new Set(propias);
        e.x = spot!.x;
        e.z = spot!.z;
        const ref = { ...entrada(escenario), cajas: macizas, x: e.x, z: e.z };
        const s = crearSeguimiento();
        const r = crearSeguimiento();
        for (let i = 0; i < 120; i++) {
          paso(s, e);
          paso(r, ref);
        }
        let tapada = false;
        let desvanecida = false;
        for (let i = 0; i < 480; i++) {
          const antes = s.distancia;
          e.azimut += (2 * Math.PI * DT) / 8;
          ref.azimut = e.azimut;
          paso(s, e);
          paso(r, ref);
          expect(Math.abs(s.distancia - antes)).toBeLessThanOrEqual(TOPE);
          // Distancia idéntica a la de un mundo sin esa columna: no baja por su culpa.
          expect(s.distancia).toBeCloseTo(r.distancia, 6);
          const cam = posicionDe(s.mira, {
            azimut: s.azimut,
            elevacion: e.elevacion,
            distancia: s.distancia,
          });
          const pecho = { x: e.x, y: e.y + 1, z: e.z };
          s.obstaculos.forEach((k, idx) => {
            if (!angostasPropias.has(k) || lineaLibre(cam, pecho, [k])) return;
            tapada = true;
            if (s.opacidadObstaculos[idx]! < 0.5) desvanecida = true;
          });
        }
        if (tapada) expect(desvanecida).toBe(true);
        tapadas.push(tapada);
      });
    }
  }

  it('sin nada que la tape, el obstáculo vuelve a verse (todo opaco) y no parpadea', () => {
    const escenario = escenarioTrading;
    const columna = escenario.planta.muebles.find((m) => m.tipo === 'columna')!;
    const c = cajaDe(columna);
    const e = entrada(escenario);
    e.x = columna.x;
    e.z = c.z1 + 1.5;
    const s = crearSeguimiento();
    let transiciones = 0;
    let previo = false;
    for (let i = 0; i < 900; i++) {
      e.azimut = i < 450 ? Math.PI : 0;
      paso(s, e);
      const oculto = s.opacidadObstaculos.some((o) => o < 0.5);
      if (oculto !== previo) transiciones++;
      previo = oculto;
    }
    expect(transiciones).toBeLessThanOrEqual(2);
    expect(Math.min(...s.opacidadObstaculos)).toBe(1);
  });

  it('un muro nunca es angosto', () => {
    for (const escenario of [escenarioTrading, escenarioOficina, escenarioMansion]) {
      const muros = escenario.planta.muros.filter(
        (m) => m.tipo === 'muro' && m.hasta - m.desde > 3,
      ).length;
      expect(muros).toBeGreaterThan(0);
      const { angostas } = separarObstaculos(cajasDeLaCasa(escenario.planta), P);
      for (const k of angostas)
        expect(Math.max(k.x1 - k.x0, k.z1 - k.z0)).toBeLessThanOrEqual(P.anchoAngosto);
    }
  });
});

describe('órbita muy rápida junto a un muro: el rescate también respeta el tope', () => {
  for (const escenario of [escenarioTrading, escenarioOficina, escenarioMansion]) {
    const mapa = crearMapaDeSuelo(sueloDe(escenario));
    const muros = escenario.planta.muros.filter((m) => m.tipo === 'muro' && m.hasta - m.desde > 3);
    for (const muro of muros) {
      const ejeX = muro.eje === 'x';
      const y = NIVEL_Y[muro.nivel];
      const mitad = (muro.desde + muro.hasta) / 2;
      const cara = [1, -1].find((k) =>
        puntoLibre(
          mapa,
          ejeX ? muro.pos + k * 0.4 : mitad,
          ejeX ? mitad : muro.pos + k * 0.4,
          RADIO_AVATAR,
          y,
        ),
      );
      if (cara === undefined) continue;
      for (const velocidad of [6, 12, 25]) {
        it(`${escenario.id}/${muro.id} a ${velocidad} rad/s`, () => {
          const e = entrada(escenario);
          e.x = ejeX ? muro.pos + cara * 0.4 : mitad;
          e.z = ejeX ? mitad : muro.pos + cara * 0.4;
          e.y = y;
          const s = crearSeguimiento();
          for (let i = 0; i < 180; i++) paso(s, e);
          const racha = new Map<Caja3, number>();
          for (let i = 0; i < 180; i++) {
            const antes = s.distancia;
            e.azimut += velocidad * DT;
            paso(s, e);
            expect(Math.abs(s.distancia - antes)).toBeLessThanOrEqual(TOPE);
            vigilarTapados(s, e, racha);
          }
        });
      }
    }
  }
});

describe('mansión: el corte del avatar resuelve losas y techos', () => {
  // Decisión (ADR-0016): las losas no entran en la colisión de la cámara porque el corte de seguir
  // oculta todo lo que queda sobre el cielo del piso del avatar, incluida esa losa. Añadirlas
  // forzaría a la cámara a quedar bajo ella (a 35° y 10,5 m, a menos de 3,3 m del avatar) y
  // destruiría la vista de casa de muñecas. Lo que sí se exige: la losa de arriba queda siempre
  // sobre el corte (oculta) y la cámara nunca queda bajo el piso del avatar.
  const niveles = Object.entries(NIVEL_Y) as [string, number][];
  for (const [nombre, base] of niveles) {
    const arriba = niveles.map(([, v]) => v).find((v) => v > base + 0.05);
    it(`${nombre}: la losa de arriba queda oculta por el corte y la cámara no baja del piso`, () => {
      if (arriba !== undefined) {
        expect(arriba - ESPESOR_LOSA).toBeGreaterThanOrEqual(alturaDeCorteSeguir(base));
      }
      for (const elevacion of [5, 35, 65]) {
        const e = entrada(escenarioMansion);
        e.y = base;
        e.cajas = [];
        e.elevacion = (elevacion * Math.PI) / 180;
        const s = crearSeguimiento();
        for (let i = 0; i < 360; i++) {
          e.azimut += (2 * Math.PI * DT) / 6;
          paso(s, e);
          const cam = posicionDe(s.mira, {
            azimut: s.azimut,
            elevacion: e.elevacion,
            distancia: s.distancia,
          });
          expect(cam.y).toBeGreaterThanOrEqual(base);
        }
      }
    });
  }
});

describe('envolvente exterior: la cámara no queda del otro lado de un muro opaco', () => {
  for (const escenario of [escenarioTrading, escenarioOficina, escenarioMansion]) {
    const mapa = crearMapaDeSuelo(sueloDe(escenario));
    const muros = escenario.planta.muros.filter((m) => m.tipo === 'muro');
    for (const eje of ['x', 'z'] as const) {
      const mismos = muros.filter((m) => m.eje === eje);
      if (mismos.length === 0) continue;
      const minimo = Math.min(...mismos.map((m) => m.pos));
      const maximo = Math.max(...mismos.map((m) => m.pos));
      for (const muro of mismos.filter((m) => m.pos === minimo || m.pos === maximo)) {
        const adentro = muro.pos === minimo ? 1 : -1;
        const y = NIVEL_Y[muro.nivel];
        it(`${escenario.id}/${muro.id}: 360° a 0,4 m`, () => {
          const mitad = (muro.desde + muro.hasta) / 2;
          const x = eje === 'x' ? muro.pos + adentro * 0.4 : mitad;
          const z = eje === 'x' ? mitad : muro.pos + adentro * 0.4;
          if (!puntoLibre(mapa, x, z, RADIO_AVATAR, y)) return;
          const e = entrada(escenario);
          e.x = x;
          e.z = z;
          e.y = y;
          const s = crearSeguimiento();
          for (let i = 0; i < 120; i++) paso(s, e);
          const racha = new Map<Caja3, number>();
          for (let i = 0; i < 480; i++) {
            e.azimut += (2 * Math.PI * DT) / 8;
            paso(s, e);
            vigilarTapados(s, e, racha);
          }
        });
      }
    }
  }
});

it('sin cajas dentro de la cámara: ninguna caja del mundo contiene a la cámara en órbita manual', () => {
  const e = entrada();
  const cajas = e.cajas;
  const s = crearSeguimiento();
  const columna = escenarioTrading.planta.muebles.find((m) => m.tipo === 'columna')!;
  e.x = columna.x;
  e.z = cajaDe(columna).z1 + 1;
  for (let i = 0; i < 600; i++) {
    e.azimut += (2 * Math.PI * DT) / 8;
    paso(s, e);
    const cam = posicionDe(s.mira, {
      azimut: s.azimut,
      elevacion: e.elevacion,
      distancia: s.distancia,
    });
    const { macizas } = separarObstaculos(cajas, P);
    for (const k of macizas) expect(dentro(cam, k)).toBe(false);
  }
});

it('si un muro aparece mientras la cámara llega desde la general, no hay salto: baja a lo más al ritmo de la llegada', () => {
  const escenario = escenarioTrading;
  const e = entrada(escenario);
  const muro = escenario.planta.muros.find((m) => m.id === 'tabique-aula')!;
  e.x = muro.pos + 0.4;
  e.z = (muro.desde + muro.hasta) / 2;
  e.distanciaActual = 30;
  const libre = { ...entrada(escenario), cajas: [], x: e.x, z: e.z, distanciaActual: 30 };
  const s = crearSeguimiento();
  const r = crearSeguimiento();
  for (let i = 0; i < 300; i++) {
    const antes = s.distancia;
    const antesRef = r.distancia;
    e.azimut += 12 * DT * (i > 20 ? 1 : 0);
    libre.azimut = e.azimut;
    paso(s, e);
    paso(r, libre);
    expect(antes - s.distancia).toBeLessThanOrEqual(Math.max(TOPE, antesRef - r.distancia) + 1e-6);
  }
});
