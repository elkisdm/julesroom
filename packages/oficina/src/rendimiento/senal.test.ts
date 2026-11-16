import { describe, expect, it } from 'vitest';
import { acotarRefresco, senalDeCuadro } from './senal';

describe('senalDeCuadro', () => {
  it('un cuadro a tiempo no cuenta, aunque haya tardado el refresco completo', () => {
    expect(senalDeCuadro(16.7, 16.7)).toBe(0);
  });
  it('un cuadro perdido cuenta el tiempo completo', () => {
    expect(senalDeCuadro(40, 16.7)).toBe(40);
  });
  it('justo en el umbral de 1,5 refrescos todavía no está perdido', () => {
    expect(senalDeCuadro(25, 16.6666667)).toBe(0);
  });
  it('en una pantalla de 120 Hz un cuadro de 16,7 ms ya es perdido', () => {
    expect(senalDeCuadro(16.7, 8.3)).toBe(16.7);
  });
});

describe('acotarRefresco', () => {
  it('no baja de 4 ms ni sube de 34 ms', () => {
    expect(acotarRefresco(1)).toBe(4);
    expect(acotarRefresco(80)).toBe(34);
    expect(acotarRefresco(16.7)).toBe(16.7);
  });
});
