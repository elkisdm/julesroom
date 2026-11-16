import { describe, expect, it } from 'vitest';
import { crearPose, gestoAsistente, nivelSintetico, suavizarPose } from './gesto';
import type { PoseAsistente } from './gesto';

/** Mayor desviación de la pose en reposo al hablar con `nivel` constante, barriendo el tiempo. */
function desvio(nivel: number): number {
  const reposo = crearPose();
  const p = crearPose();
  let max = 0;
  for (let t = 0; t < 20; t += 0.05) {
    gestoAsistente(p, 'hablando', nivel, t, 1);
    max = Math.max(
      max,
      Math.abs(p.hombroX - reposo.hombroX),
      Math.abs(p.codo - reposo.codo),
      Math.abs(p.cabezaYaw),
    );
  }
  return max;
}

describe('gestoAsistente', () => {
  it('el gesto crece con el nivel de voz y sin voz no gesticula', () => {
    const cero = desvio(0);
    const bajo = desvio(0.2);
    const medio = desvio(0.5);
    const alto = desvio(0.9);
    expect(cero).toBeLessThan(0.01);
    expect(bajo).toBeGreaterThan(cero);
    expect(medio).toBeGreaterThan(bajo);
    expect(alto).toBeGreaterThan(medio);
  });

  it('la boca se abre en proporción al nivel y se acota a 0..1', () => {
    const p = crearPose();
    const boca = (n: number) => {
      gestoAsistente(p, 'hablando', n, 1, 1);
      return p.boca;
    };
    expect(boca(0)).toBe(0);
    expect(boca(0.3)).toBeLessThan(boca(0.8));
    expect(boca(5)).toBe(1);
    gestoAsistente(p, 'escuchando', 0.8, 1, 1);
    expect(p.boca).toBe(0);
  });

  it('escuchando inclina la cabeza y pensando mira la tableta', () => {
    const p = crearPose();
    gestoAsistente(p, 'escuchando', 0, 1, 1);
    expect(p.cabezaRoll).toBeGreaterThan(0.1);
    gestoAsistente(p, 'pensando', 0, 1, 1);
    expect(p.cabezaPitch).toBeGreaterThan(0.3);
    expect(p.tableta).toBe(1);
  });

  it('con movimiento reducido el gesto se atenúa', () => {
    const p: PoseAsistente = crearPose();
    gestoAsistente(p, 'hablando', 1, 1.2, 1);
    const pleno = Math.abs(p.hombroX - 0.05);
    gestoAsistente(p, 'hablando', 1, 1.2, 0.35);
    expect(Math.abs(p.hombroX - 0.05)).toBeLessThan(pleno);
  });

  it('suavizarPose se acerca al objetivo sin saltar', () => {
    const actual = crearPose();
    const objetivo = crearPose();
    objetivo.cabezaPitch = 1;
    suavizarPose(actual, objetivo, 0.25);
    expect(actual.cabezaPitch).toBeCloseTo(0.25, 6);
  });

  it('el ritmo sintético queda en 0..1', () => {
    for (let t = 0; t < 10; t += 0.01) {
      const n = nivelSintetico(t);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});
