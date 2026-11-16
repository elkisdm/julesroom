import { describe, it, expect } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { aplicarPaletaCatalogo } from './aplicarPaletaCatalogo';
import { ESTILOS_CATALOGO } from '../escenarios/estilosCatalogo';
describe('materiales de los estilos nuevos', () => {
  it('aplica tinta y acabado, conservando geometría y texturas del mundo', () => {
    const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });
    const mapa = m.map;
    aplicarPaletaCatalogo({ cemento: m }, ESTILOS_CATALOGO[0]!.paleta);
    expect(m.color.getHexString()).toBe('d4cec2');
    expect(m.roughness).toBe(0.85);
    expect(m.map).toBe(mapa);
  });
  it('no altera materiales de variantes anteriores ni claves no declaradas', () => {
    const m = new MeshStandardMaterial({ color: '#aabbcc', roughness: 0.2 });
    aplicarPaletaCatalogo({ cemento: m }, { hora: 10, materiales: { cemento: '#ffffff' } });
    expect(m.color.getHexString()).toBe('aabbcc');
    aplicarPaletaCatalogo({ sinClave: m }, ESTILOS_CATALOGO[0]!.paleta);
    expect(m.roughness).toBe(0.2);
  });
});
