import { describe, expect, it } from 'vitest';
import { accionesDe, escenarioTrading } from '@oficina/motor';
import { textoAviso } from './aviso';

describe('texto del aviso de acción', () => {
  const acciones = accionesDe(escenarioTrading);

  it('sin acción no hay aviso', () => {
    expect(textoAviso(null)).toBeNull();
  });

  it('un asiento dice «sentarse» sin objeto', () => {
    const a = acciones.find((x) => x.tipo === 'sentarse')!;
    expect(textoAviso(a)).toEqual({ verbo: 'sentarse', objeto: null });
  });

  it('sentado dice «levantarse», aunque la acción cercana llegue con retraso', () => {
    const a = acciones.find((x) => x.tipo === 'sentarse')!;
    expect(textoAviso(null, true)).toEqual({ verbo: 'levantarse', objeto: null });
    expect(textoAviso(a, true)).toEqual({ verbo: 'levantarse', objeto: null });
  });

  it('un interés dice «abrir» y su nombre', () => {
    const a = acciones.find((x) => x.id === 'abrir:mesa:cripto')!;
    expect(textoAviso(a)).toEqual({ verbo: 'abrir', objeto: 'Mesa Cripto' });
  });
});
