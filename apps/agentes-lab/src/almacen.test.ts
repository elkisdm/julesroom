import { describe, expect, it } from 'vitest';
import { crearAlmacen } from './almacen';

describe('crearAlmacen', () => {
  it('aplica el reducer y avisa a los suscritos solo cuando algo cambia', () => {
    const a = crearAlmacen();
    let avisos = 0;
    const baja = a.suscribir(() => avisos++);
    a.despachar({ tipo: 'abrir', agenteId: 'x', via: 'cerca', idNuevo: 'id' });
    expect(a.leer().fase).toBe('abierta');
    expect(avisos).toBe(1);
    a.despachar({ tipo: 'escribir', texto: '' });
    expect(avisos).toBe(1);
    baja();
    a.despachar({ tipo: 'cerrar' });
    expect(avisos).toBe(1);
    expect(a.leer().fase).toBe('cerrada');
  });
});
