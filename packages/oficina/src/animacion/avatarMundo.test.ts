import { afterEach, describe, expect, it } from 'vitest';
import { escenarioMansion } from '../escenarios/mansion';
import { escenarioTrading } from '../escenarios/trading';
import { AULA, DESCANSO } from '../escenarios/trading/plano';
import { alturaEn, CONTRAHUELLA_MAX, crearSuelo, sueloDe } from '../escenarios/suelo';
import { NIVEL_Y, plano } from '../mansion/plano';
import {
  avanzarAvatar,
  crearAvatar,
  crearMando,
  fijarDestino,
  PARAMETROS_AVATAR,
  RADIO_AVATAR,
  saltar,
} from './avatar';
import type { Avatar, Mando } from './avatar';
import { crearMapaDeSuelo, puntoLibre } from './colision';
import { crearNavegacion } from './navegacion';
import { encenderTodo } from './opciones';

const DT = 1 / 60;
const EPS = 1e-6;

function mundo(e: typeof escenarioMansion) {
  const suelo = sueloDe(e);
  const mapa = crearMapaDeSuelo(suelo);
  return { suelo, mapa, nav: crearNavegacion(mapa, 0.25, RADIO_AVATAR) };
}
const mansion = mundo(escenarioMansion);
const trading = mundo(escenarioTrading);

interface Registro {
  y: number[];
  yCuerpo: number[];
  x: number[];
  z: number[];
}

/** Avanza hasta `n` cuadros (o hasta que `fin` se cumpla) y registra la trayectoria. */
function correr(
  a: Avatar,
  m: Mando,
  w: ReturnType<typeof mundo>,
  n: number,
  fin: (a: Avatar) => boolean = () => false,
  az = 0,
): Registro {
  const r: Registro = { y: [a.y], yCuerpo: [a.yCuerpo], x: [a.x], z: [a.z] };
  for (let i = 0; i < n && !fin(a); i++) {
    avanzarAvatar(a, m, az, w.mapa, w.nav, PARAMETROS_AVATAR, DT);
    r.y.push(a.y);
    r.yCuerpo.push(a.yCuerpo);
    r.x.push(a.x);
    r.z.push(a.z);
  }
  return r;
}

const monotona = (v: number[], signo: 1 | -1) =>
  v.every((y, i) => i === 0 || signo * (y - v[i - 1]!) >= -EPS);
const saltoMaximo = (v: number[]) =>
  v.reduce((max, y, i) => (i === 0 ? 0 : Math.max(max, Math.abs(y - v[i - 1]!))), 0);

afterEach(() => encenderTodo());

describe('avatar en la escultórica 1–2 (recta)', () => {
  const t = plano.escaleras[0]!.tramos[0]!;
  const dentro = (x: number) =>
    x - RADIO_AVATAR >= t.desde.x - t.ancho / 2 - 0.05 - EPS && x + RADIO_AVATAR <= 4 - 0.1 + EPS;

  for (const corriendo of [false, true]) {
    it(`sube ${corriendo ? 'corriendo' : 'caminando'}: altura monótona, de a un peldaño por cuadro, sin cruzar la baranda`, () => {
      const a = crearAvatar(t.desde.x, t.desde.z + 0.8, Math.PI, 0);
      const m = crearMando();
      m.adelante = 1; // azimut 0: adelante es −z, hacia arriba de la escalera
      m.lateral = -0.25; // empuja contra la baranda del atrio
      m.correr = corriendo;
      const r = correr(a, m, mansion, 600, (q) => q.z < -3);
      expect(a.y).toBeCloseTo(NIVEL_Y.piso2, 6);
      expect(a.enSuelo).toBe(true);
      expect(monotona(r.y, 1)).toBe(true);
      expect(monotona(r.yCuerpo, 1)).toBe(true);
      expect(saltoMaximo(r.y)).toBeLessThanOrEqual(CONTRAHUELLA_MAX + EPS);
      // Lo visible sube suave: nunca un peldaño entero de golpe.
      expect(saltoMaximo(r.yCuerpo)).toBeLessThanOrEqual(0.6 * CONTRAHUELLA_MAX);
      r.x.forEach((x, i) => {
        if (r.z[i]! < t.desde.z && r.z[i]! > t.hasta.z) expect(dentro(x), `x ${x}`).toBe(true);
      });
    });

    it(`baja ${corriendo ? 'corriendo' : 'caminando'}: altura monótona y sin caídas`, () => {
      const a = crearAvatar(t.hasta.x, t.hasta.z - 0.5, 0, NIVEL_Y.piso2);
      const m = crearMando();
      m.adelante = -1; // +z: escalera abajo
      m.correr = corriendo;
      const r = correr(a, m, mansion, 600, (q) => q.z > t.desde.z + 0.4);
      expect(a.y).toBeCloseTo(0, 6);
      expect(monotona(r.y, -1)).toBe(true);
      expect(monotona(r.yCuerpo, -1)).toBe(true);
      expect(saltoMaximo(r.y)).toBeLessThanOrEqual(CONTRAHUELLA_MAX + EPS);
      expect(saltoMaximo(r.yCuerpo)).toBeLessThanOrEqual(0.6 * CONTRAHUELLA_MAX);
      expect(r.y.length).toBeLessThan(600);
    });
  }
});

