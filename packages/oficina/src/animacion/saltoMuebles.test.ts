import { afterEach, describe, expect, it } from 'vitest';
import { cajaDe } from '../mansion/plano';
import type { Caja, Mueble } from '../mansion/plano';
import { alturaEn, crearSuelo, PARAMETROS_SUELO, sueloPlano } from '../escenarios/suelo';
import { avanzarAvatar, crearAvatar, crearMando, PARAMETROS_AVATAR, saltar } from './avatar';
import type { Avatar, Mando } from './avatar';
import { crearMapaDeSuelo, puntoLibre, RADIO_PIE, techoSobre } from './colision';
import type { MapaColision } from './colision';
import { crearNavegacion } from './navegacion';
import { encenderTodo } from './opciones';
import { PARAMETROS_SALTO } from './salto';

const DT = 1 / 60;
const R = 0.3;

const mueble = (id: string, o: Partial<Mueble> & Pick<Mueble, 'x' | 'z'>): Mueble => ({
  tipo: 'mesa',
  ambiente: 'sala',
  y: 0,
  ancho: 1.6,
  fondo: 0.8,
  alto: 0.74,
  giro: 0,
  conjunto: id,
  id,
  ...o,
});

const LIMITES: Caja = { x0: 0, x1: 14, z0: 0, z1: 14 };
const MUROS: Caja[] = [{ x0: 12, x1: 12.2, z0: 0, z1: 14 }];

/** El mundo de una sala como lo arma `sueloDe` sin suelo propio: cajas de colisión + muebles. */
function mundo(muebles: Mueble[], muros: Caja[] = MUROS) {
  const cajas = [...muros, ...muebles.map((m) => cajaDe(m))];
  const suelo = crearSuelo(sueloPlano({ cajas, limites: LIMITES }, 0, muebles));
  const mapa = crearMapaDeSuelo(suelo);
  return { suelo, mapa, nav: crearNavegacion(mapa, 0.25, R) };
}
type Mundo = ReturnType<typeof mundo>;

interface Registro {
  y: number[];
  x: number[];
  z: number[];
  /** Cuadros con los pies dentro de un sólido: el centro del cuerpo en una caja que bloquea a esa altura. */
  dentro: number;
}

function correr(
  a: Avatar,
  m: Mando,
  w: { mapa: MapaColision; nav: Mundo['nav'] },
  cuadros: number,
  guion: (i: number, a: Avatar) => void = () => {},
): Registro {
  const r: Registro = { y: [], x: [], z: [], dentro: 0 };
  for (let i = 0; i < cuadros; i++) {
    guion(i, a);
    avanzarAvatar(a, m, 0, w.mapa, w.nav, PARAMETROS_AVATAR, DT);
    r.y.push(a.y);
    r.x.push(a.x);
    r.z.push(a.z);
    if (!puntoLibre(w.mapa, a.x, a.z, R * 0.9, a.y)) r.dentro++;
  }
  return r;
}

/** Avatar a `d` m del borde sur de una mesa en (x, z), mirando al norte (−z, azimut 0). */
function haciaMesa(
  w: { mapa: MapaColision; nav: Mundo['nav'] },
  mesa: Mueble,
  d: number,
  correrTecla: boolean,
) {
  const c = cajaDe(mesa);
  const a = crearAvatar(mesa.x, c.z1 + d, Math.PI, 0);
  const m = crearMando();
  m.adelante = 1;
  m.correr = correrTecla;
  return { a, m, w };
}

/** Salta una sola vez, al llegar a `d` m del borde sur de la caja (el despegue lo hace la carrera, no el cuadro). */
const saltarA = (m: Mando, caja: Caja, d: number) => {
  let hecho = false;
  return (_i: number, a: Avatar) => {
    if (!hecho && a.z <= caja.z1 + d) {
      saltar(m);
      hecho = true;
    }
  };
};

afterEach(() => encenderTodo());

