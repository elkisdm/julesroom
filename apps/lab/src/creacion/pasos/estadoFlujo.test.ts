import { describe, expect, it } from 'vitest';
import { escenarioPorId } from '@oficina/motor';
import { atuendoInicial, salaNueva } from '../plantillas';
import {
  espacioHoja,
  zonaDeAgentes,
  indiceAgente,
  accionFlujo,
  validarNombre,
  seleccionarAgentes,
  alternarAgente,
  llegadaDisponible,
  progresoTransicion,
  PARAMETROS_FLUJO as P,
} from './estadoFlujo';

const sala = salaNueva('trading', {
  nombre: '',
  equipo: '',
  tuNombre: '',
  atuendo: atuendoInicial(3),
});
describe('nombre', () => {
  it('rechaza vacío y espacios', () => {
    expect(validarNombre('').valido).toBe(false);
    expect(validarNombre('   ').valido).toBe(false);
  });
  it('quita espacios al borde y limita a un máximo parametrizado', () => {
    expect(validarNombre('  Jules  ').nombre).toBe('Jules');
    expect(validarNombre('a'.repeat(P.nombreMaximo + 8))).toEqual({
      nombre: 'a'.repeat(P.nombreMaximo),
      valido: true,
      recortado: true,
    });
  });
});
describe('agentes', () => {
  const ids = sala.ocupantes.filter((o) => o.tipo === 'agente').map((o) => o.id);
  it.each([{ lista: ids }, { lista: ids.slice(0, 1) }, { lista: [] }])(
    'selecciona exactamente $lista sin quitar a la persona',
    ({ lista }) => {
      const resultado = seleccionarAgentes(sala, lista);
      expect(resultado.ocupantes.filter((o) => o.tipo === 'agente').map((o) => o.id)).toEqual(
        lista,
      );
      expect(resultado.ocupantes.find((o) => o.id === 'yo')).toEqual(sala.ocupantes[0]);
      expect(sala.ocupantes).toHaveLength(ids.length + 1);
    },
  );
  it('permite quitar y recuperar una sugerencia sin duplicarla', () => {
    expect(alternarAgente(['a', 'b'], 'a')).toEqual(['b']);
    expect(alternarAgente(['b'], 'a')).toEqual(['b', 'a']);
  });
});
describe('teclado de todo el paso', () => {
  it.each(['BUTTON', 'INPUT', 'tab', 'checkbox', 'radio'])(
    'Enter avanza con foco en %s',
    (foco) => {
      expect(accionFlujo({ key: 'Enter', foco }, 'personaje')).toBe('seguir');
    },
  );
  it('Esc vuelve salvo en llegada y nunca navega con composición, repetición o modificadores', () => {
    expect(accionFlujo({ key: 'Escape' }, 'nombre')).toBe('volver');
    expect(accionFlujo({ key: 'Escape' }, 'llegada')).toBe(null);
    for (const bandera of ['isComposing', 'repeat', 'ctrlKey', 'altKey', 'metaKey'])
      expect(accionFlujo({ key: 'Enter', [bandera]: true }, 'nombre')).toBe(null);
    expect(accionFlujo({ key: 'a' }, 'nombre')).toBe(null);
  });
});
it('la llegada espera el fin, también con fallos parciales o totales', () => {
  expect(llegadaDisponible({ terminada: false })).toBe(false);
  expect(llegadaDisponible({ terminada: true })).toBe(true);
  expect(llegadaDisponible({ terminada: true, fallos: 1 })).toBe(true);
  expect(llegadaDisponible({ terminada: true, fallos: 3 })).toBe(true);
});
it('la transición se acota, es continua y permite reducir movimiento', () => {
  expect(progresoTransicion(-1)).toBe(0);
  expect(progresoTransicion(0)).toBe(0);
  expect(progresoTransicion(P.transicionSegundos / 2)).toBeCloseTo(0.5);
  expect(progresoTransicion(P.transicionSegundos)).toBe(1);
  expect(progresoTransicion(100)).toBe(1);
  expect(progresoTransicion(0, true)).toBe(1);
});
it('las flechas recorren agentes de forma circular y toleran una lista vacía', () => {
  expect(indiceAgente(0, 3, 'ArrowLeft')).toBe(2);
  expect(indiceAgente(2, 3, 'ArrowRight')).toBe(0);
  expect(indiceAgente(0, 0, 'ArrowRight')).toBe(-1);
});

it('Espacio activa el botón de UI antes de que el avatar lo use para saltar', () => {
  expect(accionFlujo({ key: ' ', foco: 'BUTTON' }, 'agentes')).toBe('activar');
  expect(accionFlujo({ key: ' ', foco: 'INPUT' }, 'nombre')).toBe(null);
});

it.each(['trading', 'oficina', 'mansion'])(
  'presenta los agentes en una zona real de %s',
  (plantilla) => {
    const s = salaNueva(plantilla, {
      nombre: '',
      equipo: '',
      tuNombre: '',
      atuendo: atuendoInicial(3),
    });
    const e = escenarioPorId(plantilla);
    const zona = zonaDeAgentes(s, e);
    expect(e.vistas.zonas.some((v) => v.id === zona)).toBe(true);
    if (plantilla === 'mansion') expect(zona).toBe('desarrollo');
  },
);

it('reserva el alto real de la hoja móvil y sus márgenes', () => {
  expect(espacioHoja(180)).toBe(180 + P.margenHoja * 2);
});
