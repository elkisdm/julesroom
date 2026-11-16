import { describe, expect, it } from 'vitest';
import {
  alturaEn,
  alturaPie,
  CONTRAHUELLA_MAX,
  crearSuelo,
  ejeCaracol,
  PARAMETROS_SUELO,
  peldanosCaracol,
  peldanosRectos,
  puntoEnSuelo,
  restarCajas,
  NO_PISABLES_POR_DEFECTO,
  sePisa,
  SIN_SUELO,
  sueloDe,
  sueloPlano,
  superficiesDeMuebles,
} from './suelo';
import type { DatosSuelo, Superficie } from './tipos';
import { crearEscenarioPrueba } from './prueba';
import { crearMapaDeCajas, crearMapaDeSuelo, puntoLibre } from '../animacion/colision';
import { cajaDe } from '../mansion/plano';
import type { Mueble } from '../mansion/plano';

const PASO = PARAMETROS_SUELO.paso;
const R = 0.3;

const losa = (
  id: string,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
): Superficie => ({
  id,
  tipo: 'losa',
  forma: 'caja',
  x0,
  x1,
  z0,
  z1,
  y,
  grosor: 0.3,
});

/** Sala 10 × 10 con una tarima baja, un sofá (más alto que un paso) y una losa alta con un hueco. */
function datos(): DatosSuelo {
  return {
    limites: { x0: 0, x1: 10, z0: 0, z1: 10 },
    superficies: [
      losa('piso', 0, 10, 0, 10, 0),
      {
        id: 'tarima',
        tipo: 'tarima',
        forma: 'caja',
        x0: 1,
        x1: 3,
        z0: 1,
        z1: 3,
        y: 0.25,
        grosor: 0.25,
      },
      {
        id: 'sofa',
        tipo: 'mueble',
        forma: 'caja',
        x0: 5,
        x1: 7,
        z0: 1,
        z1: 2,
        y: 0.45,
        grosor: 0.45,
      },
      ...restarCajas([{ x0: 0, x1: 10, z0: 6, z1: 10 }], [{ x0: 4, x1: 6, z0: 7, z1: 9 }]).map(
        (c, i) => losa(`alta-${i}`, c.x0, c.x1, c.z0, c.z1, 3),
      ),
      {
        id: 'rampa',
        tipo: 'rampa',
        forma: 'rampa',
        eje: 'x',
        x0: 8,
        x1: 10,
        z0: 1,
        z1: 3,
        y0: 0,
        y1: 1,
        grosor: 0,
      },
    ],
    solidos: [],
  };
}

describe('alturaEn', () => {
  const s = crearSuelo(datos());

  it('sobre la losa devuelve su altura; fuera de todo, SIN_SUELO', () => {
    expect(alturaEn(s, 4, 4, 0)).toBe(0);
    expect(alturaEn(s, -1, 4, 0)).toBe(SIN_SUELO);
    expect(alturaEn(s, 4, 11, 0)).toBe(SIN_SUELO);
  });

  it('regla del paso: la tarima (0,25) se sube caminando; el sofá (0,45) no, salvo desde arriba', () => {
    expect(alturaEn(s, 2, 2, 0)).toBe(0.25);
    expect(alturaEn(s, 6, 1.5, 0)).toBe(0);
    // En el aire, con los pies a 0,2 m (subiendo de un salto), ya alcanza el sofá.
    expect(alturaEn(s, 6, 1.5, 0.2)).toBe(0.45);
    expect(alturaEn(s, 6, 1.5, 0.45)).toBe(0.45);
  });

  it('el paso es el inicial parametrizable (0,3–0,35 m)', () => {
    expect(PASO).toBeGreaterThanOrEqual(0.3);
    expect(PASO).toBeLessThanOrEqual(0.35);
    const alto = crearSuelo({ ...datos(), paso: 0.5 });
    expect(alturaEn(alto, 6, 1.5, 0)).toBe(0.45);
  });

  it('desde la losa alta: su altura; en su hueco, caída al piso de abajo', () => {
    expect(alturaEn(s, 2, 8, 3)).toBe(3);
    expect(alturaEn(s, 5, 8, 3)).toBe(0);
    // Desde abajo, la losa alta no se alcanza: se camina por debajo.
    expect(alturaEn(s, 2, 8, 0)).toBe(0);
  });

  it('rampa: altura lineal a lo largo de su eje', () => {
    expect(alturaEn(s, 9, 2, 0.4)).toBeCloseTo(0.5, 9);
    expect(alturaEn(s, 8.2, 2, 0)).toBeCloseTo(0.1, 9);
  });

  it('alturaPie alcanza más que un paso (el pie se apoya en el peldaño siguiente)', () => {
    expect(alturaPie(s, 6, 1.5, 0)).toBe(0.45);
    expect(alturaPie(s, 2, 8, 0)).toBe(0);
  });
});

