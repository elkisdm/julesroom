import { describe, expect, it } from 'vitest';
import { buscarMencion, completarMencion, normalizar, sugerirMenciones } from './mencion';

const AGENTES = [
  { id: 'analista', nombre: 'Dato', rol: 'analista de datos' },
  { id: 'disenadora', nombre: 'Lienzo', rol: 'diseñadora' },
  { id: 'soporte', nombre: 'Guía', rol: 'agente de soporte' },
];

describe('normalizar', () => {
  it('quita tildes y mayúsculas', () => expect(normalizar('Guía')).toBe('guia'));
});

describe('buscarMencion', () => {
  it('detecta una mención al inicio y la quita del texto', () => {
    const r = buscarMencion('@Dato cuánto vendimos', AGENTES);
    expect(r?.agente.id).toBe('analista');
    expect(r?.texto).toBe('cuánto vendimos');
  });

  it('detecta una mención en medio, sin importar mayúsculas ni tildes', () => {
    const r = buscarMencion('oye @guia, me ayudas', AGENTES);
    expect(r?.agente.id).toBe('soporte');
    expect(r?.texto).toBe('oye me ayudas');
  });

  it('puede quedar sin texto', () => {
    expect(buscarMencion('@Lienzo', AGENTES)?.texto).toBe('');
  });

  it('no confunde un correo ni un nombre desconocido con una mención', () => {
    expect(buscarMencion('escribe a dato@correo.cl', AGENTES)).toBeNull();
    expect(buscarMencion('@Nadie hola', AGENTES)).toBeNull();
    expect(buscarMencion('@Datos hola', AGENTES)).toBeNull();
  });

  it('toma la primera mención válida', () => {
    expect(buscarMencion('@Nadie @Lienzo @Dato hola', AGENTES)?.agente.id).toBe('disenadora');
  });
});

describe('sugerirMenciones', () => {
  it('con solo «@» sugiere a todos', () => {
    const s = sugerirMenciones('@', 1, AGENTES);
    expect(s?.lista).toHaveLength(3);
    expect(s?.desde).toBe(0);
  });

  it('filtra por prefijo sin tildes', () => {
    expect(sugerirMenciones('hola @g', 7, AGENTES)?.lista.map((a) => a.id)).toEqual(['soporte']);
  });

  it('devuelve null si no se está mencionando', () => {
    expect(sugerirMenciones('hola', 4, AGENTES)).toBeNull();
    expect(sugerirMenciones('@Dato ya', 8, AGENTES)).toBeNull();
    expect(sugerirMenciones('a@b', 3, AGENTES)).toBeNull();
  });

  it('con un prefijo sin coincidencias la lista queda vacía', () => {
    expect(sugerirMenciones('@zz', 3, AGENTES)?.lista).toEqual([]);
  });
});

describe('completarMencion', () => {
  it('reemplaza lo escrito por el nombre y deja el cursor tras el espacio', () => {
    const s = sugerirMenciones('hola @Li', 8, AGENTES);
    expect(s).not.toBeNull();
    expect(completarMencion('hola @Li', 8, { desde: s?.desde ?? 0 }, 'Lienzo')).toEqual({
      texto: 'hola @Lienzo ',
      cursor: 13,
    });
  });
});
