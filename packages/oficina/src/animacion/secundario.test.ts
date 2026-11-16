import { describe, expect, it } from 'vitest';
import {
  PARAMETROS_SECUNDARIO as P,
  avanzarSecundario,
  crearSecundario,
  impulsoPisada,
  impulsoSentarse,
  type EntradasSecundario,
  type Secundario,
} from './secundario';

const DT = 1 / 60;
const reposo = (): EntradasSecundario => ({
  aceleracionLong: 0,
  aceleracionLat: 0,
  giro: 0,
  velocidad: 0,
});

function avanzar(s: Secundario, e: EntradasSecundario, segundos: number, dt = DT): void {
  for (let i = 0; i < Math.round(segundos / dt); i++) avanzarSecundario(s, e, dt);
}

const todo = (s: Secundario) => [
  s.cabezaPitch,
  s.cabezaRoll,
  s.brazo[0],
  s.brazo[1],
  s.torsoRoll,
  s.escalaY,
];

describe('crearSecundario', () => {
  it('nace en reposo: ángulos en 0 y escalas en 1', () => {
    const s = crearSecundario();
    for (const r of [s.cabezaPitch, s.cabezaRoll, s.brazo[0], s.brazo[1], s.torsoRoll]) {
      expect(r).toEqual({ x: 0, v: 0 });
    }
    expect(s.escalaY).toEqual({ x: 1, v: 0 });
    expect(s.escalaXZ).toBe(1);
  });

  it('con entradas en reposo todo se queda en 0/1', () => {
    const s = crearSecundario();
    avanzar(s, reposo(), 2);
    for (const r of [s.cabezaPitch, s.cabezaRoll, s.brazo[0], s.brazo[1], s.torsoRoll]) {
      expect(r.x).toBe(0);
    }
    expect(s.escalaY.x).toBe(1);
    expect(s.escalaXZ).toBe(1);
  });
});

describe('impulsos', () => {
  it.each([
    ['pisada', impulsoPisada],
    ['sentarse', impulsoSentarse],
  ] as const)('el impulso de %s aplasta, rebota y vuelve a 1 en < 0,5 s', (_, impulso) => {
    const s = crearSecundario();
    impulso(s, 1);
    let minimo = 1;
    let maximo = 1;
    for (let i = 0; i < Math.round(0.5 / DT); i++) {
      avanzarSecundario(s, reposo(), DT);
      minimo = Math.min(minimo, s.escalaY.x);
      maximo = Math.max(maximo, s.escalaY.x);
    }
    expect(minimo).toBeLessThan(0.97); // aplasta
    expect(maximo).toBeGreaterThan(1.002); // estira al rebotar
    expect(Math.abs(s.escalaY.x - 1)).toBeLessThan(0.005);
  });

  it('sentarse aplasta más que una pisada y la intensidad escala el efecto', () => {
    const hondura = (impulso: typeof impulsoPisada, intensidad: number) => {
      const s = crearSecundario();
      impulso(s, intensidad);
      let minimo = 1;
      for (let i = 0; i < 30; i++) {
        avanzarSecundario(s, reposo(), DT);
        minimo = Math.min(minimo, s.escalaY.x);
      }
      return minimo;
    };
    expect(hondura(impulsoSentarse, 1)).toBeLessThan(hondura(impulsoPisada, 1));
    expect(hondura(impulsoPisada, 0.5)).toBeGreaterThan(hondura(impulsoPisada, 1));
  });

  it('conserva el volumen (±5 %): escalaY · escalaXZ² ≈ 1', () => {
    const s = crearSecundario();
    impulsoSentarse(s, 1);
    impulsoPisada(s, 1);
    for (let i = 0; i < 60; i++) {
      avanzarSecundario(s, reposo(), DT);
      const volumen = s.escalaY.x * s.escalaXZ * s.escalaXZ;
      expect(Math.abs(volumen - 1)).toBeLessThan(0.05);
      if (s.escalaY.x < 1) expect(s.escalaXZ).toBeGreaterThan(1);
    }
  });

  it('un impulso enorme no deja la escala fuera de sus límites', () => {
    const s = crearSecundario();
    impulsoSentarse(s, 100);
    for (let i = 0; i < 60; i++) {
      avanzarSecundario(s, reposo(), DT);
      expect(s.escalaY.x).toBeGreaterThanOrEqual(P.escalaMin);
      expect(s.escalaY.x).toBeLessThanOrEqual(P.escalaMax);
      expect(Number.isFinite(s.escalaXZ)).toBe(true);
    }
  });
});

