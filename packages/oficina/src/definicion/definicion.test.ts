import { describe, expect, it } from 'vitest';
import { horaChile } from '../ambiente/hora';
import { crearEscenarioPrueba } from '../escenarios/prueba';
import { hayEscenario, registrarEscenario } from '../escenarios/registro';
import { atuendoPorRol } from '../vestuario/roles';
import {
  definicionAProps,
  ejemploEstudio,
  ejemploEquipo,
  parsearDefinicion,
  serializarDefinicion,
  validarDefinicion,
} from './definicion';
import type { DefinicionOficina } from './definicion';

const copia = (d: DefinicionOficina): DefinicionOficina => JSON.parse(JSON.stringify(d));

describe('validarDefinicion', () => {
  it('acepta los dos ejemplos', () => {
    expect(validarDefinicion(ejemploEquipo)).toEqual({ ok: true, errores: [] });
    expect(validarDefinicion(ejemploEstudio)).toEqual({ ok: true, errores: [] });
  });

  it('los ejemplos son distintos (equipo, tema y plantilla de departamentos)', () => {
    expect(ejemploEquipo.nombre).not.toBe(ejemploEstudio.nombre);
    expect(ejemploEquipo.ocupantes.length).not.toBe(ejemploEstudio.ocupantes.length);
    expect(ejemploEquipo.tema).not.toEqual(ejemploEstudio.tema);
    expect(ejemploEquipo.departamentos).not.toEqual(ejemploEstudio.departamentos);
  });

  it('rechaza lo que no es un objeto', () => {
    expect(validarDefinicion(null).ok).toBe(false);
    expect(validarDefinicion('x').ok).toBe(false);
    expect(validarDefinicion([]).ok).toBe(false);
  });

  it('rechaza una versión desconocida', () => {
    const d = { ...copia(ejemploEquipo), version: 2 };
    expect(validarDefinicion(d).errores.join()).toContain('version');
  });

  it('rechaza ids de ocupante repetidos', () => {
    const d = copia(ejemploEquipo);
    const primero = d.ocupantes[0];
    if (!primero) throw new Error('sin ocupantes');
    d.ocupantes.push({ ...primero });
    const r = validarDefinicion(d);
    expect(r.ok).toBe(false);
    expect(r.errores.join()).toContain('repetido');
  });

  it('un agente debe apuntar a un departamento declarado', () => {
    const d = copia(ejemploEquipo);
    d.ocupantes.push({
      tipo: 'agente',
      id: 'x',
      nombre: 'X',
      rol: 'QA',
      departamento: 'no-existe',
    });
    expect(validarDefinicion(d).errores.join()).toContain('no-existe');
  });

  it('rechaza nombre vacío, tipo desconocido y tema fuera de rango', () => {
    const d = copia(ejemploEquipo) as unknown as Record<string, unknown>;
    d['ocupantes'] = [
      { tipo: 'agente', id: 'a', nombre: '  ', rol: 'QA', departamento: 'desarrollo' },
      { tipo: 'robot', id: 'b', nombre: 'B' },
    ];
    d['tema'] = { hora: 30, calidad: 'ultra' };
    const e = validarDefinicion(d).errores.join('\n');
    expect(e).toContain('nombre');
    expect(e).toContain('tipo');
    expect(e).toContain('hora');
    expect(e).toContain('calidad');
  });

  it('un atuendo mal formado se reporta; uno ausente es válido', () => {
    const d = copia(ejemploEquipo);
    const primero = d.ocupantes[0];
    if (!primero) throw new Error('sin ocupantes');
    (primero as { atuendo?: unknown }).atuendo = { skin: 3 };
    expect(validarDefinicion(d).errores.join()).toContain('atuendo');
    delete (primero as { atuendo?: unknown }).atuendo;
    expect(validarDefinicion(d).ok).toBe(true);
  });

  it('plantilla de plano desconocida', () => {
    const d = { ...copia(ejemploEquipo), plano: { plantilla: 'castillo' } };
    expect(validarDefinicion(d).errores.join()).toContain('plantilla');
  });

  it('una plantilla es válida cuando su escenario está registrado', () => {
    const d = { ...copia(ejemploEquipo), plano: { plantilla: 'trading' } };
    if (!hayEscenario('trading')) {
      expect(validarDefinicion(d).errores.join()).toContain('plano.plantilla');
      registrarEscenario(crearEscenarioPrueba('trading'));
    }
    expect(validarDefinicion(d)).toEqual({ ok: true, errores: [] });
  });

  it('la plantilla debe ser un texto', () => {
    const d = { ...copia(ejemploEquipo), plano: { plantilla: 3 } };
    expect(validarDefinicion(d).errores.join()).toContain('plano.plantilla');
  });
});

describe('serializar / parsear', () => {
  it('ida y vuelta conserva la definición', () => {
    const texto = serializarDefinicion(ejemploEstudio);
    expect(parsearDefinicion(texto)).toEqual({ ok: true, definicion: ejemploEstudio, errores: [] });
  });

  it('JSON roto o inválido devuelve errores, no lanza', () => {
    expect(parsearDefinicion('{no es json').ok).toBe(false);
    expect(parsearDefinicion('{"version":1}').ok).toBe(false);
  });
});

describe('definicionAProps', () => {
  it('entrega la plantilla del plano como escenario', () => {
    expect(definicionAProps(copia(ejemploEquipo)).escenario).toBe('mansion');
  });

  it('separa agentes (que mueve el motor) de personas (con posición externa)', () => {
    const d = copia(ejemploEquipo);
    d.ocupantes.push({ tipo: 'persona', id: 'p1', nombre: 'Persona uno' });
    const props = definicionAProps(d);
    expect(props.agentes.every((a) => a.id !== 'p1')).toBe(true);
    expect(props.agentes.length).toBe(d.ocupantes.length - 1);
    expect(props.personas).toEqual([
      {
        id: 'p1',
        nombre: 'Persona uno',
        atuendo: expect.objectContaining({ skin: expect.any(String) }),
      },
    ]);
    expect(props.departamentos).toEqual(d.departamentos);
  });

  it('un agente sin atuendo recibe el de su rol; con atuendo se respeta', () => {
    const d = copia(ejemploEquipo);
    const propio = { ...atuendoPorRol('QA', 3), topColor: '#123456' };
    d.ocupantes = [
      {
        tipo: 'agente',
        id: 'a',
        nombre: 'A',
        rol: 'QA',
        departamento: 'desarrollo',
        atuendo: propio,
      },
      { tipo: 'agente', id: 'b', nombre: 'B', rol: 'QA', departamento: 'desarrollo' },
    ];
    const { agentes } = definicionAProps(d);
    expect(agentes[0]?.atuendo?.topColor).toBe('#123456');
    expect(agentes[1]?.atuendo).toEqual(atuendoPorRol('QA', 1));
  });

  it('el tema fija la hora y la calidad', () => {
    const props = definicionAProps({
      ...copia(ejemploEquipo),
      tema: { hora: 22, calidad: 'baja' },
    });
    expect(props.calidad).toBe('baja');
    expect(props.horaChile ? horaChile(props.horaChile) : -1).toBeCloseTo(22, 5);
  });
});
