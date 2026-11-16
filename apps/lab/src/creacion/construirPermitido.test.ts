/**
 * Una sola condición decide si se puede construir: la usan el botón «Construir» y la tecla B.
 * La mansión (varias plantas) no es construible por ahora: ni botón ni tecla.
 */
import { describe, expect, it } from 'vitest';
import { PLANTILLAS, puedeConstruir } from './plantillas';

describe('puedeConstruir', () => {
  it('dentro de una plantilla construible, sí', () => {
    expect(puedeConstruir('dentro', 'trading')).toBe(true);
    expect(puedeConstruir('dentro', 'oficina')).toBe(true);
  });

  it('en la mansión, no (ni el botón ni la tecla B)', () => {
    expect(puedeConstruir('dentro', 'mansion')).toBe(false);
  });

  it('fuera de la sala (onboarding), en ninguna plantilla', () => {
    for (const p of PLANTILLAS) {
      for (const paso of ['llegada', 'sala', 'nombre', 'personaje', 'agentes', 'invitar']) {
        expect(puedeConstruir(paso, p.id), `${paso} · ${p.id}`).toBe(false);
      }
    }
  });
});
