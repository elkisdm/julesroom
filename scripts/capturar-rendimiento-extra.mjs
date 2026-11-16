import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(process.env.PLAYWRIGHT_DIR ?? 'apps/sala/package.json');
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5347';
const out = `${process.env.HOME}/Desktop/oficina-producto/rendimiento/capturas`;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'],
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${base}/escenarios.html`);
await page.waitForTimeout(8000);
await page.screenshot({ path: `${out}/escenarios-personas.png`, fullPage: false });
await page.goto(`${base}/crear.html`);
await page.waitForFunction(() => window.__crear?.lista(), null, { timeout: 90000 });
await page.evaluate(() => window.__crear.setPlantilla('oficina'));
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Crear mi sala' }).focus();
await page.keyboard.press('Enter');
await page.getByRole('button', { name: 'Sala siguiente' }).focus();
await page.keyboard.press('Enter');
await page.getByRole('textbox').first().fill('Oficina');
await page.keyboard.press('Enter');
await page.keyboard.press('Enter');
await page.locator('.fl-agentes-lista button').first().click();
await page.keyboard.press('Enter');
await page.getByRole('button', { name: 'Copiar', exact: true }).click();
await page.getByRole('button', { name: 'Copiado' }).waitFor();
await page.getByRole('button', { name: 'Copiado' }).focus();
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__crear.paso() === 'dentro');
await page.evaluate(() => {
  window.__crear.entrarConstruir();
  window.__crear.contenidoPantalla('tablero', 'mercado');
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/oficina-pantalla-mercado.png`, fullPage: false });
await browser.close();
console.log('escenarios-personas.png oficina-pantalla-mercado.png');
