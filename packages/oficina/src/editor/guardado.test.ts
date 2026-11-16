import { describe, expect, it } from 'vitest';
import { ejemploEquipo } from '../definicion/definicion';
import { migrarDefinicion } from './formato';
import { CLAVE_SALA, cargarSala, guardarSala, listarSalas, type Almacen } from './guardado';
import '../index';

function memoria(): Almacen & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
  };
}
const definicion = { ...ejemploEquipo, plano: { plantilla: 'trading' } };

describe('guardado', () => {
  it('guarda y vuelve a cargar la misma sala', () => {
    const a = memoria();
    const sala = migrarDefinicion(definicion);
    expect(guardarSala(a, sala)).toEqual({ ok: true });
    expect(listarSalas(a).salas).toHaveLength(1);
    expect(cargarSala(a)).toEqual({ sala, errores: [] });
  });

  it('si el almacén falla (cuota), no lanza y avisa', () => {
    const a = memoria();
    a.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(guardarSala(a, migrarDefinicion(definicion))).toEqual({
      ok: false,
      error: 'No se pudo guardar en este navegador',
    });
  });

  it('sin nada guardado: sala null y sin errores', () => {
    expect(cargarSala(memoria())).toEqual({ sala: null, errores: [] });
  });

  it('un guardado corrupto devuelve null con errores, sin lanzar', () => {
    const a = memoria();
    a.setItem(CLAVE_SALA, '{no es json');
    const r = cargarSala(a);
    expect(r.sala).toBeNull();
    expect(r.errores.length).toBeGreaterThan(0);
  });
});
