import { describe, expect, it } from 'vitest';
import { fraseDeError, frasesDeErrorPorDefecto } from './errores';
import type { CodigoError, DefinicionAgente } from './tipos';

const CODIGOS: CodigoError[] = [
  'sin-clave',
  'sin-red',
  'limite',
  'cortada',
  'demasiado-largo',
  'vacio',
  'interno',
];

const def = { nombre: 'Marta', frasesError: undefined } as unknown as DefinicionAgente;

describe('errores en la voz del agente', () => {
  it('hay una frase por defecto para cada código, con el nombre del agente', () => {
    const f = frasesDeErrorPorDefecto(def);
    for (const c of CODIGOS) {
      expect(f[c].length).toBeGreaterThan(10);
    }
    expect(f['sin-clave']).toContain('Marta');
  });

  it('nunca expone detalles técnicos ni claves', () => {
    const f = frasesDeErrorPorDefecto(def);
    for (const c of CODIGOS)
      expect(f[c]).not.toMatch(/api|key|token|401|429|sdk|anthropic|stack|\.env/i);
  });

  it('usa la frase propia del agente cuando existe y la por defecto cuando no', () => {
    const propia = {
      ...def,
      frasesError: { limite: 'Dame un segundo, estoy a tope.' },
    } as DefinicionAgente;
    expect(fraseDeError(propia, 'limite')).toBe('Dame un segundo, estoy a tope.');
    expect(fraseDeError(propia, 'vacio')).toBe(frasesDeErrorPorDefecto(propia).vacio);
  });
});
