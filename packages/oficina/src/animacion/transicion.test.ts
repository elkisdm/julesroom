import v8 from 'node:v8';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  avanzarPeso,
  avanzarReaccion,
  crearReaccion,
  crearSalidaEnvolvente,
  crearSalidaReaccion,
  crearSalidaSentarse,
  curvaLevantarse,
  curvaSentarse,
  dispararGiro,
  dispararSaludo,
  envolventeGesto,
  suavizarPaso,
} from './transicion';

const PASOS = 90; // progreso de 0 a 1 en 1,5 s a 60 Hz

describe('suavizarPaso', () => {
  it('es 0 y 1 exactos en los extremos, 0,5 al medio y monótona', () => {
    expect(suavizarPaso(0)).toBe(0);
    expect(suavizarPaso(1)).toBe(1);
    expect(suavizarPaso(-3)).toBe(0);
    expect(suavizarPaso(7)).toBe(1);
    expect(suavizarPaso(0.5)).toBeCloseTo(0.5, 12);
    expect(suavizarPaso(Number.NaN)).toBe(0);
    let previo = 0;
    for (let i = 0; i <= 100; i++) {
      const y = suavizarPaso(i / 100);
      expect(y).toBeGreaterThanOrEqual(previo);
      previo = y;
    }
  });
});

describe('avanzarPeso', () => {
  it('tarda al menos la duración y llega exacto', () => {
    const w = { valor: 0 };
    let t = 0;
    while (w.valor < 1 && t < 5) {
      avanzarPeso(w, 1, 1 / 60, 0.5);
      t += 1 / 60;
    }
    expect(w.valor).toBe(1);
    expect(t).toBeGreaterThanOrEqual(0.5 - 1e-9);
    expect(t).toBeLessThan(0.5 + 2 / 60);
  });

  it('sube y baja sin pasarse y sin NaN con dt raro', () => {
    const w = { valor: 0.5 };
    avanzarPeso(w, 1, 0, 0.5);
    expect(w.valor).toBe(0.5);
    avanzarPeso(w, 1, Number.NaN, 0.5);
    expect(w.valor).toBe(0.5);
    avanzarPeso(w, 0, 10, 0.5);
    expect(w.valor).toBe(0);
    avanzarPeso(w, 1, 0.1, 0);
    expect(w.valor).toBe(1);
  });
});

describe('curvaSentarse / curvaLevantarse', () => {
  it('extremos exactos', () => {
    const s = crearSalidaSentarse();
    curvaSentarse(0, s);
    expect(s).toEqual({ altura: 0, inclinacionTorso: 0, pelvisAtras: 0, impacto: 0 });
    curvaSentarse(1, s);
    expect(s).toEqual({ altura: 1, inclinacionTorso: 0, pelvisAtras: 1, impacto: 0 });
    curvaLevantarse(0, s);
    expect(s).toEqual({ altura: 1, inclinacionTorso: 0, pelvisAtras: 1, impacto: 0 });
    curvaLevantarse(1, s);
    expect(s).toEqual({ altura: 0, inclinacionTorso: 0, pelvisAtras: 0, impacto: 0 });
  });

  it('se inclina hacia delante antes de bajar y no se pasa de rango', () => {
    const s = crearSalidaSentarse();
    let maxIncl = 0;
    let alturaEnPico = 0;
    for (let i = 0; i <= 100; i++) {
      curvaSentarse(i / 100, s);
      expect(s.altura).toBeGreaterThanOrEqual(0);
      expect(s.altura).toBeLessThanOrEqual(1);
      expect(s.inclinacionTorso).toBeGreaterThanOrEqual(0);
      if (s.inclinacionTorso > maxIncl) {
        maxIncl = s.inclinacionTorso;
        alturaEnPico = s.altura;
      }
    }
    expect(maxIncl).toBeGreaterThan(0.2);
    expect(maxIncl).toBeLessThan(0.6);
    expect(alturaEnPico).toBeLessThan(0.7);
    curvaSentarse(0.05, s);
    expect(s.altura).toBe(0); // anticipación: primero se inclina, luego baja
    expect(s.inclinacionTorso).toBeGreaterThan(0);
  });

  it('rebota un poco al asentarse (la altura sube antes de quedar en 1)', () => {
    const s = crearSalidaSentarse();
    let minPosterior = 1;
    let llegoA1 = false;
    for (let i = 0; i <= 1000; i++) {
      curvaSentarse(i / 1000, s);
      if (s.altura >= 0.9999) llegoA1 = true;
      if (llegoA1 && s.altura < minPosterior) minPosterior = s.altura;
    }
    expect(minPosterior).toBeLessThan(0.99);
    expect(minPosterior).toBeGreaterThan(0.9);
  });

  it('el impacto ocurre cuando la altura ya es ≈ 1', () => {
    const s = crearSalidaSentarse();
    let maxImpacto = 0;
    let alturaAlImpacto = 0;
    for (let i = 0; i <= 1000; i++) {
      curvaSentarse(i / 1000, s);
      expect(s.impacto).toBeGreaterThanOrEqual(0);
      expect(s.impacto).toBeLessThanOrEqual(1);
      if (s.impacto > maxImpacto) {
        maxImpacto = s.impacto;
        alturaAlImpacto = s.altura;
      }
    }
    expect(maxImpacto).toBeGreaterThan(0.99);
    expect(alturaAlImpacto).toBeGreaterThan(0.97);
  });

  it('levantarse es continua, vuelve a 0 y no tiene impacto', () => {
    const s = crearSalidaSentarse();
    for (let i = 0; i <= 100; i++) {
      curvaLevantarse(i / 100, s);
      expect(s.impacto).toBe(0);
      expect(s.altura).toBeGreaterThanOrEqual(0);
      expect(s.altura).toBeLessThanOrEqual(1);
    }
  });

  it('ambas curvas son continuas (sin saltos por cuadro a 60 Hz en 1,5 s)', () => {
    const a = crearSalidaSentarse();
    const b = crearSalidaSentarse();
    for (const curva of [curvaSentarse, curvaLevantarse]) {
      curva(0, a);
      for (let i = 1; i <= PASOS; i++) {
        curva(i / PASOS, b);
        expect(Math.abs(b.altura - a.altura)).toBeLessThan(0.06);
        expect(Math.abs(b.inclinacionTorso - a.inclinacionTorso)).toBeLessThan(0.05);
        expect(Math.abs(b.pelvisAtras - a.pelvisAtras)).toBeLessThan(0.06);
        expect(Math.abs(b.impacto - a.impacto)).toBeLessThan(0.4);
        a.altura = b.altura;
        a.inclinacionTorso = b.inclinacionTorso;
        a.pelvisAtras = b.pelvisAtras;
        a.impacto = b.impacto;
      }
    }
  });

  it('fuera de rango se acota', () => {
    const s = crearSalidaSentarse();
    curvaSentarse(-1, s);
    expect(s.altura).toBe(0);
    curvaSentarse(5, s);
    expect(s.altura).toBe(1);
    curvaSentarse(Number.NaN, s);
    expect(Number.isFinite(s.altura)).toBe(true);
  });
});

