import { describe, expect, it } from 'vitest';
import { PARAMETROS_EMISOR, crearEmisor, crearGuardiaVisibilidad } from './emisor';

const quieto = { x: 0, y: 0, z: 0, rumbo: 0, saltos: 0, sentado: false };

describe('emisor', () => {
  it('valores iniciales', () => {
    expect(PARAMETROS_EMISOR).toEqual({
      hz: 10,
      latidoHz: 1,
      umbralMovimiento: 0.01,
      umbralRumbo: 0.02,
    });
  });

  it('el primer estado se envía siempre', () => {
    expect(crearEmisor().debeEnviar(0, quieto)).toBe(true);
  });

  it('en movimiento envía a lo más a hz', () => {
    const e = crearEmisor();
    e.debeEnviar(0, quieto);
    expect(e.debeEnviar(50, { ...quieto, x: 1 })).toBe(false);
    expect(e.debeEnviar(100, { ...quieto, x: 1 })).toBe(true);
    expect(e.debeEnviar(150, { ...quieto, x: 2 })).toBe(false);
    expect(e.debeEnviar(200, { ...quieto, x: 2 })).toBe(true);
  });

  it('cambio de rumbo cuenta, con diferencia circular', () => {
    const e = crearEmisor();
    e.debeEnviar(0, { ...quieto, rumbo: 0.01 });
    expect(e.debeEnviar(100, { ...quieto, rumbo: 2 * Math.PI - 0.005 })).toBe(false);
    expect(e.debeEnviar(200, { ...quieto, rumbo: 1 })).toBe(true);
  });

  it('un cambio bajo el umbral no envía', () => {
    const e = crearEmisor();
    e.debeEnviar(0, quieto);
    expect(e.debeEnviar(100, { ...quieto, x: 0.005 })).toBe(false);
  });

  it('quieto solo envía el latido', () => {
    const e = crearEmisor();
    e.debeEnviar(0, quieto);
    expect(e.debeEnviar(100, quieto)).toBe(false);
    expect(e.debeEnviar(999, quieto)).toBe(false);
    expect(e.debeEnviar(1000, quieto)).toBe(true);
    expect(e.debeEnviar(1500, quieto)).toBe(false);
  });

  it('saltos y sentado envían de inmediato, pero respetando 1/hz', () => {
    const e = crearEmisor();
    e.debeEnviar(0, quieto);
    expect(e.debeEnviar(40, { ...quieto, saltos: 1 })).toBe(false);
    expect(e.debeEnviar(100, { ...quieto, saltos: 1 })).toBe(true);
    expect(e.debeEnviar(200, { ...quieto, saltos: 1, sentado: true })).toBe(true);
    expect(e.debeEnviar(300, { ...quieto, saltos: 1, sentado: true })).toBe(false);
  });

  it('reiniciar vuelve a enviar el siguiente estado', () => {
    const e = crearEmisor();
    e.debeEnviar(0, quieto);
    e.reiniciar();
    expect(e.debeEnviar(10, quieto)).toBe(true);
  });

  it('respeta parámetros propios', () => {
    const e = crearEmisor({ hz: 2 });
    e.debeEnviar(0, quieto);
    expect(e.debeEnviar(400, { ...quieto, x: 1 })).toBe(false);
    expect(e.debeEnviar(500, { ...quieto, x: 1 })).toBe(true);
  });
});

describe('guardia de visibilidad', () => {
  it('visible → enviar', () => {
    expect(crearGuardiaVisibilidad().revisar(0)).toBe('enviar');
  });

  it('oculta → pausar, y desconectar una sola vez pasado el límite', () => {
    const g = crearGuardiaVisibilidad({ desconexionMs: 1000 });
    g.cambiarVisibilidad(false, 0);
    expect(g.revisar(500)).toBe('pausar');
    expect(g.revisar(1000)).toBe('pausar');
    expect(g.revisar(1001)).toBe('desconectar');
    expect(g.revisar(2000)).toBe('pausar');
  });

  it('al volver tras desconectar → reconectar una vez y luego enviar', () => {
    const g = crearGuardiaVisibilidad({ desconexionMs: 1000 });
    g.cambiarVisibilidad(false, 0);
    g.revisar(2000);
    g.cambiarVisibilidad(true, 3000);
    expect(g.revisar(3000)).toBe('reconectar');
    expect(g.revisar(3100)).toBe('enviar');
  });

  it('volver antes del límite no reconecta', () => {
    const g = crearGuardiaVisibilidad({ desconexionMs: 1000 });
    g.cambiarVisibilidad(false, 0);
    g.cambiarVisibilidad(true, 500);
    expect(g.revisar(500)).toBe('enviar');
  });

  it('por defecto desconecta a los 5 minutos', () => {
    const g = crearGuardiaVisibilidad();
    g.cambiarVisibilidad(false, 0);
    expect(g.revisar(5 * 60_000)).toBe('pausar');
    expect(g.revisar(5 * 60_000 + 1)).toBe('desconectar');
  });
});
