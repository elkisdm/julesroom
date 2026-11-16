import { describe, expect, it } from 'vitest';
import { decidirCalidad, MUESTRAS_MINIMAS, UMBRAL_BAJAR_MS, UMBRAL_SUBIR_MS } from './calidad';
import type { EntradaCalidad, NivelCalidad } from './calidad';

const base: EntradaCalidad = {
  modo: 'auto',
  nivelActual: 'alta',
  p95: 8,
  muestras: MUESTRAS_MINIMAS,
  reduceMotion: false,
};

describe('decidirCalidad', () => {
  it('modos forzados ignoran las métricas', () => {
    expect(decidirCalidad({ ...base, modo: 'baja', p95: 1 })).toMatchObject({
      nivel: 'baja',
      dpr: 1.25,
      sombras: false,
    });
    expect(decidirCalidad({ ...base, modo: 'alta', p95: 99 })).toMatchObject({
      nivel: 'alta',
      dpr: 2,
      sombras: true,
    });
    expect(decidirCalidad({ ...base, modo: 'media', p95: 99 })).toMatchObject({
      nivel: 'media',
      dpr: 1.25,
      sombras: true,
    });
  });

  it('baja un nivel cuando el p95 pasa de 14 ms (DPR primero, luego sombras)', () => {
    const media = decidirCalidad({ ...base, p95: 15 });
    expect(media).toMatchObject({ nivel: 'media', dpr: 1.25, sombras: true });
    const baja = decidirCalidad({ ...base, nivelActual: 'media', p95: 15 });
    expect(baja).toMatchObject({ nivel: 'baja', sombras: false });
    expect(decidirCalidad({ ...base, nivelActual: 'baja', p95: 40 }).nivel).toBe('baja');
  });

  it('sube un nivel solo cuando el p95 es holgado', () => {
    expect(decidirCalidad({ ...base, nivelActual: 'baja', p95: 8 }).nivel).toBe('media');
    expect(decidirCalidad({ ...base, nivelActual: 'media', p95: 8 }).nivel).toBe('alta');
    expect(decidirCalidad({ ...base, nivelActual: 'alta', p95: 3 }).nivel).toBe('alta');
  });

  it('histéresis: entre los umbrales no cambia de nivel y no oscila', () => {
    expect(UMBRAL_SUBIR_MS).toBeLessThan(UMBRAL_BAJAR_MS);
    let nivel: EntradaCalidad['nivelActual'] = 'alta';
    const cambios: string[] = [];
    for (const p95 of [15, 13, 12, 13.9, 12.5, 13, 9, 12, 13.5]) {
      const siguiente: NivelCalidad = decidirCalidad({ ...base, nivelActual: nivel, p95 }).nivel;
      if (siguiente !== nivel) cambios.push(`${nivel}->${siguiente}`);
      nivel = siguiente;
    }
    expect(cambios).toEqual(['alta->media', 'media->alta']);
  });

  it('sin suficientes muestras mantiene el nivel', () => {
    expect(decidirCalidad({ ...base, p95: 99, muestras: MUESTRAS_MINIMAS - 1 }).nivel).toBe('alta');
  });

  it('prefers-reduced-motion baja el movimiento a 0.35 y desactiva paseos', () => {
    expect(decidirCalidad(base)).toMatchObject({ movimiento: 1, paseos: true });
    expect(decidirCalidad({ ...base, reduceMotion: true })).toMatchObject({
      movimiento: 0.35,
      paseos: false,
    });
  });
});