describe('peldaños', () => {
  it('escalera recta: contrahuellas iguales ≤ 0,19 m y la última a la altura de llegada', () => {
    const p = peldanosRectos('e', {
      desde: { x: 0, y: 0, z: 5 },
      hasta: { x: 0, y: 3.9, z: 0 },
      ancho: 1.2,
    });
    expect(p).toHaveLength(Math.ceil(3.9 / CONTRAHUELLA_MAX));
    let anterior = 0;
    for (const q of p) {
      expect(q.y - anterior).toBeGreaterThan(0);
      expect(q.y - anterior).toBeLessThanOrEqual(CONTRAHUELLA_MAX + 1e-9);
      expect(q.x1 - q.x0).toBeCloseTo(1.2, 9);
      anterior = q.y;
    }
    expect(anterior).toBeCloseTo(3.9, 9);
    // El primero está junto al arranque (z = 5) y el último junto a la llegada (z = 0).
    expect(p[0]!.z1).toBeCloseTo(5, 9);
    expect(p[p.length - 1]!.z0).toBeCloseTo(0, 9);
  });

  it('caracol: el eje sale del círculo de los extremos y los sectores cubren la vuelta', () => {
    const tramos = Array.from({ length: 4 }, (_, k) => {
      const a0 = (-k * Math.PI) / 2;
      const a1 = (-(k + 1) * Math.PI) / 2;
      return {
        desde: { x: Math.cos(a0), y: k * 0.65, z: Math.sin(a0) },
        hasta: { x: Math.cos(a1), y: (k + 1) * 0.65, z: Math.sin(a1) },
        ancho: 0.9,
      };
    });
    const esc = { id: 'c', tramos };
    const eje = ejeCaracol(esc);
    expect(eje).not.toBeNull();
    expect(eje!.x).toBeCloseTo(0, 6);
    expect(eje!.radio).toBeCloseTo(1, 6);
    const p = peldanosCaracol(esc, 0.1, 1.1, 0.06);
    expect(p).toHaveLength(4 * Math.ceil(0.65 / CONTRAHUELLA_MAX));
    const s = crearSuelo({
      limites: { x0: -2, x1: 2, z0: -2, z1: 2 },
      superficies: [losa('piso', -2, 2, -2, 2, 0), ...p],
      solidos: [],
    });
    // Primer peldaño: justo después del arranque (ángulo 0, bajando el ángulo).
    expect(alturaEn(s, Math.cos(-0.1) * 0.6, Math.sin(-0.1) * 0.6, 0)).toBeCloseTo(p[0]!.y, 9);
    // Junto al eje (dentro de la columna) no hay peldaño: queda el piso.
    expect(alturaEn(s, 0.02, -0.02, 0)).toBe(0);
  });

  it('escalera recta no alineada a un eje: error descriptivo', () => {
    expect(() =>
      peldanosRectos('d', { desde: { x: 0, y: 0, z: 0 }, hasta: { x: 2, y: 1, z: 2 }, ancho: 1 }),
    ).toThrow(/alineado/);
  });
});

