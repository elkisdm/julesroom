import { describe, expect, it } from 'vitest';
import { conHabla, conMuestra, misionActual, misionesIniciales, todasHechas } from './misiones';
import type { MuestraAvatar } from './misiones';

const quieto = (x = 0, z = 0, y = 0, saltos = 0): MuestraAvatar => ({
  x,
  y,
  z,
  velocidad: 0,
  estado: 'de-pie',
  saltos,
});

function caminar(e = misionesIniciales(), metros = 3) {
  let s = conMuestra(e, quieto());
  for (let i = 1; i <= metros * 10; i++) s = conMuestra(s, { ...quieto(i / 10), velocidad: 2.3 });
  return s;
}

describe('misiones del primer minuto', () => {
  it('empieza por caminar y no la da por hecha estando quieto', () => {
    let s = misionesIniciales();
    for (let i = 0; i < 50; i++) s = conMuestra(s, quieto());
    expect(misionActual(s)?.id).toBe('caminar');
  });

  it('caminar se cumple al recorrer la distancia y pasa a correr', () => {
    const s = caminar();
    expect(s.hechas).toEqual(['caminar']);
    expect(misionActual(s)?.id).toBe('correr');
  });

  it('un teletransporte (salto de más de 2 m entre muestras) no suma recorrido', () => {
    let s = conMuestra(misionesIniciales(), quieto());
    s = conMuestra(s, quieto(50));
    expect(s.recorrido).toBe(0);
  });

  it('correr antes de caminar no cuenta: las misiones van en orden', () => {
    const s = conMuestra(misionesIniciales(), { ...quieto(), velocidad: 4.8 });
    expect(s.hechas).toEqual([]);
  });

  it('correr, saltar y sentarse se cumplen en orden', () => {
    let s = caminar();
    s = conMuestra(s, { ...quieto(3), velocidad: 4.8 });
    expect(misionActual(s)?.id).toBe('saltar');
    s = conMuestra(s, quieto(3, 0, 0, 1));
    expect(misionActual(s)?.id).toBe('sentarse');
    s = conMuestra(s, { ...quieto(3, 0, 0.45, 1), estado: 'sentado' });
    expect(misionActual(s)?.id).toBe('hablar');
  });

  it('el salto se cuenta por el mando (el motor no informa el arco), no por la altura del piso', () => {
    let s = caminar();
    s = conMuestra(s, { ...quieto(3), velocidad: 4.8 });
    s = conMuestra(s, { ...quieto(3, 0, 0.9), estado: 'sentado' });
    expect(misionActual(s)?.id).toBe('saltar');
    s = conMuestra(s, quieto(3, 0, 0, 1));
    expect(misionActual(s)?.id).toBe('sentarse');
  });

  it('los saltos hechos antes de la misión no la cumplen', () => {
    let s = conMuestra(misionesIniciales(), quieto(0, 0, 0, 4));
    for (let i = 1; i <= 30; i++) s = conMuestra(s, { ...quieto(i / 10, 0, 0, 4), velocidad: 2.3 });
    s = conMuestra(s, { ...quieto(3, 0, 0, 4), velocidad: 4.8 });
    expect(misionActual(s)?.id).toBe('saltar');
  });

  it('hablarle a un agente cuenta en cualquier momento y cierra la lista al final', () => {
    let s = conHabla(misionesIniciales());
    expect(s.hechas).toEqual(['hablar']);
    s = caminar(s);
    s = conMuestra(s, { ...quieto(3), velocidad: 4.8 });
    s = conMuestra(s, quieto(3, 0, 0, 1));
    s = conMuestra(s, { ...quieto(3, 0, 0.45, 1), estado: 'sentado' });
    expect(todasHechas(s)).toBe(true);
  });

  it('una muestra que no cambia nada devuelve el mismo estado', () => {
    const s = conMuestra(misionesIniciales(), quieto());
    expect(conMuestra(s, quieto())).toBe(s);
  });
});
