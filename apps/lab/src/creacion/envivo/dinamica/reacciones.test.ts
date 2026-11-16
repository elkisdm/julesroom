import { describe, it, expect } from 'vitest';
import { crearReacciones } from './reacciones';
describe('reacciones por persona', () => {
  it('mantiene manos en orden y no las baja al reír', () => {
    const r = crearReacciones();
    r.recibir('b', 3, true, 1000);
    r.recibir('a', 3, true, 2000);
    r.recibir('b', 4, true, 3000);
    expect(r.manos()).toEqual(['b', 'a']);
    r.recibir('b', 3, false, 4000);
    expect(r.manos()).toEqual(['a']);
  });
  it('caduca la reacción breve y conserva la mano hasta bajarla', () => {
    const r = crearReacciones();
    r.recibir('a', 3, true, 1000);
    r.recibir('b', 1, true, 1000);
    r.limpiar(5000, ['a', 'b']);
    expect(r.visibles().size).toBe(0);
    expect(r.manos()).toEqual(['a']);
  });
  it('detecta aplauso de grupo solo con personas diferentes y respeta la cuota', () => {
    const r = crearReacciones();
    expect(r.recibir('a', 2, true, 1000)).toBe(false);
    r.recibir('a', 2, true, 1100);
    expect(r.recibir('b', 2, true, 1200)).toBe(false);
    expect(r.recibir('c', 2, true, 1300)).toBe(true);
    expect(r.recibir('d', 2, true, 1400)).toBe(false);
  });
  it('quita las manos de quien sale', () => {
    const r = crearReacciones();
    r.recibir('a', 3, true, 1000);
    r.limpiar(2000, []);
    expect(r.manos()).toEqual([]);
  });
});
