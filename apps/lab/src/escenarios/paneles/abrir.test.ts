import { describe, expect, it } from 'vitest';
import { cerrar, estadoInicial, fijar, hacerInteres, panelDeInteres } from './abrir';

describe('panelDeInteres', () => {
  it('traduce los ids del escenario a un panel', () => {
    expect(panelDeInteres('muro')).toEqual({ tipo: 'mercado', activo: 'btc' });
    expect(panelDeInteres('mesa:cripto')).toEqual({ tipo: 'mercado', activo: 'btc' });
    expect(panelDeInteres('mesa:forex')).toEqual({ tipo: 'mercado', activo: 'eur' });
    expect(panelDeInteres('mesa:materias')).toEqual({ tipo: 'mercado', activo: 'xau' });
    expect(panelDeInteres('aula')).toEqual({ tipo: 'aula' });
    expect(panelDeInteres('videos')).toEqual({ tipo: 'videos' });
    expect(panelDeInteres('privado')).toEqual({ tipo: 'chat', zona: 'privado' });
    expect(panelDeInteres('agente:3')).toEqual({ tipo: 'agente', puesto: 3 });
  });
  it('un id desconocido no abre nada', () => {
    expect(panelDeInteres('otra-cosa')).toBeNull();
    expect(panelDeInteres('agente:x')).toBeNull();
    expect(panelDeInteres('mesa:nada')).toBeNull();
  });
});

describe('estado del panel', () => {
  it('un interés abre y null cierra', () => {
    const a = hacerInteres(estadoInicial, 'aula');
    expect(a.panel).toEqual({ tipo: 'aula' });
    expect(hacerInteres(a, null).panel).toBeNull();
  });
  it('fijado, null no cierra; cerrar lo suelta y cierra', () => {
    const a = fijar(hacerInteres(estadoInicial, 'aula'), true);
    expect(hacerInteres(a, null).panel).toEqual({ tipo: 'aula' });
    expect(cerrar()).toEqual(estadoInicial);
  });
  it('otro interés reemplaza el panel y lo suelta; el mismo conserva el fijado', () => {
    const a = fijar(hacerInteres(estadoInicial, 'aula'), true);
    expect(hacerInteres(a, 'aula').fijado).toBe(true);
    const b = hacerInteres(a, 'videos');
    expect(b.panel).toEqual({ tipo: 'videos' });
    expect(b.fijado).toBe(false);
  });
  it('un id desconocido no cambia nada', () => {
    const a = hacerInteres(estadoInicial, 'aula');
    expect(hacerInteres(a, 'zzz')).toBe(a);
  });
  it('fijar sin panel abierto no hace nada', () => {
    expect(fijar(estadoInicial, true)).toBe(estadoInicial);
  });
});