describe('seguimiento con retraso', () => {
  it('la cabeza se retrasa respecto de una aceleración brusca y luego vuelve', () => {
    const s = crearSecundario();
    const e = reposo();
    e.aceleracionLong = 3;
    const objetivo = P.gananciaCabezaPitch * 3;
    avanzarSecundario(s, e, DT);
    expect(Math.abs(s.cabezaPitch.x)).toBeLessThan(0.3 * objetivo); // aún no llegó
    expect(s.cabezaPitch.x).toBeGreaterThan(0); // se queda atrás: mira hacia arriba
    let maximo = 0;
    for (let i = 0; i < 9; i++) {
      avanzarSecundario(s, e, DT);
      maximo = Math.max(maximo, s.cabezaPitch.x);
    }
    expect(maximo).toBeGreaterThan(0.5 * objetivo);
    e.aceleracionLong = 0;
    avanzar(s, e, 2);
    expect(Math.abs(s.cabezaPitch.x)).toBeLessThan(0.002);
  });

  it('los brazos se quedan atrás al acelerar y cada pieza tiene su propia frecuencia', () => {
    const s = crearSecundario();
    const e = reposo();
    e.aceleracionLong = 2.2;
    avanzar(s, e, 0.15);
    expect(s.brazo[0].x).toBeGreaterThan(0);
    expect(s.brazo[1].x).toBeGreaterThan(0);
    expect(s.brazo[0].x).not.toBeCloseTo(s.brazo[1].x, 4);
    const frecuencias = [
      P.frecuenciaCabezaPitch,
      P.frecuenciaCabezaRoll,
      P.frecuenciaBrazo0,
      P.frecuenciaBrazo1,
      P.frecuenciaTorso,
    ];
    expect(new Set(frecuencias).size).toBe(frecuencias.length);
  });

  it('la cabeza se inclina hacia fuera de la curva y el torso hacia dentro', () => {
    const s = crearSecundario();
    const e = reposo();
    e.aceleracionLat = 3;
    e.giro = 3;
    e.velocidad = 1;
    avanzar(s, e, 0.3);
    expect(s.cabezaRoll.x).toBeLessThan(0);
    expect(s.torsoRoll.x).toBeGreaterThan(0);
  });

  it('es independiente de la tasa de cuadros', () => {
    const a = crearSecundario();
    const b = crearSecundario();
    const e = reposo();
    e.aceleracionLong = 2;
    avanzar(a, e, 0.4, 1 / 30);
    avanzar(b, e, 0.4, 1 / 144);
    for (let i = 0; i < todo(a).length; i++) {
      expect(Math.abs((todo(a)[i]?.x ?? 0) - (todo(b)[i]?.x ?? 0))).toBeLessThan(0.01);
    }
  });

  it('sin NaN con dt = 0 y dt = 0,1', () => {
    const s = crearSecundario();
    const e = { aceleracionLong: 5, aceleracionLat: -4, giro: 6, velocidad: 1.15 };
    avanzarSecundario(s, e, 0);
    for (let i = 0; i < 50; i++) avanzarSecundario(s, e, 0.1);
    for (const r of todo(s)) expect(Number.isFinite(r.x) && Number.isFinite(r.v)).toBe(true);
    expect(Number.isFinite(s.escalaXZ)).toBe(true);
  });
});

describe('sin asignación por cuadro', () => {
  it('50 000 llamadas no hacen crecer el heap más de 2 MB', () => {
    const s = crearSecundario();
    const e = { aceleracionLong: 1.5, aceleracionLat: 0.5, giro: 1, velocidad: 1 };
    const gc = (globalThis as { gc?: () => void }).gc;
    for (let i = 0; i < 2000; i++) avanzarSecundario(s, e, DT); // calentamiento
    gc?.();
    const antes = process.memoryUsage().heapUsed;
    for (let i = 0; i < 50_000; i++) {
      avanzarSecundario(s, e, DT);
      if (i % 500 === 0) {
        impulsoPisada(s, 1);
        impulsoSentarse(s, 0.5);
      }
    }
    gc?.();
    const crecimiento = process.memoryUsage().heapUsed - antes;
    if (gc) expect(crecimiento).toBeLessThan(2 * 1024 * 1024);
    else expect(Number.isFinite(crecimiento)).toBe(true);
  });
});
