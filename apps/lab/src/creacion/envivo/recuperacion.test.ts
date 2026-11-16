import { describe, expect, it } from 'vitest';
import { recuperarSala, guardarSala, asegurarSala, migrarSalaAnterior } from './recuperacion';
const almacen = () => {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => {
      datos.set(k, v);
    },
  };
};
describe('recuperación del anfitrión', () => {
  it('recupera la misma sala desde otra pestaña y al repetir Invitar', () => {
    const a = almacen();
    guardarSala(a, 'guardada-a', 'viva-a', 'secreto-a');
    expect(recuperarSala(a, 'guardada-a')).toBe('viva-a');
    expect(recuperarSala(a, 'guardada-a')).toBe('viva-a');
    expect(a.getItem('demo/dueno/viva-a')).toBe('secreto-a');
  });
  it('no mezcla dos guardadas ni recupera sin capacidad de dueño', () => {
    const a = almacen();
    guardarSala(a, 'a', 'viva-a', 's');
    guardarSala(a, 'b', 'viva-b', 't');
    expect(recuperarSala(a, 'a')).toBe('viva-a');
    expect(recuperarSala(a, 'b')).toBe('viva-b');
    a.setItem('demo/guardada/c', 'ajena');
    expect(recuperarSala(a, 'c')).toBeNull();
  });
});

it('Invitar repetido durante la solicitud comparte una sola creación', async () => {
  const a = almacen();
  let llamadas = 0;
  const crear = async () => {
    llamadas++;
    return { sala: 'viva', secretoDueno: 'secreto' };
  };
  expect(
    await Promise.all([asegurarSala(a, 'guardada', crear), asegurarSala(a, 'guardada', crear)]),
  ).toEqual(['viva', 'viva']);
  expect(await asegurarSala(a, 'guardada', crear)).toBe('viva');
  expect(llamadas).toBe(1);
});

it('recupera capacidad anterior sin relación y no pisa una relación existente', () => {
  const a = almacen();
  a.setItem('demo/dueno/anterior', 'secreto');
  migrarSalaAnterior(a, 'guardada', 'anterior');
  expect(recuperarSala(a, 'guardada')).toBe('anterior');
  migrarSalaAnterior(a, 'guardada', 'otra');
  expect(recuperarSala(a, 'guardada')).toBe('anterior');
  migrarSalaAnterior(a, 'sin-capacidad', 'otra');
  expect(recuperarSala(a, 'sin-capacidad')).toBeNull();
});