describe('avatar con cuadros largos y alturas que cambian lo que bloquea', () => {
  it('a 10 fps sube corriendo la recta sin trabarse en los peldaños', () => {
    const t = plano.escaleras[0]!.tramos[0]!;
    const a = crearAvatar(t.desde.x, t.desde.z + 0.8, Math.PI, 0);
    const m = crearMando();
    m.adelante = 1;
    m.correr = true;
    let cuadros = 0;
    while (a.z > t.hasta.z + 0.2 && cuadros < 100) {
      avanzarAvatar(a, m, 0, mansion.mapa, mansion.nav, PARAMETROS_AVATAR, 0.1);
      cuadros++;
    }
    // 6 m a 4,8 m/s: unos 14 cuadros de 0,1 s; trabándose en los peldaños, 23.
    expect(cuadros).toBeLessThan(18);
    expect(a.y).toBeCloseTo(NIVEL_Y.piso2, 6);
  });

  it('al subir a una tarima bajo una viga, el cuerpo no queda dentro de la viga', () => {
    const datos = {
      limites: { x0: 0, x1: 10, z0: 0, z1: 10 },
      superficies: [
        {
          id: 'piso',
          tipo: 'losa' as const,
          forma: 'caja' as const,
          x0: 0,
          x1: 10,
          z0: 0,
          z1: 10,
          y: 0,
          grosor: 0.3,
        },
        {
          id: 'tarima',
          tipo: 'tarima' as const,
          forma: 'caja' as const,
          x0: 4,
          x1: 6,
          z0: 0,
          z1: 10,
          y: 0.25,
          grosor: 0.25,
        },
      ],
      // Viga baja: no estorba en el piso (1,86 > 1,7) pero sí sobre la tarima (1,86 < 0,25 + 1,7).
      solidos: [
        { id: 'viga', tipo: 'muro' as const, x0: 4.2, x1: 6, z0: 0, z1: 10, y0: 1.86, y1: 3 },
      ],
    };
    const suelo = crearSuelo(datos);
    const mapa = crearMapaDeSuelo(suelo);
    const w = { suelo, mapa, nav: crearNavegacion(mapa, 0.25, RADIO_AVATAR) };
    const a = crearAvatar(2, 5, Math.PI / 2, 0);
    const m = crearMando();
    m.lateral = 1;
    for (let i = 0; i < 180; i++) {
      avanzarAvatar(a, m, 0, w.mapa, w.nav, PARAMETROS_AVATAR, DT);
      expect(puntoLibre(w.mapa, a.x, a.z, RADIO_AVATAR, a.y), `cuadro ${i}`).toBe(true);
    }
    expect(a.x).toBeLessThan(4.2);
  });
});

