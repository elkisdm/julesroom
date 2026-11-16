import { describe, expect, it } from 'vitest';
import { dibujoDe } from '../registroDibujo';
import { DibujoTrading } from './DibujoTrading';

describe('DibujoTrading', () => {
  it('queda registrado para el escenario «trading»', () => {
    expect(dibujoDe('trading')).toBe(DibujoTrading);
  });
});
