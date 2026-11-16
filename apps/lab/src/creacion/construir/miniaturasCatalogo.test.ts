import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { CATALOGO_OBJETOS } from '@oficina/motor';
import { Miniatura } from './Miniatura';
describe('miniaturas del catálogo', () => {
  it('todos los objetos producen una miniatura de sus partes', () => {
    for (const t of CATALOGO_OBJETOS) {
      const svg = renderToStaticMarkup(createElement(Miniatura, { tipo: t.tipo }));
      expect(svg, t.tipo).toContain('<svg');
      expect(svg, t.tipo).toMatch(/<rect|<ellipse/);
    }
  });
  it('la miniatura conserva la transparencia del vidrio', () => {
    expect(renderToStaticMarkup(createElement(Miniatura, { tipo: 'muro-vidrio' }))).toContain(
      'opacity="0.22"',
    );
  });
  it('reutiliza el dibujo y un id desconocido no produce miniatura inventada', () => {
    expect(Miniatura({ tipo: 'arcade' })).toBe(Miniatura({ tipo: 'arcade' }));
    expect(Miniatura({ tipo: 'nada' })).toBeNull();
  });
});