describe('altura del suelo bajo cada mueble: sale de su geometría', () => {
  const mesa = mueble('mesa', { x: 6, z: 4 });
  const w = mundo([mesa]);

  it('bajo la tapa de una mesa baja el suelo está a su alto real; fuera, en el piso', () => {
    // Desde unos pies en el aire (un paso bajo la tapa o más): a pie desde el piso no se sube.
    expect(alturaEn(w.suelo, 6, 4, 0.5)).toBeCloseTo(0.74, 9);
    expect(alturaEn(w.suelo, 6, 4.6, 0)).toBeCloseTo(0, 9);
    // Cualquier alto: no es una tabla por tipo.
    const otra = mundo([mueble('x', { x: 6, z: 4, tipo: 'cosa-rara', alto: 0.9 })]);
    expect(alturaEn(otra.suelo, 6, 4, 0.8)).toBeCloseTo(0.9, 9);
  });

  it('un mueble girado 90° ocupa la huella girada', () => {
    const giro = mundo([mueble('g', { x: 6, z: 4, giro: Math.PI / 2 })]);
    expect(alturaEn(giro.suelo, 6, 4.7, 0.5)).toBeCloseTo(0.74, 9);
    expect(alturaEn(giro.suelo, 6.7, 4, 0.5)).toBeCloseTo(0, 9);
  });

  it('más alto que el alcance del salto es un obstáculo; `pisable: false` también', () => {
    expect(PARAMETROS_SUELO.alcanceSalto).toBeLessThan(PARAMETROS_SALTO.altura);
    const alto = mundo([mueble('alto', { x: 6, z: 4, alto: PARAMETROS_SUELO.alcanceSalto + 0.1 })]);
    expect(alto.suelo.superficies.some((s) => s.id === 'alto')).toBe(false);
    const no = mundo([mueble('maqueta', { x: 6, z: 4, alto: 0.92, pisable: false })]);
    expect(no.suelo.superficies.some((s) => s.id === 'maqueta')).toBe(false);
    expect(alturaEn(no.suelo, 6, 4, 2)).toBeCloseTo(0, 9);
  });

  it('una caja de colisión sin mueble (un muro) sigue bloqueando a cualquier altura', () => {
    expect(puntoLibre(w.mapa, 12.1, 5, R, 0)).toBe(false);
    expect(puntoLibre(w.mapa, 12.1, 5, R, 3)).toBe(false);
  });
});

describe('subirse de un salto', () => {
  const mesa = mueble('mesa', { x: 6, z: 4 });

  it.each([
    ['caminando', false, 1.4, 0.7],
    ['corriendo', true, 3.4, 2.4],
  ])('saltando %s contra una mesa baja queda de pie arriba', (_n, corriendo, desde, salto) => {
    const w = mundo([mesa]);
    const { a, m } = haciaMesa(w, mesa, desde, corriendo);
    const lanzar = saltarA(m, cajaDe(mesa), salto);
    const r = correr(a, m, w, 150, (i, av) => {
      lanzar(i, av);
      if (av.enSuelo && av.y > 0.7) m.adelante = 0;
    });
    expect(a.enSuelo).toBe(true);
    expect(a.y).toBeCloseTo(0.74, 6);
    expect(a.z).toBeGreaterThan(cajaDe(mesa).z0);
    expect(a.z).toBeLessThan(cajaDe(mesa).z1);
    expect(r.dentro).toBe(0);
  });

  it('camina encima sin hundirse, salta a otra mesa y baja por el borde con una caída breve', () => {
    const otra = mueble('otra', { x: 6, z: 2.2 });
    const w = mundo([mesa, otra]);
    const { a, m } = haciaMesa(w, mesa, 1.4, false);
    const subir = saltarA(m, cajaDe(mesa), 0.7);
    let arriba = false;
    const r = correr(a, m, w, 400, (i, av) => {
      if (!arriba) subir(i, av);
      // Ya arriba, salta al borde de la mesa para cruzar el hueco hacia la otra.
      if (av.enSuelo && av.y > 0.7 && !arriba) {
        arriba = true;
        saltar(m);
      }
    });
    expect(r.dentro).toBe(0);
    expect(r.y.filter((y) => Math.abs(y - 0.74) < 1e-6).length).toBeGreaterThan(10);
    expect(a.enSuelo).toBe(true);
    expect(a.y).toBeCloseTo(0, 6);
    expect(a.z).toBeLessThan(cajaDe(otra).z0);
    // Bajar es una caída breve: nunca se pierde altura de a más de lo que cae la gravedad en un cuadro.
    expect(Math.max(...r.y.map((y, i) => (i === 0 ? 0 : (r.y[i - 1] as number) - y)))).toBeLessThan(
      0.3,
    );
  });

  it('un obstáculo bajo y angosto se cruza de un salto con carrera', () => {
    const cajon = mueble('cajon', { x: 6, z: 4, ancho: 2, fondo: 0.3, alto: 0.6 });
    const w = mundo([cajon]);
    const { a, m } = haciaMesa(w, cajon, 3.4, true);
    const lanzar = saltarA(m, cajaDe(cajon), 1.3);
    const r = correr(a, m, w, 150, lanzar);
    expect(r.dentro).toBe(0);
    expect(a.z).toBeLessThan(cajaDe(cajon).z0);
    expect(a.enSuelo).toBe(true);
  });
});

