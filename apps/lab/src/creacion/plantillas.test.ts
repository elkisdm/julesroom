import { describe, expect, it } from 'vitest';
import { aDefinicion, escenarioPorId, validarDefinicion } from '@oficina/motor';
import {
  ID_YO,
  PLANTILLAS,
  atuendoInicial,
  conPlantilla,
  datosPlantilla,
  mesaDe,
  moverAgenteAMesa,
  nombreSugerido,
  salaNueva,
  zonasDeTrabajo,
} from './plantillas';

const datos = {
  nombre: 'Sala Norte',
  equipo: 'Mesa de cripto',
  tuNombre: 'Elkis',
  atuendo: atuendoInicial(1),
};

describe('plantillas de sala', () => {
  it('trading, oficina y mansión están registradas, trading primero', () => {
    expect(PLANTILLAS.map((p) => p.id)).toEqual(['trading', 'oficina', 'mansion', 'auditorio']);
  });

  it('el auditorio se puede construir y trae producción a un costado', () => {
    const s = salaNueva('auditorio', datos);
    expect(PLANTILLAS.find((p) => p.id === 'auditorio')?.construible).toBe(true);
    expect(s.plano.plantilla).toBe('auditorio');
    expect(
      s.ocupantes.filter((o) => o.tipo === 'agente').every((o) => o.departamento === 'produccion'),
    ).toBe(true);
  });

  it('los datos que se muestran salen del escenario', () => {
    const d = datosPlantilla('trading');
    expect(d.nombre).toBe('Sala de trading');
    expect(d.puestos).toBeGreaterThan(0);
    expect(d.pantallas).toBe(escenarioPorId('trading').pantallas.length);
  });

  it.each(PLANTILLAS.map((p) => p.id))(
    'una sala nueva de %s es una definición válida para el motor',
    (id) => {
      const s = salaNueva(id, datos);
      expect(validarDefinicion(aDefinicion(s)).errores).toEqual([]);
      expect(s.ocupantes.find((o) => o.id === ID_YO)?.nombre).toBe('Elkis');
      expect(s.ocupantes.filter((o) => o.tipo === 'agente')).toHaveLength(3);
    },
  );

  it('nombres vacíos caen en valores legibles', () => {
    const s = salaNueva('trading', { ...datos, nombre: '  ', equipo: '', tuNombre: '' });
    expect(s.nombre).toBe('Mi sala');
    expect(s.departamentos[0]?.nombre).toBe('Equipo');
    expect(s.ocupantes.find((o) => o.id === ID_YO)?.nombre).toBe('Tú');
  });

  it('cambiar de plantilla conserva nombre, equipo y tu personaje', () => {
    const s = conPlantilla(salaNueva('trading', datos), 'oficina');
    expect(s.plano.plantilla).toBe('oficina');
    expect(s.nombre).toBe('Sala Norte');
    expect(s.equipo).toBe('Mesa de cripto');
    expect(s.ocupantes.find((o) => o.id === ID_YO)?.atuendo).toEqual(datos.atuendo);
  });

  it('sugiere un nombre de sala con tu nombre', () => {
    expect(nombreSugerido('Elkis')).toBe('Sala de Elkis');
    expect(nombreSugerido(' ')).toBe('Sala Norte');
  });
});

describe('mesas de los agentes', () => {
  const trading = escenarioPorId('trading');

  it('trading y oficina tienen mesas en orden; la mansión no', () => {
    const z = zonasDeTrabajo(trading);
    expect(z.length).toBeGreaterThan(1);
    expect(z[0]?.id).toBe('equipo-1');
    expect(zonasDeTrabajo(escenarioPorId('mansion'))).toEqual([]);
  });

  it('mover a la mesa 3 crea los departamentos que faltan y la definición sigue válida', () => {
    const s = moverAgenteAMesa(
      salaNueva('trading', datos),
      'ag-2',
      2,
      zonasDeTrabajo(trading).length,
    );
    expect(mesaDe(s, 'ag-2')).toBe(2);
    expect(mesaDe(s, 'ag-1')).toBe(0);
    expect(s.departamentos).toHaveLength(3);
    expect(validarDefinicion(aDefinicion(s)).errores).toEqual([]);
  });

  it('una mesa fuera de rango o un id que no es agente no cambia nada', () => {
    const s = salaNueva('trading', datos);
    expect(moverAgenteAMesa(s, 'ag-1', 99, 4)).toBe(s);
    expect(moverAgenteAMesa(s, ID_YO, 1, 4)).toBe(s);
  });
});

describe('puestos que muestra el selector', () => {
  it('el auditorio cuenta sus 25 butacas, no los 3 puestos de producción', () => {
    expect(datosPlantilla('auditorio').puestos).toBe(25);
  });
  it('las oficinas siguen contando sus puestos de trabajo', () => {
    expect(datosPlantilla('trading').puestos).toBeGreaterThan(0);
    expect(datosPlantilla('trading').puestos).not.toBe(25);
  });
});
