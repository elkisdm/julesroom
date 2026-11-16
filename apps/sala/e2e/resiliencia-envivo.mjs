import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { lanzar } from './lib.mjs';
const salida = `${process.env.HOME}/Desktop/oficina-producto/sala-en-vivo`;
mkdirSync(salida, { recursive: true });
const browser = await lanzar({
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const errores = [];
const resultados = {};
try {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await contexto.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await p.route('**/vivo/salud', (route) => route.fulfill({ status: 204 }));
  await p.goto('http://localhost:5352/crear.html');
  await p.getByRole('button', { name: /Crear mi sala/ }).click({ timeout: 60000 });
  await p.keyboard.press('Enter');
  await p.locator('#fl-nombre').fill('Ada');
  await p.keyboard.press('Enter');
  await p.getByRole('button', { name: /Este soy yo/ }).click();
  await p.keyboard.press('Enter');
  await p.getByRole('button', { name: /Entrar a la sala/ }).click();
  await p.waitForTimeout(2000);
  assert.equal(await p.evaluate(() => window.__vivo.fuente), null);
  assert(await p.evaluate(() => window.__crear.sala()));
  resultados.individualSinServidor = true;
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await p.setViewportSize({ width, height });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${salida}/individual-${width}.png` });
  }
  await p.unroute('**/vivo/salud');
  await p.waitForFunction(
    () => window.__vivo.fuente?.instantanea().conexion === 'conectado',
    null,
    { timeout: 15000 },
  );
  resultados.recuperacion = true;
  await p.locator('.ev-presencia details').evaluate((e) => (e.open = true));
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await p.setViewportSize({ width, height });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${salida}/lista-presentes-${width}.png` });
  }
  await p.locator('.ev-presencia details').evaluate((e) => (e.open = false));
  await p.locator('#ev-texto').evaluate((e) => e.blur());
  await p.keyboard.press('b');
  await p.waitForFunction(() => window.__crear.construyendo());
  await p.keyboard.press('b');
  await p.waitForFunction(() => !window.__crear.construyendo());
  assert.equal(await p.evaluate(() => window.__vivo.fuente.instantanea().conexion), 'conectado');
  resultados.construirConservaConexion = true;
  const cdp = await contexto.newCDPSession(p);
  const { targetInfo } = await cdp.send('Target.getTargetInfo');
  await cdp.send('Browser.setPermission', {
    permission: { name: 'microphone' },
    setting: 'denied',
    origin: 'http://localhost:5352',
    browserContextId: targetInfo.browserContextId,
  });
  await p.getByRole('button', { name: 'Usar mi voz' }).click();
  await p.getByRole('button', { name: 'Permitir micrófono' }).click();
  await p.getByRole('alert').waitFor();
  assert.equal(await p.evaluate(() => window.__vivo.fuente.instantanea().microfono), false);
  resultados.permisoDenegado = true;
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await p.setViewportSize({ width, height });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${salida}/permiso-denegado-${width}.png` });
  }
  assert.deepEqual(errores, []);
  console.log(JSON.stringify({ resultados, errores }));
} catch (e) {
  resultados.fallo = e.stack;
  console.error(e);
  process.exitCode = 1;
} finally {
  writeFileSync(`${salida}/resiliencia.json`, JSON.stringify({ resultados, errores }, null, 2));
  await browser.close();
}
