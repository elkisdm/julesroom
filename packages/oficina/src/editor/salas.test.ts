import { describe, expect, it } from 'vitest';
import { ejemploEquipo } from '../definicion/definicion';
import { migrarDefinicion, serializarSala } from './formato';
import {
  CLAVE_SALA,
  cargarSala,
  eliminarSala,
  guardarSala,
  listarSalas,
  renombrarSala,
  type Almacen,
} from './guardado';
import '../index';
function memoria(): Almacen {
  const datos = new Map<string, string>();
  return {
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
  };
}
const sala = migrarDefinicion({ ...ejemploEquipo, plano: { plantilla: 'trading' } });
describe('biblioteca de salas', () => {
  it('conserva A al crear B, ordena por uso y recupera cada documento', () => {
    const a = memoria();
    expect(guardarSala(a, { ...sala, nombre: 'A' }, { id: 'a', ahora: 100 }).ok).toBe(true);
    expect(guardarSala(a, { ...sala, nombre: 'B' }, { id: 'b', ahora: 200 }).ok).toBe(true);
    expect(listarSalas(a).salas.map((s) => s.nombre)).toEqual(['B', 'A']);
    expect(cargarSala(a, 'a').sala?.nombre).toBe('A');
    expect(cargarSala(a).sala?.nombre).toBe('B');
  });
  it('migra automáticamente la sala única sin borrar el respaldo ni duplicarla', () => {
    const a = memoria();
    const texto = serializarSala(sala);
    a.setItem(CLAVE_SALA, texto);
    expect(listarSalas(a).salas).toHaveLength(1);
    expect(cargarSala(a).sala).toEqual(sala);
    expect(listarSalas(a).salas).toHaveLength(1);
    expect(a.getItem(CLAVE_SALA)).toBe(texto);
  });
  it('renombra sin cambiar el último uso, elimina B y A persiste tras releer', () => {
    const a = memoria();
    guardarSala(a, sala, { id: 'a', ahora: 100 });
    guardarSala(a, sala, { id: 'b', ahora: 200 });
    expect(renombrarSala(a, 'b', '  Sala B  ').ok).toBe(true);
    expect(listarSalas(a).salas[0]).toMatchObject({ nombre: 'Sala B', ultimoUso: 200 });
    expect(eliminarSala(a, 'b').ok).toBe(true);
    expect(listarSalas(a).salas.map((s) => s.id)).toEqual(['a']);
    expect(cargarSala(a, 'b').sala).toBeNull();
  });
  it('no resucita la sala antigua después de eliminar la última migrada', () => {
    const a = memoria();
    a.setItem(CLAVE_SALA, serializarSala(sala));
    const id = listarSalas(a).salas[0]!.id;
    eliminarSala(a, id);
    expect(listarSalas(a).salas).toEqual([]);
    expect(cargarSala(a).sala).toBeNull();
  });
  it('limita nuevas salas, permite editar existentes y rechaza nombres vacíos', () => {
    const a = memoria();
    guardarSala(a, sala, { id: 'a', maxSalas: 1 });
    expect(guardarSala(a, sala, { id: 'b', maxSalas: 1 }).ok).toBe(false);
    expect(guardarSala(a, sala, { id: 'a', maxSalas: 1 }).ok).toBe(true);
    expect(renombrarSala(a, 'a', '   ').ok).toBe(false);
    expect(renombrarSala(a, 'ausente', 'Nueva').ok).toBe(false);
  });
  it('una cuota llena al escribir el índice no pierde la sala anterior ni publica la nueva', () => {
    const a = memoria();
    guardarSala(a, sala, { id: 'a' });
    const set = a.setItem;
    a.setItem = (k, v) => {
      if (k.endsWith('/indice')) throw new Error('QuotaExceededError');
      set(k, v);
    };
    expect(guardarSala(a, { ...sala, nombre: 'B' }, { id: 'b' }).ok).toBe(false);
    expect(listarSalas(a).salas.map((s) => s.id)).toEqual(['a']);
    expect(cargarSala(a, 'a').sala).toEqual(sala);
  });
  it('si no puede migrar conserva el documento antiguo y avisa', () => {
    const a = memoria();
    a.setItem(CLAVE_SALA, serializarSala(sala));
    a.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(cargarSala(a).sala).toEqual(sala);
    expect(listarSalas(a).errores.length).toBeGreaterThan(0);
  });
  it('un índice corrupto o inaccesible se informa y no se sobrescribe', () => {
    const a = memoria();
    a.setItem('jules-room/salas/indice', '{}');
    expect(listarSalas(a).errores.length).toBeGreaterThan(0);
    expect(guardarSala(a, sala).ok).toBe(false);
    a.getItem = () => {
      throw new Error('Bloqueado');
    };
    expect(listarSalas(a).errores.length).toBeGreaterThan(0);
  });
  it('un fallo al borrar el documento restaura el índice', () => {
    const a = memoria();
    guardarSala(a, sala, { id: 'a' });
    a.removeItem = () => {
      throw new Error('Bloqueado');
    };
    expect(eliminarSala(a, 'a').ok).toBe(false);
    expect(listarSalas(a).salas.map((s) => s.id)).toEqual(['a']);
  });
  it('las identidades no colisionan con el índice y rechaza identidad vacía', () => {
    const a = memoria();
    expect(guardarSala(a, sala, { id: 'indice' }).ok).toBe(true);
    expect(cargarSala(a, 'indice').sala).toEqual(sala);
    expect(guardarSala(a, sala, { id: '' }).ok).toBe(false);
  });
  it('conserva la miniatura del mundo al editar y releer la biblioteca', () => {
    const a = memoria();
    guardarSala(a, sala, { id: 'a', miniatura: 'data:image/jpeg;base64,imagen' });
    guardarSala(a, { ...sala, nombre: 'Otro nombre' }, { id: 'a' });
    expect(listarSalas(a).salas[0]?.miniatura).toBe('data:image/jpeg;base64,imagen');
  });
  it('con cuota llena mantiene visible y accesible la sala única antes de migrar', () => {
    const a = memoria();
    a.setItem(CLAVE_SALA, serializarSala(sala));
    a.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const lista = listarSalas(a);
    expect(lista.salas[0]?.nombre).toBe(sala.nombre);
    expect(cargarSala(a, lista.salas[0]!.id).sala).toEqual(sala);
    expect(lista.errores.length).toBeGreaterThan(0);
  });
});
