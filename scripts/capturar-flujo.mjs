import { chromium } from '../apps/sala/node_modules/playwright/index.mjs';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const destino = `${process.env.HOME}/Desktop/oficina-producto/flujo/capturas`;
await mkdir(destino, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'],
});
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 640],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      permissions: ['clipboard-read', 'clipboard-write'],
      reducedMotion: process.env.REDUCIDO ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.goto('http://127.0.0.1:5334/crear.html');
    await page.waitForFunction(() => window.__crear?.lista(), null, { timeout: 65000 });
    const esperar = async (paso) => {
      await page.waitForFunction((p) => window.__crear?.paso() === p, paso);
      await page.waitForTimeout(1400);
    };
    const foto = async (paso) => {
      await page.screenshot({
        path: `${destino}/${paso}-${width}x${height}${process.env.REDUCIDO ? '-reducido' : ''}.png`,
      });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${paso}: desborde`,
      );
    };
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.__crear.paso()), 'llegada');
    await foto('llegada');
    await page.getByRole('button', { name: 'Crear mi sala' }).focus();
    await page.keyboard.press('Enter');
    await esperar('sala');
    await foto('sala');
    await page.getByRole('button', { name: 'Sala siguiente' }).focus();
    await page.keyboard.press('Enter');
    await esperar('nombre');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.__crear.paso()), 'nombre');
    await page.locator('#fl-nombre').fill('a'.repeat(40));
    assert.equal((await page.locator('#fl-nombre').inputValue()).length, 24);
    await page.locator('#fl-nombre').fill('  Jules  ');
    await page.locator('#fl-nombre').blur();
    await foto('nombre');
    await page.getByRole('button', { name: 'Volver al paso anterior' }).focus();
    await page.keyboard.press('Enter');
    await esperar('personaje');
    assert.equal(
      await page.evaluate(() => window.__crear.sala().ocupantes.find((o) => o.id === 'yo').nombre),
      'Jules',
    );
    await page.getByRole('button', { name: 'Sorpréndeme' }).focus();
    const look = await page.evaluate(() =>
      JSON.stringify(window.__crear.sala().ocupantes.find((o) => o.id === 'yo').atuendo),
    );
    await foto('personaje');
    await page.keyboard.press('Enter');
    await esperar('agentes');
    assert.equal(
      await page.evaluate(() =>
        JSON.stringify(window.__crear.sala().ocupantes.find((o) => o.id === 'yo').atuendo),
      ),
      look,
      'Enter sorteó el atuendo',
    );
    await foto('agentes');
    if (width < 500) await page.getByRole('button', { name: 'Ver equipo' }).click();
    await page.getByRole('button', { name: 'Ninguno', exact: true }).click();
    await page.getByRole('button', { name: 'Todos', exact: true }).click();
    await page.locator('.fl-agentes-lista button').first().focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(
      await page
        .locator('.fl-agentes-lista button')
        .nth(1)
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.fl-agentes-lista [aria-pressed="true"]').count(), 2);
    await foto('agentes-seleccion');
    await page.getByRole('button', { name: 'Ninguno', exact: true }).click();
    await page.getByRole('button', { name: 'Todos', exact: true }).focus();
    await page.keyboard.press('Enter');
    await esperar('invitar');
    assert.equal(
      await page.evaluate(
        () => window.__crear.sala().ocupantes.filter((o) => o.tipo === 'agente').length,
      ),
      0,
    );
    await page.keyboard.press('Escape');
    await esperar('agentes');
    if (width < 500) await page.getByRole('button', { name: 'Ver equipo' }).click();
    assert.equal(await page.locator('.fl-agentes-lista [aria-pressed="true"]').count(), 0);
    await page.locator('.fl-agentes-lista button').first().click();
    await page.keyboard.press('Enter');
    await esperar('invitar');
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await page.getByRole('button', { name: 'Copiado' }).waitFor();
    await foto('invitar');
    await page.getByRole('button', { name: 'Copiado' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__crear.paso() === 'dentro');
    await page.waitForTimeout(180);
    await foto('entrada');
    await esperar('dentro');
    assert.deepEqual(
      await page.evaluate(() =>
        window.__crear
          .sala()
          .ocupantes.filter((o) => o.tipo === 'agente')
          .map((o) => o.nombre),
      ),
      ['Nova'],
    );
    await foto('dentro');
    assert.deepEqual(errores, []);
    console.log(
      `${width}×${height}: flujo, nombre, Enter con botón enfocado, Esc, selección y copiar verificados; sin errores JS.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
