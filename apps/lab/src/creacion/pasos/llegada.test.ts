import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Llegada } from './Llegada';
const base = {
  lista: true,
  precarga: { porcentaje: 100, fallos: 0 },
  miniaturas: {},
  error: '',
  alCrear: () => {},
  alAbrir: () => {},
  alRenombrar: () => true,
  alEliminar: () => true,
};
it('sin guardados deja una sola acción de creación', () => {
  const html = renderToStaticMarkup(createElement(Llegada, { ...base, salas: [] }));
  expect(html).toContain('Crear mi sala');
  expect(html).not.toContain('Mis salas');
  expect(html).not.toContain('Crear una sala nueva');
});
it('con guardados nombra la última sala y ofrece las dos acciones secundarias', () => {
  const html = renderToStaticMarkup(
    createElement(Llegada, {
      ...base,
      salas: [{ id: 'a', nombre: 'Estudio', plantilla: 'trading', ultimoUso: 1 }],
    }),
  );
  expect(html).toContain('Entrar a Estudio');
  expect(html).toContain('Mis salas');
  expect(html).toContain('Crear una sala nueva');
});
it('durante la preparación deshabilita la principal y comunica el estado', () => {
  const html = renderToStaticMarkup(createElement(Llegada, { ...base, lista: false, salas: [] }));
  expect(html).toContain('disabled');
  expect(html).toContain('Preparando tu lugar');
});
it('un fallo parcial permite seguir con explicación y muestra errores de persistencia', () => {
  const html = renderToStaticMarkup(
    createElement(Llegada, { ...base, precarga: { porcentaje: 100, fallos: 1 }, salas: [] }),
  );
  expect(html).not.toContain('disabled');
  expect(html).toContain('Reintentaremos');
  const cuota = renderToStaticMarkup(
    createElement(Llegada, { ...base, error: 'Cuota llena', salas: [] }),
  );
  expect(cuota).toContain('Cuota llena');
});