describe('muebles pisables', () => {
  const mueble = (tipo: string, alto: number): Mueble => ({
    id: tipo,
    tipo,
    ambiente: 'a',
    x: 1,
    z: 1,
    y: 0,
    ancho: 1,
    fondo: 1,
    alto,
    giro: 0,
    conjunto: tipo,
  });

  it('un sofá se pisa a la altura del asiento y una mesa libre por su tapa; un escritorio y lo alto son sólidos; lo plano no cuenta', () => {
    const { superficies, solidos } = superficiesDeMuebles(
      [
        mueble('sofa', 0.8),
        mueble('mesa-centro', 0.74),
        mueble('escritorio-nogal', 0.74),
        mueble('librero', 1.9),
        mueble('espejo-agua', 0.1),
      ],
      () => 0,
    );
    expect(superficies.map((s) => [s.id, s.forma === 'caja' ? s.y : NaN])).toEqual([
      ['sofa', 0.45],
      ['mesa-centro', 0.74],
    ]);
    expect(solidos.map((s) => [s.id, s.y0, s.y1, s.infranqueable])).toEqual([
      ['escritorio-nogal', 0, 0.74, true],
      ['librero', 0, 1.9, true],
    ]);
  });

  it('`pisable` manda sobre el alcance, y una repisa en el aire no se pisa', () => {
    expect(sePisa({ y: 0, alto: 0.92, pisable: false })).toBe(false);
    expect(sePisa({ y: 0, alto: 1.4, pisable: true })).toBe(true);
    expect(sePisa({ y: 0, alto: PARAMETROS_SUELO.alcanceSalto })).toBe(true);
    expect(sePisa({ y: 0, alto: PARAMETROS_SUELO.alcanceSalto + 0.01 })).toBe(false);
    expect(sePisa({ y: 1.2, alto: 0.2 })).toBe(false);
  });

  it('por defecto no se pisan los escritorios, las mesas de trabajo ni las sillas, aunque estén al alcance', () => {
    for (const tipo of NO_PISABLES_POR_DEFECTO)
      expect(sePisa({ tipo, y: 0, alto: 0.74 })).toBe(false);
    for (const tipo of [
      'escritorio',
      'escritorio-nogal',
      'mesa-puesto',
      'mesa-reunion',
      'mesa-lectura',
      'silla',
      'taburete',
    ])
      expect(NO_PISABLES_POR_DEFECTO.has(tipo)).toBe(true);
  });

  it('sí se pisan las mesas de centro, los sofás, las islas, las cajas y lo agregado en construir', () => {
    for (const tipo of [
      'mesa-centro',
      'mesa-baja',
      'sofa',
      'isla',
      'isla-cocina',
      'credenza',
      'mesa-redonda',
      'puff',
    ])
      expect(sePisa({ tipo, y: 0, alto: 0.74 })).toBe(true);
  });

  it('el campo `pisable` del mueble manda sobre el valor por defecto de su tipo', () => {
    expect(sePisa({ tipo: 'escritorio', y: 0, alto: 0.74, pisable: true })).toBe(true);
    expect(sePisa({ tipo: 'mesa-centro', y: 0, alto: 0.4, pisable: false })).toBe(false);
  });

  it('lo que no se pisa bloquea sobre su base hasta lo que alcanza un salto, no la columna de arriba', () => {
    const escritorio: Mueble = {
      id: 'e',
      tipo: 'escritorio',
      ambiente: 'a',
      x: 2,
      z: 2,
      y: 0,
      ancho: 1.4,
      fondo: 0.7,
      alto: 0.74,
      giro: 0,
      conjunto: 'e',
    };
    const lim = { x0: 0, x1: 6, z0: 0, z1: 6 };
    const mapa = crearMapaDeSuelo(
      crearSuelo(sueloPlano({ cajas: [cajaDe(escritorio)], limites: lim }, 0, [escritorio])),
    );
    expect(puntoLibre(mapa, 2, 2, R, 0)).toBe(false);
    expect(puntoLibre(mapa, 2, 2, R, 0.9)).toBe(false);
    expect(puntoLibre(mapa, 2, 2, R, PARAMETROS_SUELO.alcanceSalto + 1.2)).toBe(false);
    expect(puntoLibre(mapa, 2, 2, R, PARAMETROS_SUELO.alturaInfranqueable)).toBe(true);
    expect(puntoLibre(mapa, 2, 2, R, 3.9)).toBe(true);
  });

  it('un escritorio por defecto bloquea como sólido infranqueable y no genera superficie', () => {
    const escritorio: Mueble = {
      id: 'e',
      tipo: 'escritorio',
      ambiente: 'a',
      x: 2,
      z: 2,
      y: 0,
      ancho: 1.4,
      fondo: 0.7,
      alto: 0.74,
      giro: 0,
      conjunto: 'e',
    };
    const { superficies, solidos } = superficiesDeMuebles([escritorio], () => 0);
    expect(superficies).toHaveLength(0);
    expect(solidos.map((x) => x.infranqueable)).toEqual([true]);
  });
});

