import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(resolve('apps/sala/node_modules/playwright/index.mjs')).href
);
const salida =
  process.env.D8_CAPTURAS ??
  resolve(process.env.HOME ?? '.', 'Desktop/oficina-producto/demo-noche/d8');
const codigo = process.env.D8_CODIGO;
if (!codigo) throw new Error('Define D8_CODIGO con el código de tu puente simulado.');
mkdirSync(salida, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: salida + '/video', size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const errores = [],
  resultados = [];
page.on('pageerror', (e) => errores.push(e.message));
try {
  await page.goto('http://127.0.0.1:5381/crear.html');
  await page.waitForLoadState('networkidle');
  const sala = page.getByRole('button', { name: /Abrir sala/ });
  if (await sala.count()) await sala.first().click();
  else {
    await page.getByRole('button', { name: /Crear mi sala/ }).click();
    await page.keyboard.press('Enter');
    await page.locator('#fl-nombre').fill('Anfitrión');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /Este soy yo/ }).click();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /Entrar a la sala/ }).click();
  }
  await page.getByRole('button', { name: 'Pizarra', exact: true }).click();
  await page.getByRole('button', { name: 'Poner pizarra aquí' }).click();
  await page.getByText('Pizarra colocada.', { exact: false }).waitFor();
  await page.evaluate(() => window.__crear.ir(0, 6.8, true));
  await page.waitForFunction(() => Math.abs(window.__crear.avatar.x) < 0.5, null, {
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Mirar en el mundo', exact: true }).click();
  await page.getByRole('button', { name: 'Pizarra', exact: true }).click();
  await page.getByLabel('Código que muestra la terminal').fill(codigo);
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await page.getByText('Modo simulado · ejemplos de demostración', { exact: true }).waitFor();
  const tipos = ['idea', 'pasos', 'mapa', 'comparacion', 'linea-tiempo', 'barras', 'capas'];
  for (const tipo of tipos) {
    await page
      .getByLabel('¿Qué quieres explicar?')
      .fill(`Muestra ${tipo} sobre una biblioteca compartida`);
    const inicio = Date.now();
    await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
    await page.getByText(/Ejemplo simulado ·/).waitFor();
    await page.waitForTimeout(2300);
    const datos = await page.evaluate(async () => {
      const m = await import('/src/creacion/envivo/pizarra/dibujo.ts');
      return m.laminaActual().toDataURL('image/png');
    });
    writeFileSync(`${salida}/${tipo}-1920.png`, Buffer.from(datos.split(',')[1], 'base64'));
    resultados.push({ tipo, latenciaVisibleMs: Date.now() - inicio - 2300 });
    await page.getByRole('button', { name: 'Ver grande', exact: true }).click();
    await page.screenshot({ path: `${salida}/${tipo}-grande-1440.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(650);
    await page.screenshot({ path: `${salida}/${tipo}-grande-390.png` });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.getByRole('button', { name: 'Volver al mundo · Esc', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar panel de pizarra' }).click();
    await page.screenshot({ path: `${salida}/${tipo}-mundo-390.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${salida}/${tipo}-mundo-1440.png` });
    await page.getByRole('button', { name: 'Pizarra', exact: true }).click();
    console.log('TIPO', tipo);
  }
  // Volver a mapa, ampliar y comprobar que crea una versión nueva.
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Pizarra anterior' }).click();
  await page.getByRole('button', { name: /Ampliar/ }).click();
  await page.getByLabel('¿Qué quieres explicar?').fill('Amplía el mapa con aprendizaje compartido');
  await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
  await page.getByText(/Ejemplo simulado ·/).waitFor();
  await page.waitForTimeout(2300);
  await page.getByRole('button', { name: 'Ver grande', exact: true }).click();
  await page.screenshot({ path: `${salida}/ampliada.png` });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Pizarra anterior' }).click();
  await page.getByRole('button', { name: 'Pizarra siguiente' }).click();
  await page.getByLabel('¿Qué quieres explicar?').fill('borra la pizarra');
  await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${salida}/borrada.png` });
  await page.getByRole('button', { name: 'Pizarra anterior' }).click();
  await page.waitForTimeout(2300);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${salida}/panel-390.png` });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${salida}/panel-320.png` });
  assert.deepEqual(errores, []);
  console.log('RESULTADO', JSON.stringify({ resultados, errores }));
  writeFileSync(`${salida}/resultados.json`, JSON.stringify({ resultados, errores }, null, 2));
} catch (e) {
  await page.screenshot({ path: salida + '/error.png' });
  console.error(e);
  console.log('BODY', await page.locator('body').innerText());
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
