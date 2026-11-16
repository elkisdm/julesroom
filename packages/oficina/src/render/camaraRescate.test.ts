import { afterEach, describe, expect, it } from 'vitest';
import { encenderTodo } from '../animacion/opciones';
import { escenarioMansion } from '../escenarios/mansion';
import { escenarioOficina } from '../escenarios/oficina';
import { escenarioTrading } from '../escenarios/trading';
import { avanzarSeguimiento, crearSeguimiento, PARAMETROS_SEGUIMIENTO as P } from './camara';
import type { EntradaSeguimiento, EstadoSeguimiento } from './camara';
import { cajasDeEnvolvente } from './camaraColision';
import { alturaDeCorteSeguir, SIN_CORTE } from './casa/corte';
import { cajasDeLaCasa, lineaLibre, posicionDe } from './visual';
import type { Caja3 } from './visual';

const DT = 1 / 60;
const GRADOS = Math.PI / 180;
afterEach(encenderTodo);

const entrada = (escenario = escenarioMansion): EntradaSeguimiento => ({
  dt: DT,
  x: 0,
  y: 0,
  z: 0,
  adelante: 0,
  lateral: 0,
  azimut: 0,
  elevacion: (escenario.vistas.seguir.elevacion * Math.PI) / 180,
  distanciaActual: escenario.vistas.seguir.distancia,
  cajas: [],
  orbitando: true,
});
function paso(s: EstadoSeguimiento, e: EntradaSeguimiento) {
  avanzarSeguimiento(s, e, P);
  e.distanciaActual = s.distancia;
  e.azimut = s.azimut;
}
const camaraDe = (s: EstadoSeguimiento) =>
  posicionDe(s.mira, { azimut: s.azimut, elevacion: s.elevacion, distancia: s.distancia });

describe('Jules entre la cámara y el avatar', () => {
  // Avatar en el origen, cámara hacia z+ a 35°: la línea cámara→avatar sube 0,7 m por metro de z.
  const conJules = (x: number, z: number, orbitando: boolean) => {
    const e = entrada();
    e.orbitando = orbitando;
    e.asistente = { x, y: 0, z };
    return e;
  };

  for (const orbitando of [true, false]) {
    it(`se desvanece cuando tapa al avatar (orbitando: ${orbitando})`, () => {
      const e = conJules(0, 1, orbitando);
      const s = crearSeguimiento();
      for (let i = 0; i < 30; i++) paso(s, e);
      expect(s.asistenteActivo).toBe(true);
      expect(s.opacidadAsistente).toBeLessThan(0.1);
    });
  }

  it('a un costado, donde no tapa, queda opaca', () => {
    const e = conJules(1.8, 0.4, true);
    const s = crearSeguimiento();
    for (let i = 0; i < 60; i++) paso(s, e);
    expect(s.opacidadAsistente).toBe(1);
  });

  it('a su distancia de acompañar (1,1 m) pegada al costado no se desvanece sola', () => {
    const e = conJules(1.1, 0, true);
    const s = crearSeguimiento();
    for (let i = 0; i < 60; i++) paso(s, e);
    expect(s.opacidadAsistente).toBe(1);
  });

  it('no mueve la cámara: la distancia es la misma con y sin ella', () => {
    const con = conJules(0, 1, true);
    const sin = entrada();
    const sc = crearSeguimiento();
    const ss = crearSeguimiento();
    for (let i = 0; i < 120; i++) {
      paso(sc, con);
      paso(ss, sin);
      expect(sc.distancia).toBe(ss.distancia);
      expect(sc.azimut).toBe(ss.azimut);
    }
  });

  it('reaparece tras apartarse, una vez pasada la espera', () => {
    const e = conJules(0, 1, true);
    const s = crearSeguimiento();
    for (let i = 0; i < 30; i++) paso(s, e);
    e.asistente = { x: 3, y: 0, z: 0.4 };
    for (let i = 0; i < Math.round((P.esperaReaparecer / DT) * 0.5); i++) paso(s, e);
    expect(s.opacidadAsistente).toBeLessThan(0.1);
    for (let i = 0; i < 120; i++) paso(s, e);
    expect(s.opacidadAsistente).toBeGreaterThan(0.99);
  });

  it('sin asistente en la entrada no hay caja ni desvanecimiento', () => {
    const e = entrada();
    const s = crearSeguimiento();
    for (let i = 0; i < 30; i++) paso(s, e);
    expect(s.asistenteActivo).toBe(false);
    expect(s.opacidadAsistente).toBe(1);
  });

  it('la caja que se dibuja cubre su cuerpo y su anillo, de los pies a la cabeza', () => {
    const e = conJules(0, 1, true);
    e.asistente = { x: 0, y: 3.9, z: 1 };
    const s = crearSeguimiento();
    paso(s, e);
    const c = s.cajaAsistente;
    expect(c.x1 - c.x0).toBeGreaterThanOrEqual(2 * P.radioAnilloAsistente);
    expect(c.y0).toBeCloseTo(3.9, 6);
    expect(c.y1 - c.y0).toBeGreaterThanOrEqual(P.altoAsistente);
  });
});

