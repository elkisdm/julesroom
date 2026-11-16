import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Invitar } from './Invitar';

const base = { alEntrar: () => undefined, alVolver: () => undefined };
describe('invitación pública', () => {
  it('no permite copiar un enlace mientras se crea la sala', () => {
    const html = renderToStaticMarkup(createElement(Invitar, { ...base, enlace: '' }));
    expect(html).toMatch(/disabled=""[^>]*>Copiar/);
    expect(html).toContain('Conectando la sala');
  });
  it('permite introducir la llave y ver el rechazo antes de entrar', () => {
    const html = renderToStaticMarkup(
      createElement(Invitar, {
        ...base,
        enlace: '',
        demo: { error: 'Llave de demo requerida', llave: '', alLlave: () => undefined },
      }),
    );
    expect(html).toContain('Llave de demo requerida');
    expect(html).toContain('type="password"');
    expect(html).toContain('Entrar con la llave');
  });
  it('conserva la invitación normal y el modo individual', () => {
    expect(
      renderToStaticMarkup(
        createElement(Invitar, { ...base, enlace: 'https://example.test/?sala=prueba' }),
      ),
    ).toContain('https://example.test/?sala=prueba');
    expect(renderToStaticMarkup(createElement(Invitar, { ...base, enlace: null }))).not.toContain(
      'id="fl-enlace"',
    );
  });
});

it('muestra fallos transitorios sin formulario de llave', () => {
  const html = renderToStaticMarkup(
    createElement(Invitar, {
      ...base,
      enlace: '',
      demo: {
        error: 'Hay mucha gente entrando a la vez, reintentando…',
        llave: '',
        alLlave: () => undefined,
      },
    }),
  );
  expect(html).toContain('reintentando');
  expect(html).not.toContain('type="password"');
});

it('ofrece contador, enlace y texto de invitación sin llaves', () => {
  const html = renderToStaticMarkup(
    createElement(Invitar, {
      ...base,
      enlace: 'https://example.test/?sala=prueba',
      nombreSala: 'Equipo',
      personas: 3,
    }),
  );
  expect(html).toContain('3 en la sala');
  expect(html).toContain('Copiar enlace');
  expect(html).toContain('Te invito a Equipo. Entra aquí:');
  expect(html).not.toContain('llave');
});
