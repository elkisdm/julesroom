import { describe, expect, it } from 'vitest';
import { plano } from '../mansion/plano';
import {
  cajaDePersona,
  cajasDeLaCasa,
  elegirVista,
  fuerzaAro,
  lineaLibre,
  posicionDe,
  segmentoCortaCaja,
} from './visual';
import type { Caja3, OpcionesAngulo } from './visual';

const O: OpcionesAngulo = {
  limiteAzimut: 1.3,
  elevacionMin: 0.1,
  elevacionMax: 1.0,
  distanciaMin: 2,
};
const objetivo = { x: 0, y: 1.5, z: 0 };
/** Pared delante del objetivo (hacia la cámara, z+) que tapa la vista de frente. */
const pared: Caja3 = { x0: -2, x1: 2, y0: 0, y1: 4, z0: 2, z1: 2.3 };

describe('segmentoCortaCaja', () => {
  it('detecta un cruce y un segmento que pasa por fuera', () => {
    expect(segmentoCortaCaja({ x: 0, y: 1, z: 5 }, { x: 0, y: 1, z: 0 }, pared)).toBe(true);
    expect(segmentoCortaCaja({ x: 5, y: 1, z: 5 }, { x: 5, y: 1, z: 0 }, pared)).toBe(false);
    expect(segmentoCortaCaja({ x: 0, y: 6, z: 5 }, { x: 0, y: 6, z: 0 }, pared)).toBe(false);
  });
});

describe('elegirVista', () => {
  const de = (azimut: number) => ({ azimut, elevacion: 0.3, distancia: 5 });

  it('sin obstáculos deja la vista como está', () => {
    expect(elegirVista(objetivo, de(0.2), [], O)).toEqual(de(0.2));
  });

  it('con una pared al frente busca un azimut libre cercano al actual', () => {
    const v = elegirVista(objetivo, de(0), [pared], O);
    expect(lineaLibre(posicionDe(objetivo, v), objetivo, [pared])).toBe(true);
    expect(Math.abs(v.azimut)).toBeGreaterThan(0);
    expect(Math.abs(v.azimut)).toBeLessThanOrEqual(O.limiteAzimut);
    expect(v.distancia).toBe(5);
  });

  it('si hay muros a ambos lados y al frente, acerca la cámara', () => {
    const cuarto: Caja3[] = [
      pared,
      { x0: 1.2, x1: 1.5, y0: 0, y1: 4, z0: -3, z1: 3 },
      { x0: -1.5, x1: -1.2, y0: 0, y1: 4, z0: -3, z1: 3 },
    ];
    const v = elegirVista(objetivo, de(0), cuarto, O);
    expect(lineaLibre(posicionDe(objetivo, v), objetivo, cuarto)).toBe(true);
    expect(v.distancia).toBeLessThan(5);
  });

  it('una persona delante de la cara también se esquiva', () => {
    const delante = cajaDePersona({ x: 0, y: 0, z: 1.2 });
    const v = elegirVista(objetivo, de(0), [delante], O);
    expect(lineaLibre(posicionDe(objetivo, v), objetivo, [delante])).toBe(true);
  });

  it('sin salida devuelve la vista más cercana con la distancia mínima', () => {
    const encierro: Caja3 = { x0: -9, x1: 9, y0: 0, y1: 9, z0: -9, z1: 9 };
    const hueco = { ...encierro, x0: -0.1, x1: 0.1, z0: -0.1, z1: 0.1 };
    const v = elegirVista({ x: 0, y: 1, z: 0 }, de(0.4), [encierro, hueco], O);
    expect(v.distancia).toBe(O.distanciaMin);
  });
});

describe('casa real', () => {
  const cajas = cajasDeLaCasa();
  const alturas = { 'Front designer': 0, Integrador: 0, Guionista: 0 };

  it('hay muros y muebles altos y ninguna caja es degenerada', () => {
    expect(cajas.length).toBeGreaterThan(10);
    for (const c of cajas) {
      expect(c.x1).toBeGreaterThan(c.x0);
      expect(c.y1).toBeGreaterThan(c.y0);
      expect(c.z1).toBeGreaterThan(c.z0);
    }
    expect(Object.keys(alturas)).toHaveLength(3);
  });

  it('desde cada puesto de trabajo existe una vista limpia dentro del azimut permitido', () => {
    const lugares = plano.lugares.filter((l) => l.asiento || l.departamento);
    expect(lugares.length).toBeGreaterThan(15);
    for (const l of lugares) {
      const cabeza = { x: l.x, y: l.y + 1.1 + 0.35, z: l.z };
      const v = elegirVista(cabeza, { azimut: 0, elevacion: 0.35, distancia: 5 }, cajas, O);
      expect(lineaLibre(posicionDe(cabeza, v), cabeza, cajas), l.id).toBe(true);
    }
  });

  it('también hay vista limpia para Asistente en reposo, en el atrio', () => {
    const cabeza = { x: plano.asistente.x, y: 0.9 + 1.1, z: plano.asistente.z };
    const v = elegirVista(cabeza, { azimut: 0, elevacion: 0.35, distancia: 5 }, cajas, O);
    expect(lineaLibre(posicionDe(cabeza, v), cabeza, cajas)).toBe(true);
  });
});

describe('cajasDeLaCasa de otra planta', () => {
  const planta = {
    ambientes: [{ ...plano.ambientes[0]!, id: 'sala', y: 0 }],
    muros: [],
    muebles: [
      {
        ...plano.muebles[0]!,
        id: 'alto',
        ambiente: 'sala',
        x: 5,
        z: 6,
        y: 0,
        ancho: 2,
        fondo: 1,
        alto: 2,
        giro: 0,
      },
      {
        ...plano.muebles[0]!,
        id: 'bajo',
        ambiente: 'sala',
        x: 0,
        z: 0,
        y: 0,
        ancho: 2,
        fondo: 1,
        alto: 0.7,
        giro: 0,
      },
    ],
  };

  it('lee la planta recibida y no la mansión: solo el mueble alto, en su sitio', () => {
    const cajas = cajasDeLaCasa(planta);
    expect(cajas).toHaveLength(1);
    expect(cajas[0]).toMatchObject({ x0: 4, x1: 6, y0: 0, y1: 2, z0: 5.5, z1: 6.5 });
  });
});

describe('fuerzaAro', () => {
  it('cerca brilla completo y lejos queda tenue, sin salirse de 0..1', () => {
    expect(fuerzaAro(3, 22)).toBe(1);
    expect(fuerzaAro(8.8, 22)).toBe(1);
    expect(fuerzaAro(60, 22)).toBeCloseTo(0.1, 6);
    for (let d = 0; d <= 80; d += 2) {
      const f = fuerzaAro(d, 22);
      expect(f).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('baja de forma monótona con la distancia', () => {
    let anterior = 1;
    for (let d = 0; d <= 60; d += 1) {
      const f = fuerzaAro(d, 22);
      expect(f).toBeLessThanOrEqual(anterior + 1e-12);
      anterior = f;
    }
  });

  it('a la distancia de la vista general (≈ 30 m) ya está bien atenuado', () => {
    expect(fuerzaAro(30, 22)).toBeLessThan(0.6);
  });
});
