import { describe, expect, it } from 'vitest';
import type { AgenteOficina } from '@oficina/motor';
import { aplicarVida, hablaEn, vidaDeFase } from './vidaAgente';

const agente = (id: string, extra: Partial<AgenteOficina> = {}): AgenteOficina => ({
  id,
  nombre: id,
  rol: 'x',
  departamento: 'equipo-1',
  estado: 'trabajando',
  ...extra,
});

describe('vidaDeFase', () => {
  it('abierta y error: se levanta y espera tu mensaje', () => {
    expect(vidaDeFase('abierta')).toEqual({ estado: 'esperando_decision' });
    expect(vidaDeFase('error')).toEqual({ estado: 'esperando_decision' });
  });
  it('pensando y respondiendo', () => {
    expect(vidaDeFase('pensando')).toEqual({ estado: 'trabajando', actividad: 'pensando' });
    expect(vidaDeFase('respondiendo')).toEqual({ estado: 'trabajando', actividad: 'hablando' });
  });
  it('cerrada no cambia nada', () => expect(vidaDeFase('cerrada')).toBeNull());
  it('solo respondiendo marca «hablando»', () => {
    expect(hablaEn('respondiendo')).toBe(true);
    expect(hablaEn('pensando')).toBe(false);
  });
});

describe('aplicarVida', () => {
  it('cambia solo al agente afectado y conserva la identidad de los demás', () => {
    const base = [agente('a'), agente('b'), agente('c')];
    const r = aplicarVida(base, { b: { estado: 'trabajando', actividad: 'pensando' } });
    expect(r[0]).toBe(base[0]);
    expect(r[2]).toBe(base[2]);
    expect(r[1]).toMatchObject({ id: 'b', estado: 'trabajando', actividad: 'pensando' });
    expect(base[1]?.actividad).toBeUndefined();
  });

  it('quita la actividad previa cuando la vida no trae una', () => {
    const r = aplicarVida([agente('a', { actividad: 'leyendo' })], {
      a: { estado: 'esperando_decision' },
    });
    expect(r[0]?.actividad).toBeUndefined();
    expect(r[0]?.estado).toBe('esperando_decision');
  });
});
