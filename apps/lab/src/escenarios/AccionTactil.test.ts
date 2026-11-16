import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { AvisoAccion } from './AvisoAccion';
import { textoAviso } from './aviso';

it('ofrece la misma etiqueta accesible para E y toque, incluida la persona', () => {
  const accion = {
    id: 'hablar:a',
    tipo: 'hablar' as const,
    agenteId: 'a',
    nombre: 'Nova',
    x: 0,
    z: 1,
    radio: 2,
    alEjecutar: vi.fn(),
  };
  expect(textoAviso(accion)).toEqual({ verbo: 'hablar', objeto: 'Nova' });
  const html = renderToStaticMarkup(
    createElement(AvisoAccion, { accion, sentado: false, alAccion: vi.fn() }),
  );
  expect(html).toContain('<button');
  expect(html).toContain('Nova');
  expect(html).toContain('hablar');
});
