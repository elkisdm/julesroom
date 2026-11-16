import v8 from 'node:v8';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { crearCandidatos, crearInteres, crearSalidaInteres, elegirInteres } from './interes';
import type { Candidatos, Interes } from './interes';

const DT = 1 / 60;
const YO = { x: 0, z: 0, id: 1 };

function poner(
  c: Candidatos,
  i: number,
  id: number,
  x: number,
  z: number,
  velocidad: number,
  habla: boolean,
) {
  c.id[i] = id;
  c.x[i] = x;
  c.z[i] = z;
  c.velocidad[i] = velocidad;
  c.habla[i] = habla ? 1 : 0;
}

/** Corre `segundos` y devuelve el primer instante en que hay objetivo (o -1). */
function primerObjetivo(e: Interes, c: Candidatos, n: number, desde: number, segundos: number) {
  const s = crearSalidaInteres();
  for (let t = desde; t < desde + segundos; t += DT) {
    elegirInteres(e, c, n, YO, t, DT, s);
    if (s.objetivoIndice >= 0) return t - desde;
  }
  return -1;
}

describe('elegirInteres', () => {
  it('sin candidatos mira al frente con peso 0', () => {
    const e = crearInteres(7);
    const s = crearSalidaInteres();
    elegirInteres(e, crearCandidatos(4), 0, YO, 0, DT, s);
    expect(s.objetivoIndice).toBe(-1);
    expect(s.peso).toBe(0);
  });

  it('quien habla gana a quien pasa cerca y a quien está parado', () => {
    const c = crearCandidatos(4);
    poner(c, 0, 10, 1, 0, 0, false); // parado cerca
    poner(c, 1, 11, 2, 0, 1.2, false); // pasa cerca
    poner(c, 2, 12, 6, 0, 0, true); // habla, más lejos
    const e = crearEstado();
    const s = crearSalidaInteres();
    for (let t = 0; t < 2; t += DT) elegirInteres(e, c, 3, YO, t, DT, s);
    expect(s.objetivoIndice).toBe(2);
  });

  it('quien pasa cerca gana a quien solo está parado', () => {
    const c = crearCandidatos(4);
    poner(c, 0, 10, 1, 0, 0, false);
    poner(c, 1, 11, 2.5, 0, 1.2, false);
    const e = crearEstado();
    const s = crearSalidaInteres();
    for (let t = 0; t < 1; t += DT) elegirInteres(e, c, 2, YO, t, DT, s);
    expect(s.objetivoIndice).toBe(1);
  });

  it('ignora a quien pasa lejos y a sí mismo', () => {
    const c = crearCandidatos(4);
    poner(c, 0, 1, 0.5, 0, 1.2, true); // yo mismo
    poner(c, 1, 11, 20, 0, 1.2, false);
    const e = crearEstado();
    const s = crearSalidaInteres();
    for (let t = 0; t < 2; t += DT) elegirInteres(e, c, 2, YO, t, DT, s);
    expect(s.objetivoIndice).toBe(-1);
  });

  it('la reacción es retrasada (0,15–0,5 s) y distinta entre dos personas', () => {
    const c = crearCandidatos(2);
    poner(c, 0, 10, 2, 0, 0, true);
    const tiempos = new Set<number>();
    for (const semilla of [11, 222, 3333, 44444, 555555]) {
      const t = primerObjetivo(crearInteres(semilla), c, 1, 0, 2);
      expect(t).toBeGreaterThanOrEqual(0.15 - DT);
      expect(t).toBeLessThanOrEqual(0.5 + 2 * DT);
      tiempos.add(Math.round(t * 1000));
    }
    expect(tiempos.size).toBeGreaterThanOrEqual(4);
  });

  it('histéresis: no cambia de objetivo antes de 1,2 s', () => {
    const c = crearCandidatos(3);
    poner(c, 0, 10, 2, 0, 0, true);
    poner(c, 1, 11, -2, 0, 0, false);
    const e = crearInteres(5);
    const s = crearSalidaInteres();
    let t = 0;
    let adquirido = -1;
    for (; t < 3 && adquirido < 0; t += DT) {
      elegirInteres(e, c, 2, YO, t, DT, s);
      if (s.objetivoIndice === 0) adquirido = t;
    }
    expect(adquirido).toBeGreaterThan(0);
    // ahora habla el otro y el primero se calla
    poner(c, 0, 10, 2, 0, 0, false);
    poner(c, 1, 11, -2, 0, 0, true);
    let cambio = -1;
    for (; t < adquirido + 4; t += DT) {
      elegirInteres(e, c, 2, YO, t, DT, s);
      if (s.objetivoIndice === 1 && cambio < 0) cambio = t;
    }
    expect(cambio).toBeGreaterThanOrEqual(adquirido + 1.2 - DT);
    expect(cambio).toBeLessThan(adquirido + 3);
  });

  it('si el objetivo cambia de posición en el arreglo lo sigue por id', () => {
    const c = crearCandidatos(3);
    poner(c, 0, 10, 2, 0, 0, true);
    const e = crearInteres(5);
    const s = crearSalidaInteres();
    for (let t = 0; t < 1; t += DT) elegirInteres(e, c, 1, YO, t, DT, s);
    expect(s.objetivoIndice).toBe(0);
    poner(c, 0, 99, 40, 0, 0, false);
    poner(c, 1, 10, 2, 0, 0, true);
    elegirInteres(e, c, 2, YO, 1, DT, s);
    expect(s.objetivoIndice).toBe(1);
  });

  it('la mirada vuelve al frente tras 2–4 s si no habla nadie y no vuelve a engancharse', () => {
    const c = crearCandidatos(2);
    poner(c, 0, 10, 2, 0, 1.2, false); // alguien pasa cerca y luego se queda parado a su lado
    const s = crearSalidaInteres();
    for (const semilla of [1, 2, 3, 4, 5, 6]) {
      const e = crearInteres(semilla);
      let adquirido = -1;
      let suelta = -1;
      for (let t = 0; t < 12; t += DT) {
        elegirInteres(e, c, 1, YO, t, DT, s);
        if (adquirido < 0 && s.objetivoIndice === 0) adquirido = t;
        if (adquirido >= 0 && suelta < 0 && s.objetivoIndice === -1) suelta = t;
        if (suelta >= 0) expect(s.objetivoIndice).toBe(-1);
      }
      expect(suelta - adquirido).toBeGreaterThanOrEqual(2 - DT);
      expect(suelta - adquirido).toBeLessThanOrEqual(4 + DT);
    }
  });

  it('quien habla se sigue mirando mientras hable', () => {
    const c = crearCandidatos(2);
    poner(c, 0, 10, 2, 0, 0, true);
    const e = crearInteres(5);
    const s = crearSalidaInteres();
    for (let t = 0; t < 20; t += DT) elegirInteres(e, c, 1, YO, t, DT, s);
    expect(s.objetivoIndice).toBe(0);
  });

  it('el peso sube y baja suave y siempre dentro de 0..1', () => {
    const c = crearCandidatos(2);
    poner(c, 0, 10, 2, 0, 0, true);
    const e = crearInteres(5);
    const s = crearSalidaInteres();
    let previo = 0;
    let maxSalto = 0;
    let maximo = 0;
    for (let t = 0; t < 4; t += DT) {
      elegirInteres(e, c, 1, YO, t, DT, s);
      maxSalto = Math.max(maxSalto, Math.abs(s.peso - previo));
      maximo = Math.max(maximo, s.peso);
      previo = s.peso;
    }
    expect(maximo).toBeGreaterThan(0.95);
    for (let t = 4; t < 8; t += DT) {
      c.habla[0] = 0;
      c.x[0] = 30; // se va lejos
      elegirInteres(e, c, 1, YO, t, DT, s);
      maxSalto = Math.max(maxSalto, Math.abs(s.peso - previo));
      expect(s.peso).toBeGreaterThanOrEqual(0);
      expect(s.peso).toBeLessThanOrEqual(1);
      previo = s.peso;
    }
    expect(maxSalto).toBeLessThan(0.1);
    expect(s.peso).toBeLessThan(0.05);
  });

  it('es estable con dt de 0 y sin NaN', () => {
    const c = crearCandidatos(2);
    poner(c, 0, 10, 2, 0, 0, true);
    const e = crearInteres(5);
    const s = crearSalidaInteres();
    for (const dt of [0, 0.1, 0, 0.016, Number.NaN, 0.05]) {
      elegirInteres(e, c, 1, YO, 1, dt, s);
      expect(Number.isFinite(s.peso)).toBe(true);
    }
  });

  it('50 000 llamadas no hacen crecer el heap más de 2 MB', () => {
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc') as () => void;
    const c = crearCandidatos(8);
    for (let i = 0; i < 8; i++) poner(c, i, 10 + i, i - 4, 1 + (i % 3), i % 2 ? 1 : 0, i === 3);
    const e = crearInteres(9);
    const s = crearSalidaInteres();
    let t = 0;
    for (let i = 0; i < 5000; i++, t += DT) elegirInteres(e, c, 8, YO, t, DT, s);
    gc();
    const antes = process.memoryUsage().heapUsed;
    for (let i = 0; i < 50_000; i++, t += DT) {
      c.habla[3] = i % 900 < 450 ? 1 : 0;
      elegirInteres(e, c, 8, YO, t, DT, s);
    }
    gc();
    expect(process.memoryUsage().heapUsed - antes).toBeLessThan(2 * 1024 * 1024);
  });
});

function crearEstado(): Interes {
  return crearInteres(123);
}
