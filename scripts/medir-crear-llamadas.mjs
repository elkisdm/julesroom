/**
 * Mide `renderer.info.render.calls` en crear.html con 60 objetos (trading, construir cerrado).
 * PLAYWRIGHT_DIR=apps/sala node scripts/medir-crear-llamadas.mjs --base http://127.0.0.1:5347
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(join(process.env.PLAYWRIGHT_DIR ?? 'apps/sala', 'x.js'));
const { chromium } = require('playwright');

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const base = arg('base', 'http://127.0.0.1:5347');
const captura = arg('captura', null);

const TIPOS = [
  'puff',
  'sillon',
  'banco',
  'mesa-redonda',
  'escritorio',
  'pizarra',
  'lampara-pie',
  'estante',
  'sofa-tres',
  'maceta-baja',
];

async function irDentro(page) {
  await page.goto(`${base}/crear.html`);
  await page.waitForFunction(() => window.__crear?.lista(), null, { timeout: 90000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__crear.paso() === 'llegada');
  await page.getByRole('button', { name: 'Crear mi sala' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__crear.paso() === 'sala');
  await page.getByRole('button', { name: 'Sala siguiente' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__crear.paso() === 'nombre');
  await page.getByRole('textbox').first().fill('Medición');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__crear.paso() === 'personaje');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__crear.paso() === 'agentes');
  await page.locator('.fl-agentes-lista button').first().click();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__crear.paso() === 'invitar');
  await page.getByRole('button', { name: 'Copiar', exact: true }).click();
  await page.getByRole('button', { name: 'Copiado' }).waitFor();
  await page.getByRole('button', { name: 'Copiado' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__crear.paso() === 'dentro');
  await page.waitForTimeout(2000);
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
try {
  await irDentro(page);
  const objetos = await page.evaluate((tipos) => {
    const out = [];
    for (let i = 0; i < 60; i++) {
      out.push({
        id: `obj-${i}`,
        tipo: tipos[i % tipos.length],
        x: (i % 10) * 0.8 - 3.6,
        z: Math.floor(i / 10) * 0.8 - 2.4,
        giro: i % 4,
      });
    }
    window.__crear.colocarObjetos(out);
    return out.length;
  }, TIPOS);
  await page.waitForTimeout(4000);
  const llamadas = await page.evaluate(() => window.__crear.drawCalls());
  console.log(
    JSON.stringify({
      objetos,
      llamadas,
      construyendo: await page.evaluate(() => window.__crear.construyendo()),
    }),
  );
  if (captura) {
    mkdirSync(join(captura, '..'), { recursive: true });
    await page.screenshot({ path: captura });
  }
} finally {
  await browser.close();
}
