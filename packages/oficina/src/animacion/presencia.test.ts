import { describe, expect, it } from 'vitest';
import { avanzarPresencia, crearPresencia, PRESENCIAS } from './presencia';
import type { EstadoPresencia, PresenciaAsistente } from './presencia';

const DT = 1 / 60;

/** Simula `segundos` en un estado dado y devuelve el extremo de cada magnitud. */
function simular(
  p: EstadoPresencia,
  presencia: PresenciaAsistente,
  segundos: number,
  nivel?: number,
  amplitud = 1,
) {
  const rango = {
    escalaMin: Infinity,
    escalaMax: -Infinity,
    brilloMin: Infinity,
    brilloMax: -Infinity,
  };
  for (let i = 0; i < Math.round(segundos / DT); i++) {
    avanzarPresencia(p, presencia, nivel, DT, amplitud);
    rango.escalaMin = Math.min(rango.escalaMin, p.escala);
    rango.escalaMax = Math.max(rango.escalaMax, p.escala);
    rango.brilloMin = Math.min(rango.brilloMin, p.brillo);
    rango.brilloMax = Math.max(rango.brilloMax, p.brillo);
  }
  return rango;
}

describe('presencia del asistente', () => {
  it('declara los cinco estados', () => {
    expect([...PRESENCIAS]).toEqual([
      'reposo',
      'escuchando',
      'pensando',
      'hablando',
      'esperando_decision',
    ]);
  });

  it('en reposo flota y respira con una escala cercana a 1', () => {
    const p = crearPresencia();
    const r = simular(p, 'reposo', 6);
    expect(r.escalaMin).toBeGreaterThan(0.9);
    expect(r.escalaMax).toBeLessThan(1.1);
    expect(r.escalaMax - r.escalaMin).toBeGreaterThan(0.05);
  });

  it('escuchando contrae los anillos hacia el orbe, afina el brillo e inclina hacia la cámara', () => {
    const reposo = crearPresencia();
    simular(reposo, 'reposo', 5);
    const escucha = crearPresencia();
    simular(escucha, 'escuchando', 5);
    expect(escucha.ondasDir).toBeLessThan(0);
    expect(escucha.ondasAmp).toBeGreaterThan(0.3);
    expect(escucha.haloEscala).toBeLessThan(reposo.haloEscala);
    expect(escucha.inclinacion).toBeGreaterThan(reposo.inclinacion);
  });

  it('pensando acelera los satélites, los aprieta y enfría el tono hacia teal', () => {
    const reposo = crearPresencia();
    simular(reposo, 'reposo', 5);
    const piensa = crearPresencia();
    simular(piensa, 'pensando', 5);
    expect(piensa.velSat).toBeGreaterThan(reposo.velSat * 2);
    expect(piensa.radSat).toBeLessThan(reposo.radSat);
    expect(piensa.b).toBeGreaterThan(piensa.r);
    expect(reposo.r).toBeGreaterThan(reposo.b);
  });

  it('pensando pulsa el brillo de forma irregular', () => {
    const p = crearPresencia();
    simular(p, 'pensando', 3);
    const r = simular(p, 'pensando', 6);
    expect(r.brilloMax - r.brilloMin).toBeGreaterThan(0.15);
  });

  it('hablando sale en ámbar brillante con ondas hacia afuera', () => {
    const p = crearPresencia();
    simular(p, 'hablando', 5);
    expect(p.ondasDir).toBeGreaterThan(0);
    expect(p.ondasAmp).toBeGreaterThan(0.3);
    expect(p.r).toBeGreaterThan(p.b);
  });

  it('hablando: el nivel de voz modula la amplitud del pulso', () => {
    const callado = crearPresencia();
    const fuerte = crearPresencia();
    simular(callado, 'hablando', 3, 0);
    simular(fuerte, 'hablando', 3, 1);
    const a = simular(callado, 'hablando', 1, 0);
    const b = simular(fuerte, 'hablando', 1, 1);
    expect(b.escalaMax).toBeGreaterThan(a.escalaMax + 0.1);
  });

  it('hablando sin nivel usa un ritmo sintético que varía en el tiempo', () => {
    const p = crearPresencia();
    simular(p, 'hablando', 3);
    const r = simular(p, 'hablando', 4);
    expect(r.escalaMax - r.escalaMin).toBeGreaterThan(0.1);
  });

  it('esperando_decision late lento y parpadea el halo como un farol', () => {
    const p = crearPresencia();
    simular(p, 'esperando_decision', 3);
    expect(p.r).toBeGreaterThan(p.b);
    const r = simular(p, 'esperando_decision', 8);
    expect(r.brilloMax - r.brilloMin).toBeGreaterThan(0.2);
    expect(r.escalaMax - r.escalaMin).toBeLessThan(0.2);
  });

  it('las transiciones son continuas: ninguna magnitud salta entre cuadros', () => {
    const p = crearPresencia();
    simular(p, 'reposo', 3);
    for (const destino of PRESENCIAS) {
      simular(p, destino, 2);
      for (const siguiente of PRESENCIAS) {
        const antes = { escala: p.escala, brillo: p.brillo, r: p.r, b: p.b, sat: p.faseSat };
        avanzarPresencia(p, siguiente, undefined, DT, 1);
        expect(Math.abs(p.escala - antes.escala)).toBeLessThan(0.08);
        expect(Math.abs(p.brillo - antes.brillo)).toBeLessThan(0.15);
        expect(Math.abs(p.r - antes.r)).toBeLessThan(0.06);
        expect(Math.abs(p.b - antes.b)).toBeLessThan(0.06);
        expect(Math.abs(p.faseSat - antes.sat)).toBeLessThan(0.3);
        simular(p, destino, 2);
      }
    }
  });

  it('prefers-reduced-motion reduce las amplitudes', () => {
    const normal = crearPresencia();
    const reducido = crearPresencia();
    simular(normal, 'hablando', 3, undefined, 1);
    simular(reducido, 'hablando', 3, undefined, 0.35);
    const a = simular(normal, 'hablando', 4, undefined, 1);
    const b = simular(reducido, 'hablando', 4, undefined, 0.35);
    expect(b.escalaMax - b.escalaMin).toBeLessThan((a.escalaMax - a.escalaMin) * 0.6);
    expect(reducido.ondasAmp).toBeLessThan(normal.ondasAmp);
  });

  it('un cuadro enorme (pestaña oculta) no rompe nada', () => {
    const p = crearPresencia();
    avanzarPresencia(p, 'hablando', 0.5, 30, 1);
    for (const v of [p.escala, p.brillo, p.r, p.g, p.b, p.faseSat, p.haloEscala]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(p.escala).toBeLessThan(2);
  });
});