describe('envolventeGesto', () => {
  it('empieza y termina en 0 exacto', () => {
    const s = crearSalidaEnvolvente();
    envolventeGesto(0, 1.5, s);
    expect(s).toEqual({ anticipacion: 0, pico: 0, rebase: 0 });
    envolventeGesto(1.5, 1.5, s);
    expect(s).toEqual({ anticipacion: 0, pico: 0, rebase: 0 });
    envolventeGesto(9, 1.5, s);
    expect(s).toEqual({ anticipacion: 0, pico: 0, rebase: 0 });
    envolventeGesto(-1, 1.5, s);
    expect(s).toEqual({ anticipacion: 0, pico: 0, rebase: 0 });
  });

  it('anticipa, sube rápido, mantiene, rebasa menos de 15 % y suelta', () => {
    const s = crearSalidaEnvolvente();
    const dur = 1.5;
    let maxAnt = 0;
    let maxPico = 0;
    let maxRebase = 0;
    let maxSuma = 0;
    let primerAnt = -1;
    let primerPico = -1;
    let alMantener = 0;
    for (let t = 0; t <= dur; t += 1 / 600) {
      envolventeGesto(t, dur, s);
      if (s.anticipacion > 0.01 && primerAnt < 0) primerAnt = t;
      if (s.pico > 0.01 && primerPico < 0) primerPico = t;
      maxAnt = Math.max(maxAnt, s.anticipacion);
      maxPico = Math.max(maxPico, s.pico);
      maxRebase = Math.max(maxRebase, s.rebase);
      maxSuma = Math.max(maxSuma, s.pico + s.rebase);
      if (Math.abs(t - dur * 0.6) < 1e-3) alMantener = s.pico;
    }
    expect(maxAnt).toBeGreaterThan(0.9);
    expect(maxAnt).toBeLessThanOrEqual(1);
    expect(primerAnt).toBeLessThan(primerPico);
    expect(maxPico).toBe(1);
    expect(alMantener).toBe(1);
    expect(maxRebase).toBeGreaterThan(0);
    expect(maxRebase).toBeLessThan(0.15);
    expect(maxSuma).toBeLessThan(1.15);
  });

  it('es continua a 60 Hz (duración 1,5 s)', () => {
    const a = crearSalidaEnvolvente();
    const b = crearSalidaEnvolvente();
    envolventeGesto(0, 1.5, a);
    for (let i = 1; i <= PASOS; i++) {
      envolventeGesto(i / 60, 1.5, b);
      expect(Math.abs(b.pico - a.pico)).toBeLessThan(0.15);
      expect(Math.abs(b.anticipacion - a.anticipacion)).toBeLessThan(0.3);
      expect(Math.abs(b.rebase - a.rebase)).toBeLessThan(0.05);
      a.pico = b.pico;
      a.anticipacion = b.anticipacion;
      a.rebase = b.rebase;
    }
  });

  it('duración 0 o NaN no produce NaN', () => {
    const s = crearSalidaEnvolvente();
    envolventeGesto(0.5, 0, s);
    expect(Number.isFinite(s.pico)).toBe(true);
    envolventeGesto(Number.NaN, 1, s);
    expect(Number.isFinite(s.pico)).toBe(true);
  });
});

