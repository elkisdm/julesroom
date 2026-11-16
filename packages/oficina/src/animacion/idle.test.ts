import { describe, expect, it } from 'vitest';
import { azarSecuencia, azarSemilla } from '../test-utils';
import { ajusteIdle, ajusteNeutro, nuevoIdle, TODAS_LAS_VARIANTES, VARIANTES_IDLE } from './idle';
import type { Idle } from './idle';
import { LIMITE_CODO } from './articulaciones';

describe('nuevoIdle', () => {
  it('elige variantes ponderadas: azar 0 -> la primera, ~1 -> la última', () => {
    expect(nuevoIdle(azarSecuencia(0, 0, 0)).variante).toBe(VARIANTES_IDLE[0]?.nombre);
    expect(nuevoIdle(azarSecuencia(0.9999, 0, 0)).variante).toBe(VARIANTES_IDLE.at(-1)?.nombre);
  });

  it('la frecuencia respeta los pesos', () => {
    const azar = azarSemilla(7);
    const cuenta = new Map<string, number>();
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const { variante } = nuevoIdle(azar);
      cuenta.set(variante, (cuenta.get(variante) ?? 0) + 1);
    }
    const total = VARIANTES_IDLE.reduce((s, v) => s + v.peso, 0);
    for (const v of VARIANTES_IDLE) {
      expect((cuenta.get(v.nombre) ?? 0) / n).toBeCloseTo(v.peso / total, 1);
    }
  });

  it('la duración cae entre 3 y 8 s', () => {
    expect(nuevoIdle(azarSecuencia(0.5, 0, 0)).duracion).toBeCloseTo(3, 6);
    expect(nuevoIdle(azarSecuencia(0.5, 0.9999, 0)).duracion).toBeLessThanOrEqual(8);
  });

  it('30 agentes no quedan en fase: todos los desfases son distintos', () => {
    const azar = azarSemilla(42);
    const fases = Array.from({ length: 30 }, () => nuevoIdle(azar).fase);
    expect(new Set(fases).size).toBe(30);
    for (const f of fases) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(Math.PI * 2);
    }
  });
});

