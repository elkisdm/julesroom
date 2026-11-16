import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { crearMando } from '../animacion/avatar';
import { accionesDe, ETIQUETA_ACCION } from '../escenarios/acciones';
import { crearEscenarioPrueba } from '../escenarios/prueba';
import type { Accion, AccionHablar, AccionSentarse } from '../escenarios/tipos';
import { Acciones, crearEstadoAvatar, ejecutarAccionAvatar } from './Acciones';
import { ContextoEscenario } from './escenarios/contexto';

let cuadro: (estado: unknown, delta: number) => void;
vi.mock('@react-three/fiber', () => ({
  useFrame: (fn: typeof cuadro) => {
    cuadro = fn;
  },
}));

const asiento: AccionSentarse = {
  id: 'silla',
  tipo: 'sentarse',
  nombre: 'Silla',
  x: 0,
  z: 1,
  radio: 1.3,
  asiento: { x: 0, y: 0.5, z: 1, yaw: 0, aproximacion: { x: 0, y: 0, z: 0 } },
};

function preparar(extras: AccionHablar[] = []) {
  const escenario = crearEscenarioPrueba('acciones');
  escenario.acciones = [asiento];
  const avatar = { current: crearEstadoAvatar() };
  const accion = { current: null as Accion | null };
  const avisar = vi.fn();
  renderToStaticMarkup(
    createElement(
      ContextoEscenario.Provider,
      { value: escenario },
      createElement(Acciones, {
        avatar,
        accion,
        accionesExtra: extras,
        onAccionCercana: { current: avisar },
      }),
    ),
  );
  cuadro(null, 1);
  return { avatar, accion, avisar, escenario };
}

describe('acciones extra y tecla E', () => {
  it('abrir ejecuta solo el interés correspondiente', () => {
    const interes = vi.fn();
    const mando = crearMando();
    ejecutarAccionAvatar(
      mando,
      crearEstadoAvatar(),
      {
        id: 'panel',
        tipo: 'abrir',
        nombre: 'Panel',
        interes: 'ayuda',
        panel: 'ayuda',
        x: 0,
        z: 0,
        radio: 1,
      },
      interes,
    );
    expect(interes).toHaveBeenCalledExactlyOnceWith('ayuda');
    expect(mando.idSentar).toBe(0);
  });

  it.each([2, 0.5])('con hablar a %s m ejecuta únicamente la acción elegida', (z) => {
    const hablar = vi.fn();
    const extra: AccionHablar = {
      id: 'hablar:a',
      agenteId: 'a',
      tipo: 'hablar',
      nombre: 'A',
      x: 0,
      y: 0,
      z,
      radio: 3.2,
      alEjecutar: hablar,
    };
    const { avatar, accion, avisar } = preparar([extra]);
    const mando = crearMando();
    const interes = vi.fn();
    ejecutarAccionAvatar(mando, avatar.current, accion.current, interes);
    expect(accion.current?.tipo).toBe(z < 1 ? 'hablar' : 'sentarse');
    expect(avisar).toHaveBeenLastCalledWith(accion.current);
    expect(hablar).toHaveBeenCalledTimes(z < 1 ? 1 : 0);
    expect(mando.sentar).toEqual(z < 1 ? null : asiento);
    expect(interes).not.toHaveBeenCalled();
  });

  it('sin extras conserva las acciones y el aviso anteriores', () => {
    const { escenario, accion, avisar } = preparar();
    expect(accionesDe(escenario)).toContain(asiento);
    expect(accion.current).toBe(asiento);
    expect(ETIQUETA_ACCION[accion.current!.tipo]).toBe('sentarse');
    cuadro(null, 1);
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it('ignora hablar fuera del radio o en otra planta y retira extras eliminados', () => {
    const extras: AccionHablar[] = [
      {
        id: 'hablar:a',
        agenteId: 'a',
        tipo: 'hablar',
        nombre: 'A',
        x: 0,
        y: 0,
        z: 4,
        radio: 3.2,
        alEjecutar: vi.fn(),
      },
    ];
    const { accion } = preparar(extras);
    expect(accion.current).toBe(asiento);
    extras[0]!.z = 0.5;
    extras[0]!.y = 4;
    cuadro(null, 1);
    expect(accion.current).toBe(asiento);
    extras[0]!.y = 0;
    cuadro(null, 1);
    expect(accion.current).toBe(extras[0]);
    extras.length = 0;
    cuadro(null, 1);
    expect(accion.current).toBe(asiento);
  });

  it('sentado se levanta sin ejecutar hablar; sin acción no ejecuta nada', () => {
    const { avatar } = preparar();
    const mando = crearMando();
    const hablar = vi.fn();
    avatar.current.estado = 'sentado';
    ejecutarAccionAvatar(mando, avatar.current, {
      id: 'a',
      agenteId: 'a',
      tipo: 'hablar',
      nombre: 'A',
      x: 0,
      z: 0,
      radio: 3.2,
      alEjecutar: hablar,
    });
    expect(mando.idSentar).toBe(1);
    expect(mando.sentar).toBeNull();
    expect(hablar).not.toHaveBeenCalled();
    avatar.current.estado = 'de-pie';
    ejecutarAccionAvatar(mando, avatar.current, null);
    expect(mando.idSentar).toBe(1);
    expect(hablar).not.toHaveBeenCalled();
  });
});
