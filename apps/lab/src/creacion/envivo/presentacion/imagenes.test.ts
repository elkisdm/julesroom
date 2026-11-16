import { describe, expect, it } from 'vitest';
import { dimensionesReducidas, validarArchivos } from './imagenes';
describe('preparación de imágenes', () => {
  it('reduce 1920×1080 a 1600×900 y conserva proporciones verticales', () => {
    expect(dimensionesReducidas(1920, 1080)).toEqual({ ancho: 1600, alto: 900 });
    expect(dimensionesReducidas(800, 2400)).toEqual({ ancho: 533, alto: 1600 });
    expect(dimensionesReducidas(800, 600)).toEqual({ ancho: 800, alto: 600 });
  });
  it('rechaza formatos, archivos desmesurados y más de 40 láminas antes de decodificar', () => {
    expect(() => validarArchivos([{ type: 'image/gif', size: 100 }], 0)).toThrow();
    expect(() => validarArchivos([{ type: 'image/png', size: 100 }], 40)).toThrow();
    expect(() => validarArchivos([{ type: 'image/png', size: 50e6 }], 0)).toThrow();
    expect(() => validarArchivos([{ type: 'image/webp', size: 100 }], 0)).not.toThrow();
  });
});
