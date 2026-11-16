import { describe, it, expect } from 'vitest';
import { Texture } from 'three';
import { acabadoPisoCatalogo } from './acabadoPisoCatalogo';
import { ESTILOS_CATALOGO } from '../escenarios/estilosCatalogo';
describe('piso del estilo completo', () => {
  it('el estilo sustituye el tinte horneado del piso sin agregar texturas', () => {
    const mapa = new Texture();
    const r = acabadoPisoCatalogo(ESTILOS_CATALOGO[0]!.paleta, mapa, '#ffffff', 0.42);
    expect(r.color).toBe('#d4cec2');
    expect(r.map).toBeNull();
    expect(r.roughness).toBe(0.85);
  });
  it('sin estilo de catálogo conserva el material del mundo exactamente', () => {
    const mapa = new Texture();
    expect(acabadoPisoCatalogo({ hora: 10 }, mapa, '#123456', 0.42)).toEqual({
      map: mapa,
      color: '#123456',
      roughness: 0.42,
    });
  });
});