describe('lo que no se sube', () => {
  it('un mueble más alto que el alcance y uno `pisable: false` bloquean saltando, sin encajar', () => {
    for (const mesa of [
      mueble('alta', { x: 6, z: 4, alto: 1.4 }),
      mueble('maqueta', { x: 6, z: 4, alto: 0.92, pisable: false }),
    ]) {
      const w = mundo([mesa]);
      const { a, m } = haciaMesa(w, mesa, 3.4, true);
      const lanzar = saltarA(m, cajaDe(mesa), 1);
      const r = correr(a, m, w, 200, (i, av) => {
        lanzar(i, av);
        if (i % 40 === 5) saltar(m);
      });
      expect(r.dentro, mesa.id).toBe(0);
      expect(a.enSuelo, mesa.id).toBe(true);
      expect(a.y, mesa.id).toBeCloseTo(0, 6);
      expect(Math.max(...r.y), mesa.id).toBeLessThan(PARAMETROS_SALTO.altura + 1e-6);
      expect(a.z, mesa.id).toBeGreaterThanOrEqual(cajaDe(mesa).z1 + R - 0.02);
    }
  });

  it('un muro bloquea al saltar contra él y no se sale de la sala', () => {
    const w = mundo([]);
    const a = crearAvatar(10, 7, Math.PI / 2, 0);
    const m = crearMando();
    m.lateral = 1; // azimut 0: derecha = +x, hacia el muro de x = 12
    m.correr = true;
    const r = correr(a, m, w, 240, (i) => {
      if (i % 40 === 10) saltar(m);
    });
    expect(Math.max(...r.x)).toBeLessThanOrEqual(12 - R + 1e-3);
    expect(Math.max(...r.y)).toBeLessThan(PARAMETROS_SALTO.altura + 1e-6);
    expect(r.dentro).toBe(0);
  });

  it('un cuerpo no puede alzarse sobre el alcance: el techo de la sala queda fuera del suelo', () => {
    const w = mundo([mueble('mesa', { x: 6, z: 4 })]);
    expect(alturaEn(w.suelo, 6, 4, 5)).toBeCloseTo(0.74, 9);
  });
});

describe('techos: no se atraviesan saltando', () => {
  /** Sala con una losa de la planta de arriba (cara a 3,0 m, cuerpo de 0,3 m: techo a 2,7 m) sobre media sala. */
  const conTecho = () => {
    const mesa = mueble('mesa', { x: 6, z: 4 });
    const suelo = crearSuelo({
      limites: LIMITES,
      superficies: [
        { id: 'piso', tipo: 'losa', forma: 'caja', ...LIMITES, y: 0, grosor: 0.3 },
        {
          id: 'mesa',
          tipo: 'mueble',
          forma: 'caja',
          ...cajaDe(mesa),
          y: 0.74,
          grosor: 0.74,
          radio: 0,
        },
        {
          id: 'alta',
          tipo: 'losa',
          forma: 'caja',
          x0: 0,
          x1: 14,
          z0: 0,
          z1: 14,
          y: 3,
          grosor: 0.3,
        },
      ],
      solidos: [],
    });
    const mapa = crearMapaDeSuelo(suelo);
    return { mesa, mapa, nav: crearNavegacion(mapa, 0.25, R) };
  };

  it('`techoSobre` da la base de lo más bajo que cubre la cabeza', () => {
    const w = conTecho();
    expect(techoSobre(w.mapa, 6, 4, R, 1.7)).toBeCloseTo(2.7, 9);
    // Lo que ya quedó por debajo de la cabeza no es techo.
    expect(techoSobre(w.mapa, 6, 4, R, 2.8)).toBe(Number.POSITIVE_INFINITY);
  });

  it('al saltar con techo bajo la cabeza lo toca y no lo atraviesa, ni desde una mesa', () => {
    const w = conTecho();
    const { a, m } = haciaMesa(w, w.mesa, 1.4, false);
    const lanzar = saltarA(m, cajaDe(w.mesa), 0.7);
    let arriba = false;
    const r = correr(a, m, w, 220, (i, av) => {
      if (!arriba) lanzar(i, av);
      if (av.enSuelo && av.y > 0.7) {
        m.adelante = 0;
        if (!arriba) saltar(m);
        arriba = true;
      }
    });
    // Desde la mesa (0,74) el arco llegaría a 1,87 m; la cabeza (1,7 m) topa con el techo a 2,7 m: pies ≤ 1,0 m.
    expect(Math.max(...r.y)).toBeLessThanOrEqual(2.7 - 1.7 + 1e-6);
    expect(r.dentro).toBe(0);
    expect(a.enSuelo).toBe(true);
  });
});