describe('ajusteIdle', () => {
  const idle = (variante: Idle['variante']): Idle => ({ variante, duracion: 5, fase: 1 });

  it('al empezar y al terminar no altera la pose (peso 0)', () => {
    for (const { nombre } of VARIANTES_IDLE) {
      for (const progreso of [0, 1]) {
        const a = ajusteIdle(idle(nombre), progreso, 3, ajusteNeutro());
        expect(a.mezcla[0]).toBeCloseTo(0, 6);
        expect(a.mezcla[1]).toBeCloseTo(0, 6);
        expect(Math.abs(a.cabezaYaw)).toBeLessThan(1e-9);
      }
    }
  });

  it('estirarse levanta ambos brazos a mitad de la duración', () => {
    const a = ajusteIdle(idle('estirarse'), 0.5, 0, ajusteNeutro());
    expect(a.mezcla).toEqual([1, 1]);
    expect(a.hombro[0]).toBeLessThan(-2);
    expect(a.cabezaPitch).toBeGreaterThan(0);
  });

  it('rascarse y tamborilear solo mueven el brazo derecho', () => {
    for (const v of ['rascarse_cabeza', 'tamborilear'] as const) {
      const a = ajusteIdle(idle(v), 0.5, 0, ajusteNeutro());
      expect(a.mezcla[0]).toBe(0);
      expect(a.mezcla[1]).toBeGreaterThan(0.9);
    }
  });

  it('respirar no toca nada y mirar_alrededor solo gira la cabeza', () => {
    const r = ajusteIdle(idle('respirar'), 0.5, 2, ajusteNeutro());
    expect(r).toEqual(ajusteNeutro());
    const m = ajusteIdle(idle('mirar_alrededor'), 0.5, 2, ajusteNeutro());
    expect(m.mezcla).toEqual([0, 0]);
    expect(m.cabezaYaw).not.toBe(0);
  });

  it('reutiliza y limpia el objeto de salida entre llamadas', () => {
    const salida = ajusteNeutro();
    ajusteIdle(idle('estirarse'), 0.5, 0, salida);
    expect(ajusteIdle(idle('respirar'), 0.5, 0, salida)).toBe(salida);
    expect(salida).toEqual(ajusteNeutro());
  });

  it('el codo siempre queda dentro del rango articulable', () => {
    for (const { nombre } of VARIANTES_IDLE) {
      for (let p = 0; p <= 1; p += 0.1) {
        const a = ajusteIdle(idle(nombre), p, p * 9, ajusteNeutro());
        for (const codo of a.codo) {
          expect(codo).toBeGreaterThanOrEqual(0);
          expect(codo).toBeLessThanOrEqual(LIMITE_CODO);
        }
      }
    }
  });

  it('todas las variantes (también las de personalidad) entran y salen sin alterar la pose', () => {
    for (const nombre of TODAS_LAS_VARIANTES) {
      for (const progreso of [0, 1]) {
        const a = ajusteIdle(idle(nombre), progreso, 3, ajusteNeutro());
        expect(a.mezcla[0]).toBeCloseTo(0, 6);
        expect(a.mezcla[1]).toBeCloseTo(0, 6);
        expect(a.prop).toBe('ninguno');
        expect(Math.abs(a.columna)).toBeLessThan(1e-9);
      }
    }
  });

  it('todas las variantes dejan el codo y el hombro dentro de rango', () => {
    for (const nombre of TODAS_LAS_VARIANTES) {
      for (let p = 0; p <= 1; p += 0.1) {
        const a = ajusteIdle(idle(nombre), p, p * 9, ajusteNeutro());
        for (const codo of a.codo) {
          expect(codo).toBeGreaterThanOrEqual(0);
          expect(codo).toBeLessThanOrEqual(LIMITE_CODO);
        }
      }
    }
  });

  it('leer y revisar papeles sostienen una hoja con la mano izquierda', () => {
    for (const v of ['leer_documento', 'revisar_papeles'] as const) {
      const a = ajusteIdle(idle(v), 0.5, 0, ajusteNeutro());
      expect(a.prop).toBe('hoja');
      expect(a.mezcla[0]).toBeGreaterThan(0.9);
      expect(a.cabezaPitch).toBeLessThan(0);
    }
  });

  it('revisar papeles pasa la hoja con la otra mano: el brazo derecho se mueve en el tiempo', () => {
    const a = ajusteIdle(idle('revisar_papeles'), 0.5, 0, ajusteNeutro()).hombro[1];
    const b = ajusteIdle(idle('revisar_papeles'), 0.5, 0.6, ajusteNeutro()).hombro[1];
    expect(a).not.toBeCloseTo(b, 2);
  });

  it('el teléfono lleva el aparato al oído con el brazo derecho', () => {
    const a = ajusteIdle(idle('telefono'), 0.5, 0, ajusteNeutro());
    expect(a.prop).toBe('telefono');
    expect(a.mezcla[1]).toBeGreaterThan(0.9);
    expect(a.hombro[1]).toBeLessThan(-1.5);
  });

  it('tomar café muestra la taza y estirar la espalda arquea la columna', () => {
    expect(ajusteIdle(idle('tomar_cafe'), 0.5, 0, ajusteNeutro()).prop).toBe('taza');
    const e = ajusteIdle(idle('estirar_espalda'), 0.5, 0, ajusteNeutro());
    expect(e.columna).toBeLessThan(0);
    expect(e.mezcla).toEqual([1, 1]);
  });

  it('probar la luz gira la cabeza a ambos lados', () => {
    const lados = new Set<number>();
    for (let t = 0; t < 6; t += 0.25) {
      lados.add(Math.sign(ajusteIdle(idle('probar_luz'), 0.5, t, ajusteNeutro()).cabezaYaw));
    }
    expect(lados.has(1)).toBe(true);
    expect(lados.has(-1)).toBe(true);
  });

  it('señalar extiende el brazo derecho y asentir cabecea hacia abajo', () => {
    const s = ajusteIdle(idle('senalar'), 0.5, 0, ajusteNeutro());
    expect(s.mezcla[1]).toBe(1);
    expect(s.hombro[1]).toBeLessThan(-1.2);
    let minimo = 0;
    for (let t = 0; t < 4; t += 0.1) {
      minimo = Math.min(minimo, ajusteIdle(idle('asentir'), 0.5, t, ajusteNeutro()).cabezaPitch);
    }
    expect(minimo).toBeLessThan(-0.1);
  });
});

describe('nuevoIdle con pesos de personalidad', () => {
  it('solo elige variantes con peso y respeta los pesos dados', () => {
    const azar = azarSemilla(3);
    const pesos = { leer_documento: 3, respirar: 1 };
    const cuenta = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const { variante } = nuevoIdle(azar, pesos);
      cuenta.set(variante, (cuenta.get(variante) ?? 0) + 1);
    }
    expect([...cuenta.keys()].sort()).toEqual(['leer_documento', 'respirar']);
    expect((cuenta.get('leer_documento') ?? 0) / 4000).toBeCloseTo(0.75, 1);
  });
});