describe('reacciones', () => {
  it('en reposo todo es 0', () => {
    const r = crearReaccion();
    const s = crearSalidaReaccion();
    avanzarReaccion(r, 3, s);
    expect(s).toEqual({ brazoSaludo: 0, cabezaAsentir: 0, giroCabeza: 0 });
  });

  it('el saludo levanta el brazo, asiente y vuelve a 0 sin saltos', () => {
    const r = crearReaccion();
    const s = crearSalidaReaccion();
    dispararSaludo(r, 10, 1);
    let previo = 0;
    let previoAs = 0;
    let maxBrazo = 0;
    let maxAs = 0;
    for (let t = 10; t < 14; t += 1 / 60) {
      avanzarReaccion(r, t, s);
      expect(s.brazoSaludo).toBeGreaterThanOrEqual(0);
      expect(s.brazoSaludo).toBeLessThanOrEqual(1);
      expect(Math.abs(s.brazoSaludo - previo)).toBeLessThan(0.2);
      expect(Math.abs(s.cabezaAsentir - previoAs)).toBeLessThan(0.2);
      previo = s.brazoSaludo;
      previoAs = s.cabezaAsentir;
      maxBrazo = Math.max(maxBrazo, s.brazoSaludo);
      maxAs = Math.max(maxAs, s.cabezaAsentir);
    }
    expect(maxBrazo).toBeGreaterThan(0.85);
    expect(maxAs).toBeGreaterThan(0.5);
    expect(s).toEqual({ brazoSaludo: 0, cabezaAsentir: 0, giroCabeza: 0 });
  });

  it('la intensidad escala el saludo', () => {
    const maximo = (intensidad: number) => {
      const r = crearReaccion();
      const s = crearSalidaReaccion();
      dispararSaludo(r, 0, intensidad);
      let m = 0;
      for (let t = 0; t < 3; t += 1 / 60) {
        avanzarReaccion(r, t, s);
        m = Math.max(m, s.brazoSaludo);
      }
      return m;
    };
    expect(maximo(0.3)).toBeLessThan(maximo(1));
    expect(maximo(0)).toBe(0);
  });

  it('girar la cabeza hacia quien habla y volver al frente', () => {
    const r = crearReaccion();
    const s = crearSalidaReaccion();
    dispararGiro(r, 0, -0.6);
    let min = 0;
    let previo = 0;
    for (let t = 0; t < 4; t += 1 / 60) {
      avanzarReaccion(r, t, s);
      expect(Math.abs(s.giroCabeza - previo)).toBeLessThan(0.1);
      previo = s.giroCabeza;
      min = Math.min(min, s.giroCabeza);
      expect(s.giroCabeza).toBeLessThanOrEqual(0);
    }
    expect(min).toBeLessThan(-0.55);
    expect(s.giroCabeza).toBe(0);
  });
});

describe('sin asignación', () => {
  it('50 000 llamadas no hacen crecer el heap más de 2 MB', () => {
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc') as () => void;
    const ss = crearSalidaSentarse();
    const se = crearSalidaEnvolvente();
    const sr = crearSalidaReaccion();
    const r = crearReaccion();
    const w = { valor: 0 };
    const ciclo = (i: number) => {
      const p = (i % 100) / 100;
      curvaSentarse(p, ss);
      curvaLevantarse(p, ss);
      envolventeGesto(p * 1.5, 1.5, se);
      avanzarPeso(w, i % 200 < 100 ? 1 : 0, 1 / 60, 0.4);
      if (i % 300 === 0) dispararSaludo(r, i / 60, 0.8);
      if (i % 500 === 0) dispararGiro(r, i / 60, 0.5);
      avanzarReaccion(r, i / 60, sr);
      suavizarPaso(p);
    };
    for (let i = 0; i < 5000; i++) ciclo(i);
    gc();
    const antes = process.memoryUsage().heapUsed;
    for (let i = 0; i < 50_000; i++) ciclo(i);
    gc();
    expect(process.memoryUsage().heapUsed - antes).toBeLessThan(2 * 1024 * 1024);
  });
});