describe('avatar en el caracol (por clic)', () => {
  const eje = { x: 2.8, z: 0.7 };
  // Sobre los peldaños con balaustre (los tres últimos no lo llevan: por ahí se sale a la torre).
  const enCaracol = (x: number, z: number, y: number) =>
    Math.hypot(x - eje.x, z - eje.z) < 1.05 &&
    y > NIVEL_Y.piso3 + 0.05 &&
    y < NIVEL_Y.torre - 3 * 0.1625 - 0.05;

  for (const corriendo of [false, true]) {
    it(`sube del rellano a la azotea ${corriendo ? 'corriendo' : 'caminando'}`, () => {
      const a = crearAvatar(0, 0, 0, NIVEL_Y.piso3);
      const m = crearMando();
      fijarDestino(m, 8, 0, corriendo, NIVEL_Y.torre);
      const r = correr(a, m, mansion, 60 * 40, (q) => q.nRuta > 0 && q.iRuta >= q.nRuta);
      expect(Math.hypot(a.x - 8, a.z)).toBeLessThan(0.3);
      expect(a.y).toBeCloseTo(NIVEL_Y.torre, 6);
      expect(monotona(r.y, 1)).toBe(true);
      expect(saltoMaximo(r.y)).toBeLessThanOrEqual(CONTRAHUELLA_MAX + EPS);
      let pasos = 0;
      r.y.forEach((y, i) => {
        if (!enCaracol(r.x[i]!, r.z[i]!, y)) return;
        pasos++;
        // Nunca atraviesa los balaustres (r = 1, contacto de 0,2 m) ni la columna.
        const d = Math.hypot(r.x[i]! - eje.x, r.z[i]! - eje.z);
        expect(d).toBeLessThanOrEqual(0.82);
        expect(d).toBeGreaterThanOrEqual(0.25);
      });
      expect(pasos).toBeGreaterThan(30);
    });
  }

  it('baja de la torre al rellano: altura monótona', () => {
    const a = crearAvatar(-1, -2, 0, NIVEL_Y.torre);
    const m = crearMando();
    fijarDestino(m, 0, 0, false, NIVEL_Y.piso3);
    const r = correr(a, m, mansion, 60 * 40, (q) => q.nRuta > 0 && q.iRuta >= q.nRuta);
    expect(a.y).toBeCloseTo(NIVEL_Y.piso3, 6);
    expect(monotona(r.y, -1)).toBe(true);
    expect(saltoMaximo(r.y)).toBeLessThanOrEqual(CONTRAHUELLA_MAX + EPS);
  });

  it('un clic en otra planta (del piso 1 al piso 2) lleva por la escalera', () => {
    const a = crearAvatar(12, 0, 0, 0);
    const m = crearMando();
    fijarDestino(m, -10, 2, false, NIVEL_Y.piso2);
    correr(a, m, mansion, 60 * 40, (q) => q.nRuta > 0 && q.iRuta >= q.nRuta);
    expect(a.y).toBeCloseTo(NIVEL_Y.piso2, 6);
    expect(Math.hypot(a.x + 10, a.z - 2)).toBeLessThan(0.3);
  });
});