describe('techo de la cámara bajo la losa del piso del avatar', () => {
  const barrido = (y: number, desde: number, hasta: number, conTecho = true, cuadros = 180) => {
    const e = entrada();
    e.y = y;
    if (conTecho) e.techo = alturaDeCorteSeguir(y);
    const s = crearSeguimiento();
    const camaras: { y: number; elevacion: number; distancia: number; pedida: number }[] = [];
    for (let i = 0; i < cuadros; i++) {
      e.elevacion = (desde + ((hasta - desde) * i) / (cuadros - 1)) * GRADOS;
      paso(s, e);
      camaras.push({
        y: camaraDe(s).y,
        elevacion: s.elevacion,
        distancia: s.distancia,
        pedida: e.elevacion,
      });
    }
    return camaras;
  };

  for (const [nombre, y] of [
    ['planta baja', 0],
    ['primer piso', 3.9],
    ['segundo piso', 7.8],
  ] as const) {
    const tope = alturaDeCorteSeguir(y) - P.margenTecho;
    it(`${nombre}: subiendo o bajando la elevación, la cámara no pasa de ${tope.toFixed(2)} m y la distancia no cambia`, () => {
      for (const [a, b] of [
        [5, 70],
        [70, 5],
      ]) {
        const c = barrido(y, a!, b!);
        for (const f of c) expect(f.y).toBeLessThanOrEqual(tope + 1e-6);
        // El techo se aplica sobre la elevación: la distancia es la misma que sin techo.
        const libre = barrido(y, a!, b!, false);
        c.forEach((f, i) => expect(f.distancia).toBe(libre[i]!.distancia));
      }
    });
  }

  it('en el primer piso la órbita vertical sigue respondiendo bajo el techo', () => {
    const c = barrido(3.9, 5, 70);
    // Mientras la elevación pedida cabe bajo el techo, la cámara la sigue tal cual.
    expect(c[0]!.elevacion).toBeCloseTo(5 * GRADOS, 6);
    expect(c[10]!.elevacion).toBeGreaterThan(c[0]!.elevacion);
    expect(c[10]!.y).toBeGreaterThan(c[0]!.y);
    // Y sube de forma continua hasta topar con el techo.
    for (let i = 1; i < c.length; i++) expect(c[i]!.y).toBeGreaterThanOrEqual(c[i - 1]!.y - 1e-9);
  });

  it('en el último nivel (sin corte) no hay techo', () => {
    const e = entrada();
    e.y = 11.7;
    e.techo = alturaDeCorteSeguir(11.7);
    expect(e.techo).toBe(SIN_CORTE);
    e.elevacion = 60 * GRADOS;
    const s = crearSeguimiento();
    paso(s, e);
    expect(s.elevacion).toBeCloseTo(60 * GRADOS, 6);
  });

  it('sin techo en la entrada (trading, oficina) la elevación no se toca', () => {
    const e = entrada(escenarioTrading);
    e.elevacion = 60 * GRADOS;
    const s = crearSeguimiento();
    paso(s, e);
    expect(s.elevacion).toBeCloseTo(60 * GRADOS, 6);
  });

  it('al bajar de piso el tope baja a ritmo acotado: la cámara no salta', () => {
    const e = entrada();
    e.elevacion = 25 * GRADOS;
    const s = crearSeguimiento();
    e.y = 3.9;
    e.techo = alturaDeCorteSeguir(3.9);
    for (let i = 0; i < 60; i++) paso(s, e);
    let anterior = camaraDe(s);
    let pasoMax = 0;
    for (let i = 0; i < 180; i++) {
      const k = Math.min(1, i / 120);
      e.y = 3.9 * (1 - k);
      e.techo = alturaDeCorteSeguir(e.y);
      paso(s, e);
      const c = camaraDe(s);
      pasoMax = Math.max(pasoMax, Math.hypot(c.x - anterior.x, c.y - anterior.y, c.z - anterior.z));
      anterior = c;
    }
    expect(pasoMax).toBeLessThan(0.2);
    expect(anterior.y).toBeLessThanOrEqual(alturaDeCorteSeguir(0) - P.margenTecho + 1e-6);
  });
});

