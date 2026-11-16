import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { escenarioMansion } from '../../escenarios/mansion';
import { crearEscenarioPrueba } from '../../escenarios/prueba';
import { ContextoEscenario, useEscenario } from './contexto';

const Nombre = () => createElement('span', null, useEscenario().id);

describe('useEscenario', () => {
  it('por defecto es la mansión', () => {
    expect(renderToStaticMarkup(createElement(Nombre))).toBe(`<span>${escenarioMansion.id}</span>`);
  });

  it('entrega el escenario del proveedor', () => {
    const html = renderToStaticMarkup(
      createElement(
        ContextoEscenario.Provider,
        { value: crearEscenarioPrueba('otro') },
        createElement(Nombre),
      ),
    );
    expect(html).toBe('<span>otro</span>');
  });
});