describe('salto con física de mundo (trading)', () => {
  it('saltando hacia el sofá aterriza sobre él; caminando se detiene ante él', () => {
    const { x, z } = DESCANSO.sofa;
    // Sin saltar: el sofá (0,45) corta el paso.
    const a = crearAvatar(x - 1.4, z, Math.PI / 2, 0);
    const m = crearMando();
    m.lateral = 1; // +x
    correr(a, m, trading, 90);
    expect(a.y).toBe(0);
    expect(a.x).toBeLessThan(x - 0.45 + 0.05);
    // Saltando: aterriza encima.
    const b = crearAvatar(x - 1.4, z, Math.PI / 2, 0);
    const n = crearMando();
    n.lateral = 1;
    correr(b, n, trading, 6);
    saltar(n);
    const r = correr(b, n, trading, 45);
    n.lateral = 0;
    correr(b, n, trading, 30);
    expect(b.enSuelo).toBe(true);
    expect(b.y).toBeCloseTo(0.45, 6);
    expect(Math.max(...r.y)).toBeGreaterThan(0.45);
  });

  it('salta a la tarima del aula y aterriza en ella', () => {
    const t = AULA.tarima;
    const cx = (t.x0 + t.x1) / 2;
    const a = crearAvatar(cx, t.z1 + 1, Math.PI, 0);
    const m = crearMando();
    m.adelante = 1; // −z, hacia la tarima
    correr(a, m, trading, 10);
    saltar(m);
    correr(a, m, trading, 40);
    m.adelante = 0;
    correr(a, m, trading, 30);
    expect(a.enSuelo).toBe(true);
    expect(a.y).toBeCloseTo(t.alto, 6);
    expect(a.z).toBeLessThan(t.z1);
  });

  it('cae con gravedad al salir del borde de la grada alta y aterriza en el piso', () => {
    const f2 = AULA.filas[2]!;
    const a = crearAvatar(-14, -6.0, 0, f2.y);
    const m = crearMando();
    m.adelante = -1; // +z, fuera de la grada
    const r = correr(a, m, trading, 120, (q) => q.z > -4.8);
    expect(a.y).toBe(0);
    expect(a.enSuelo).toBe(true);
    // Hubo cuadros en el aire con la altura entre la grada y el piso (no se teletransportó).
    const intermedios = r.y.filter((y) => y > 0.02 && y < f2.y - 0.02);
    expect(intermedios.length).toBeGreaterThan(1);
    expect(monotona(r.y, -1)).toBe(true);
  });

  it('un salto en el piso vuelve al piso y la raíz no sube con el arco (la pelvis sí)', () => {
    const a = crearAvatar(0, 5, 0, 0);
    const m = crearMando();
    saltar(m);
    const r = correr(a, m, trading, 60);
    expect(Math.max(...r.y)).toBeGreaterThan(1);
    expect(a.y).toBe(0);
    expect(a.ySuelo).toBe(0);
    expect(a.loc.salto.y).toBeCloseTo(0, 6);
  });
});

describe('costo', () => {
  it('100 consultas alturaEn + 1 avatar por cuadro: medido', () => {
    const { suelo } = mansion;
    const a = crearAvatar(t0.x, t0.z, Math.PI, 0);
    const m = crearMando();
    m.adelante = 1;
    const puntos = Array.from({ length: 100 }, (_, i) => [
      ((i * 7.3) % 30) - 15,
      ((i * 3.1) % 8) - 4,
    ]);
    const cuadros = 2000;
    let acumulado = 0;
    // Calentamiento del JIT.
    for (let i = 0; i < 200; i++)
      avanzarAvatar(a, m, 0, mansion.mapa, mansion.nav, PARAMETROS_AVATAR, DT);
    const inicio = performance.now();
    for (let c = 0; c < cuadros; c++) {
      for (const [x, z] of puntos) acumulado += alturaEn(suelo, x!, z!, 0);
      if (c % 300 === 0) {
        a.loc.x = t0.x;
        a.loc.z = t0.z;
      }
      avanzarAvatar(a, m, 0, mansion.mapa, mansion.nav, PARAMETROS_AVATAR, DT);
    }
    const msPorCuadro = (performance.now() - inicio) / cuadros;
    console.log(
      `costo por cuadro (100 alturaEn + 1 avatar): ${(msPorCuadro * 1000).toFixed(1)} µs`,
    );
    expect(Number.isFinite(acumulado)).toBe(true);
    expect(msPorCuadro).toBeLessThan(0.25);
  });
});

const t0 = {
  x: plano.escaleras[0]!.tramos[0]!.desde.x,
  z: plano.escaleras[0]!.tramos[0]!.desde.z + 0.8,
};

describe('puntoLibre se respeta en todo el recorrido', () => {
  it('el avatar nunca termina dentro de algo que lo bloquea a su altura', () => {
    const a = crearAvatar(t0.x, t0.z, Math.PI, 0);
    const m = crearMando();
    m.adelante = 1;
    m.lateral = 0.4;
    for (let i = 0; i < 400; i++) {
      avanzarAvatar(a, m, 0, mansion.mapa, mansion.nav, PARAMETROS_AVATAR, DT);
      expect(puntoLibre(mansion.mapa, a.x, a.z, RADIO_AVATAR, a.y), `cuadro ${i}`).toBe(true);
      expect(alturaEn(mansion.suelo, a.x, a.z, a.y)).toBeLessThanOrEqual(a.y + EPS);
    }
  });
});