describe('envolvente exterior de la oficina', () => {
  const envolvente = cajasDeEnvolvente(
    escenarioOficina.planta,
    P.altoEnvolvente,
    P.espesorEnvolvente,
  );
  const oeste = envolvente.findIndex((c) => c.x1 < -16);
  const este = envolvente.findIndex((c) => c.x0 > 16);
  const fondo = envolvente.findIndex((c) => c.z1 < -11);

  it('se arma con los muros de borde de un escenario de un solo nivel: fondo, oeste y este', () => {
    expect(envolvente).toHaveLength(3);
    expect([oeste, este, fondo].every((i) => i >= 0)).toBe(true);
    for (const c of envolvente) {
      expect(c.y0).toBe(0);
      expect(c.y1).toBe(P.altoEnvolvente);
    }
    expect(envolvente[oeste]!.x0).toBeLessThan(-17);
    expect(envolvente[oeste]!.x1).toBeGreaterThan(-17);
  });

  it('la mansión (varios niveles, vidrio) no tiene envolvente que desvanecer', () => {
    expect(
      cajasDeEnvolvente(escenarioMansion.planta, P.altoEnvolvente, P.espesorEnvolvente),
    ).toEqual([]);
  });

  const junto = (azimut: number, orbitando: boolean) => {
    const e = entrada(escenarioOficina);
    e.x = -16.2;
    e.z = 3.5;
    e.azimut = azimut;
    e.orbitando = orbitando;
    e.fantasmas = envolvente;
    return e;
  };

  for (const orbitando of [true, false]) {
    it(`con la cámara del otro lado del muro, ese muro se desvanece y la distancia no cambia (orbitando: ${orbitando})`, () => {
      const e = junto(-Math.PI / 2, orbitando);
      const s = crearSeguimiento();
      for (let i = 0; i < 60; i++) paso(s, e);
      const k = s.obstaculos.indexOf(envolvente[oeste]!);
      expect(s.opacidadObstaculos[k]).toBeLessThan(0.1);
      expect(s.opacidadObstaculos[s.obstaculos.indexOf(envolvente[este]!)]).toBe(1);
      expect(s.opacidadObstaculos[s.obstaculos.indexOf(envolvente[fondo]!)]).toBe(1);
      const sin = crearSeguimiento();
      const eSin = junto(-Math.PI / 2, orbitando);
      eSin.fantasmas = undefined;
      for (let i = 0; i < 60; i++) paso(sin, eSin);
      expect(s.distancia).toBe(sin.distancia);
    });
  }

  it('con la cámara dentro de la sala los muros quedan opacos', () => {
    const e = junto(0, true);
    const s = crearSeguimiento();
    for (let i = 0; i < 60; i++) paso(s, e);
    expect(s.opacidadObstaculos.every((o) => o === 1)).toBe(true);
  });

  for (const [nombre, x, z] of [
    ['fondo', 0, -11.2],
    ['oeste', -16.2, 3.5],
    ['este', 16.2, 2],
    ['rincón noroeste', -15.2, -11],
  ] as const) {
    it(`órbita de 360° pegado al muro ${nombre}: la distancia no baja de 4 m y cada muro que tapa se desvanece`, () => {
      const e = entrada(escenarioOficina);
      e.x = x;
      e.z = z;
      e.cajas = cajasDeLaCasa(escenarioOficina.planta);
      e.fantasmas = envolvente;
      const s = crearSeguimiento();
      for (let i = 0; i < 120; i++) paso(s, e);
      const pecho = { x, y: 0.85, z };
      const racha = new Map<Caja3, number>();
      let minimo = Infinity;
      for (let i = 0; i < 720; i++) {
        e.azimut += (2 * Math.PI) / 360;
        e.elevacion = (escenarioOficina.vistas.seguir.elevacion * Math.PI) / 180;
        paso(s, e);
        const c = camaraDe(s);
        minimo = Math.min(minimo, Math.hypot(c.x - x, c.y - 1, c.z - z));
        envolvente.forEach((muro) => {
          const k = s.obstaculos.indexOf(muro);
          if (lineaLibre(c, pecho, [muro])) {
            racha.set(muro, 0);
            return;
          }
          const n = (racha.get(muro) ?? 0) + 1;
          racha.set(muro, n);
          if (n > 3) expect(s.opacidadObstaculos[k]).toBeLessThan(0.5);
        });
      }
      expect(minimo).toBeGreaterThanOrEqual(4);
    });
  }
});
