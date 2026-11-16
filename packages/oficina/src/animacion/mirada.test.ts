import { describe, expect, it } from 'vitest';
import {
  atencionOrbe,
  calcularMirada as calcularMiradaEn,
  LIMITE_PITCH,
  LIMITE_YAW,
  suavizar,
  UMBRAL_ORBE_ENTRA,
  UMBRAL_ORBE_SALE,
} from './mirada';
import type { Mirada, Vec3 } from './mirada';

const cabeza = { x: 0, y: 1, z: 0 };
const grados = (rad: number) => (rad * 180) / Math.PI;
const calcularMirada = (entrada: { posCabeza: Vec3; yawCuerpo: number; objetivo: Vec3 }): Mirada =>
  calcularMiradaEn(entrada, { yaw: 0, pitch: 0 });

describe('calcularMirada', () => {
  it('objetivo al frente: sin giro', () => {
    const m = calcularMirada({ posCabeza: cabeza, yawCuerpo: 0, objetivo: { x: 0, y: 1, z: 5 } });
    expect(m.yaw).toBeCloseTo(0, 6);
    expect(m.pitch).toBeCloseTo(0, 6);
  });

  it('objetivo detrás de la cabeza: el giro se limita a ±70°', () => {
    const atras = calcularMirada({
      posCabeza: cabeza,
      yawCuerpo: 0,
      objetivo: { x: 0.1, y: 1, z: -5 },
    });
    expect(Math.abs(grados(atras.yaw))).toBeCloseTo(70, 6);
    const izq = calcularMirada({
      posCabeza: cabeza,
      yawCuerpo: 0,
      objetivo: { x: -5, y: 1, z: -0.1 },
    });
    expect(grados(izq.yaw)).toBeCloseTo(-70, 6);
    expect(LIMITE_YAW).toBeCloseTo((70 * Math.PI) / 180, 9);
  });

  it('el yaw es relativo al cuerpo y toma el camino corto', () => {
    // objetivo hacia +x (yaw mundo = 90°); cuerpo mirando 60° -> relativo 30°
    const m = calcularMirada({
      posCabeza: cabeza,
      yawCuerpo: (60 * Math.PI) / 180,
      objetivo: { x: 5, y: 1, z: 0 },
    });
    expect(grados(m.yaw)).toBeCloseTo(30, 6);
    // cuerpo a 350°, objetivo a 10° -> +20°, no -340°
    const w = calcularMirada({
      posCabeza: cabeza,
      yawCuerpo: (350 * Math.PI) / 180,
      objetivo: { x: Math.sin((10 * Math.PI) / 180), y: 1, z: Math.cos((10 * Math.PI) / 180) },
    });
    expect(grados(w.yaw)).toBeCloseTo(20, 4);
  });

  it('el pitch se limita a ±25° (positivo = hacia arriba)', () => {
    const arriba = calcularMirada({
      posCabeza: cabeza,
      yawCuerpo: 0,
      objetivo: { x: 0, y: 20, z: 1 },
    });
    expect(grados(arriba.pitch)).toBeCloseTo(25, 6);
    const abajo = calcularMirada({
      posCabeza: cabeza,
      yawCuerpo: 0,
      objetivo: { x: 0, y: -20, z: 1 },
    });
    expect(grados(abajo.pitch)).toBeCloseTo(-25, 6);
    expect(LIMITE_PITCH).toBeCloseTo((25 * Math.PI) / 180, 9);
  });

  it('objetivo sobre la cabeza no produce NaN', () => {
    const m = calcularMirada({ posCabeza: cabeza, yawCuerpo: 1, objetivo: cabeza });
    expect(Number.isFinite(m.yaw)).toBe(true);
    expect(Number.isFinite(m.pitch)).toBe(true);
  });
});

describe('calcularMirada sin asignaciones', () => {
  it('escribe en el objeto de salida (lo devuelve y pisa su contenido)', () => {
    const salida: Mirada = { yaw: 9, pitch: 9 };
    const entrada = { posCabeza: cabeza, yawCuerpo: 0, objetivo: { x: 5, y: 1, z: 5 } };
    expect(calcularMiradaEn(entrada, salida)).toBe(salida);
    expect(salida).toEqual(calcularMirada(entrada));
    expect(salida.yaw).not.toBe(9);
  });
});

describe('suavizar', () => {
  it('dt = 0 no mueve y dt grande llega al objetivo', () => {
    expect(suavizar(1, 5, 0, 0.2)).toBe(1);
    expect(suavizar(1, 5, 100, 0.2)).toBeCloseTo(5, 6);
  });

  it('es independiente de la tasa de cuadros', () => {
    const uno = suavizar(0, 1, 0.032, 0.2);
    const dos = suavizar(suavizar(0, 1, 0.016, 0.2), 1, 0.016, 0.2);
    expect(dos).toBeCloseTo(uno, 9);
  });

  it('tau <= 0 salta al objetivo', () => {
    expect(suavizar(0, 3, 0.016, 0)).toBe(3);
  });
});

describe('atencionOrbe', () => {
  it('con el orbe cerca la atención sube con retardo, no de golpe', () => {
    let a = 0;
    a = atencionOrbe(a, UMBRAL_ORBE_ENTRA - 1, 0.1);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(0.3);
    for (let i = 0; i < 20; i++) a = atencionOrbe(a, UMBRAL_ORBE_ENTRA - 1, 0.1);
    expect(a).toBe(1);
  });

  it('con el orbe lejos la atención baja a 0 y vuelve a su mirada normal', () => {
    let a = 1;
    for (let i = 0; i < 20; i++) a = atencionOrbe(a, UMBRAL_ORBE_SALE + 5, 0.1);
    expect(a).toBe(0);
  });

  it('entre los dos umbrales mantiene lo que ya hacía (histéresis, sin parpadeo)', () => {
    const medio = (UMBRAL_ORBE_ENTRA + UMBRAL_ORBE_SALE) / 2;
    expect(atencionOrbe(1, medio, 0.1)).toBe(1);
    expect(atencionOrbe(0, medio, 0.1)).toBe(0);
  });

  it('el giro final sigue limitado por calcularMirada', () => {
    const m = calcularMirada({
      posCabeza: cabeza,
      yawCuerpo: 0,
      objetivo: { x: 0, y: 1, z: -5 }, // el orbe pasa justo detrás
    });
    expect(Math.abs(grados(m.yaw))).toBeLessThanOrEqual(70.0001);
  });
});