describe('el mueble cambia bajo los pies', () => {
  it('si lo quitan mientras alguien está encima, cae al piso sin quedar en el aire', () => {
    const mesa = mueble('mesa', { x: 6, z: 4 });
    const w = mundo([mesa]);
    const { a, m } = haciaMesa(w, mesa, 1.4, false);
    const lanzar = saltarA(m, cajaDe(mesa), 0.7);
    correr(a, m, w, 100, (i, av) => {
      lanzar(i, av);
      if (av.enSuelo && av.y > 0.7) m.adelante = 0;
    });
    expect(a.y).toBeCloseTo(0.74, 6);
    const sin = mundo([]);
    const r = correr(a, m, sin, 120);
    expect(a.enSuelo).toBe(true);
    expect(a.y).toBeCloseTo(0, 6);
    expect(Math.min(...r.y)).toBeGreaterThanOrEqual(-1e-9);
    expect(r.dentro).toBe(0);
  });

  it('si lo mueven, los pies siguen el suelo nuevo', () => {
    const mesa = mueble('mesa', { x: 6, z: 4 });
    const w = mundo([mesa]);
    const { a, m } = haciaMesa(w, mesa, 1.4, false);
    const lanzar = saltarA(m, cajaDe(mesa), 0.7);
    correr(a, m, w, 100, (i, av) => {
      lanzar(i, av);
      if (av.enSuelo && av.y > 0.7) m.adelante = 0;
    });
    expect(a.y).toBeCloseTo(0.74, 6);
    const lejos = mundo([{ ...mesa, x: 9 }]);
    correr(a, m, lejos, 90);
    expect(a.enSuelo).toBe(true);
    expect(a.y).toBeCloseTo(0, 6);
  });
});

describe('caja de colisión genérica (p. ej. la mesa de la maqueta de la sala de control)', () => {
  it('por defecto se sube si su tapa está al alcance, y con `pisable: false` bloquea', () => {
    const maqueta = mueble('mesa-maqueta', { x: 0, z: 0, ancho: 8, fondo: 3.4, alto: 0.92 });
    const lugares = (w: Mundo) => [
      // De pie alrededor de la mesa, fuera de su huella: nadie queda encajado.
      ...[-4.6, 4.6].map((x) => puntoLibre(w.mapa, x, 0, R, 0)),
      ...[-2.2, 2.2].map((z) => puntoLibre(w.mapa, 0, z, R, 0)),
    ];
    const base = { limites: { x0: -10, x1: 10, z0: -10, z1: 10 } };
    const hacer = (m: Mueble) => {
      const suelo = crearSuelo(sueloPlano({ cajas: [cajaDe(m)], limites: base.limites }, 0, [m]));
      const mapa = crearMapaDeSuelo(suelo);
      return { suelo, mapa, nav: crearNavegacion(mapa, 0.25, R) };
    };
    const pisable = hacer(maqueta);
    const cerrada = hacer({ ...maqueta, pisable: false });
    expect(lugares(pisable)).toEqual([true, true, true, true]);
    expect(lugares(cerrada)).toEqual([true, true, true, true]);
    expect(alturaEn(pisable.suelo, 0, 0, 0.8)).toBeCloseTo(0.92, 9);
    expect(alturaEn(cerrada.suelo, 0, 0, 0.8)).toBeCloseTo(0, 9);

    // Saltando contra ella: sube la pisable; la cerrada no la deja pisar.
    const a = crearAvatar(0, 1.7 + 0.3 + RADIO_PIE + 0.1, Math.PI, 0);
    const m = crearMando();
    m.adelante = 1;
    m.correr = true;
    const r = correr(a, m, pisable, 120, (i, av) => {
      if (i === 10) saltar(m);
      if (av.enSuelo && av.y > 0.9) m.adelante = 0;
    });
    expect(a.enSuelo).toBe(true);
    expect(a.y).toBeCloseTo(0.92, 6);
    expect(r.dentro).toBe(0);
    expect(Math.max(...r.y)).toBeGreaterThan(0.9);
    const b = crearAvatar(0, 1.7 + 0.3 + RADIO_PIE + 0.1, Math.PI, 0);
    const rb = correr(b, m, cerrada, 120, (i) => {
      if (i === 10) saltar(m);
    });
    expect(rb.dentro).toBe(0);
    expect(b.y).toBeCloseTo(0, 6);
    expect(b.z).toBeGreaterThanOrEqual(cajaDe(maqueta).z1 + R - 0.02);
  });
});
