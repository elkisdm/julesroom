import { describe, expect, it } from 'vitest';
import { DibujoMansion } from './DibujoMansion';
import { dibujoDe } from './registroDibujo';

describe('DibujoMansion', () => {
  it('queda registrado para el escenario «mansion»', () => {
    expect(dibujoDe('mansion')).toBe(DibujoMansion);
  });
});