describe('sueloPlano y sueloDe', () => {
  it('un escenario sin suelo propio recibe uno plano que bloquea lo mismo que su colisión', () => {
    const e = crearEscenarioPrueba();
    expect(e.suelo).toBeUndefined();
    const s = sueloDe(e);
    expect(sueloDe(e)).toBe(s);
    const y = e.planta.niveles[0] ?? 0;
    const viejo = e.colision(y);
    const antes = crearMapaDeCajas(viejo.cajas, viejo.limites);
    const ahora = crearMapaDeSuelo(s);
    for (let x = viejo.limites.x0 - 1; x <= viejo.limites.x1 + 1; x += 0.37) {
      for (let z = viejo.limites.z0 - 1; z <= viejo.limites.z1 + 1; z += 0.37) {
        expect(puntoLibre(ahora, x, z, 0.3, y)).toBe(puntoLibre(antes, x, z, 0.3));
      }
    }
    expect(alturaEn(s, (viejo.limites.x0 + viejo.limites.x1) / 2, viejo.limites.z0 + 0.5, y)).toBe(
      y,
    );
  });

  it('sueloPlano usa la altura pedida', () => {
    const d = sueloPlano({ cajas: [], limites: { x0: 0, x1: 2, z0: 0, z1: 2 } }, 3.9);
    expect(alturaEn(crearSuelo(d), 1, 1, 3.9)).toBe(3.9);
  });
});

describe('puntoEnSuelo (clic)', () => {
  const s = crearSuelo(datos());
  const salida = { x: 0, y: 0, z: 0 };

  it('el rayo cae en la losa alta si no hay corte, y en el piso si el corte la oculta', () => {
    expect(puntoEnSuelo(s, 2, 10, 8, 0, -1, 0, Infinity, salida)).toBe(true);
    expect(salida).toEqual({ x: 2, y: 3, z: 8 });
    expect(puntoEnSuelo(s, 2, 10, 8, 0, -1, 0, 2, salida)).toBe(true);
    expect(salida.y).toBe(0);
  });

  it('un rayo oblicuo toca la tarima por arriba', () => {
    expect(puntoEnSuelo(s, 0, 2.25, 2, 1, -1, 0, Infinity, salida)).toBe(true);
    expect(salida.y).toBeCloseTo(0.25, 9);
    expect(salida.x).toBeCloseTo(2, 9);
  });

  it('un rayo hacia arriba no toca nada', () => {
    expect(puntoEnSuelo(s, 2, 1, 2, 0, 1, 0, Infinity, salida)).toBe(false);
  });
});
