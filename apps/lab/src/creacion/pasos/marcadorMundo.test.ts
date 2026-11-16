import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { escenarioPorId } from '@oficina/motor';
import { expect, it } from 'vitest';
import { ElegirMundo } from './ElegirMundo';
const base = {
  plantilla: 'oficina',
  preparada: false,
  miniaturas: {},
  fallos: 0,
  cuadroVisible: 'trading:noche',
  alElegir: () => {},
  alVariante: () => {},
  alConfirmar: () => {},
  alVolver: () => {},
};
it('muestra de inmediato la miniatura del mundo elegido mientras no llega su cuadro', () => {
  const html = renderToStaticMarkup(createElement(ElegirMundo, base));
  expect(html).toContain('data-mundo-pendiente="oficina"');
  expect(html).toContain('/mundos/oficina.jpg');
  expect(html).toContain('aria-pressed="true"');
  expect(html).not.toContain('disabled');
});
it('funde solo al recibir el cuadro del mundo y variante elegidos', () => {
  const variante = escenarioPorId('oficina').variantes[0]!.id;
  const html = renderToStaticMarkup(
    createElement(ElegirMundo, { ...base, cuadroVisible: `oficina:${variante}` }),
  );
  expect(html).toContain('cr-mundos-marcador--listo');
  expect(html).not.toContain('data-mundo-pendiente="oficina"');
});

it('una sala ya caliente se presenta directamente sin taparla con otra transición', () => {
  const html = renderToStaticMarkup(createElement(ElegirMundo, { ...base, preparada: true }));
  expect(html).toContain('cr-mundos-marcador--listo');
  expect(html).not.toContain('data-mundo-pendiente="oficina"');
});
