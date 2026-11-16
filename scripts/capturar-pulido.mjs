import { chromium } from '../apps/sala/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const destino = `${process.env.HOME}/Desktop/oficina-producto/pulido/capturas`;
await mkdir(destino, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'],
});
const resultados = [];
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 640],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 500 });
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.goto('http://127.0.0.1:5335/crear.html');
    await page.waitForFunction(() => window.__crear?.lista(), { timeout: 65000 });
    await page.getByRole('button', { name: 'Armar mi sala' }).click();
    for (const plantilla of ['trading', 'oficina', 'mansion']) {
      if (await page.locator('.pv-panel').count())
        await page.locator('.cr-riel button').nth(0).click();
      await page
        .locator('.cr-mundos-miniaturas button')
        .nth(['trading', 'oficina', 'mansion'].indexOf(plantilla))
        .click();
      await page.locator('.cr-mundos-confirmar').click();
      const nombre = page.locator('input[placeholder="Cómo te ven en la sala"]');
      if (await nombre.count()) await nombre.fill('Jules');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.pv-panel');
      await page.getByRole('tab', { name: 'Ropa', exact: true }).click();
      await page.waitForTimeout(1600);
      for (const defecto of [1, 2, 3, 4])
        await page.screenshot({
          path: `${destino}/defecto-${defecto}-despues-${plantilla}-${width}x${height}.png`,
        });
      await page.getByRole('tab', { name: 'Cara', exact: true }).click();
      await page.waitForTimeout(900);
      const giro = await page.locator('.pv-girar').boundingBox();
      await page.mouse.move(giro.x + giro.width / 2, giro.y + giro.height / 2);
      await page.mouse.down();
      await page.mouse.move(giro.x + giro.width / 2 + 90, giro.y + giro.height / 2, { steps: 10 });
      await page.screenshot({
        path: `${destino}/defecto-2-despues-busto-giro-${plantilla}-${width}x${height}.png`,
      });
      await page.mouse.up();
      const datos = await page.evaluate(() => ({
        desborde: document.documentElement.scrollWidth > innerWidth,
        opciones: [...document.querySelectorAll('.pv-opcion')].map((n) => ({
          w: n.getBoundingClientRect().width,
          h: n.getBoundingClientRect().height,
        })),
        etiqueta: document.querySelector('.pv-nombre').getBoundingClientRect().toJSON(),
        panel: document.querySelector('.pv-panel').getBoundingClientRect().toJSON(),
      }));
      if (datos.desborde || datos.opciones.some((o) => o.w < 44 || o.h < 44))
        throw new Error(`Tamaño inválido ${plantilla} ${width}: ${JSON.stringify(datos)}`);
      resultados.push({ width, height, plantilla, ...datos, errores });
      process.stdout.write(
        `Verificado ${plantilla} ${width}×${height}: ${JSON.stringify(datos.opciones[0])}\n`,
      );
    }
    await page.locator('.cr-riel button').nth(0).click();
    await page.locator('.cr-mundos-miniaturas button').nth(0).click();
    await page.locator('.cr-mundos-confirmar').click();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /Este soy yo/ }).click();
    await page.getByRole('button', { name: /Seguir/ }).click();
    await page.getByRole('button', { name: /Entrar a la sala/ }).click();
    await page.waitForTimeout(1200);
    await page.keyboard.press('b');
    await page.waitForSelector('.cr-construir');
    const barra = await page
      .locator('.cr-barra button')
      .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().toJSON()));
    if (barra.some((r) => r.x < 0 || r.right > width))
      throw new Error('Barra de construir cortada');
    const tabs = await page
      .locator('.cr-pestanas button')
      .evaluateAll((ns) =>
        ns.map((n) => ({ nombre: n.textContent, rect: n.getBoundingClientRect().toJSON() })),
      );
    if (tabs.some((t) => t.rect.x < 0 || t.rect.right > width))
      throw new Error('Pestañas cortadas');
    await page.getByRole('tab', { name: 'Agregar', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    if (
      (await page
        .getByRole('tab', { name: 'Puestos', exact: true })
        .getAttribute('aria-selected')) !== 'true'
    )
      throw new Error('Las flechas no activan Puestos');
    await page.screenshot({ path: `${destino}/defecto-8-despues-${width}x${height}.png` });
    await page.getByRole('tab', { name: 'Estilo', exact: true }).click();
    await page.locator('.cr-estilo-construir button').first().focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    if (
      (await page.locator('.cr-estilo-construir button').nth(1).getAttribute('aria-pressed')) !==
      'true'
    )
      throw new Error('Las flechas no eligen el estilo');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${destino}/defecto-9-despues-${width}x${height}.png` });
    process.stdout.write(
      `Construir ${width}: ${await page.locator('.cr-estilo-construir i').count()} colores\n`,
    );
    await page.keyboard.press('Escape');
    if (await page.locator('.cr-construir').count()) throw new Error('Escape no cierra construir');
    await page.close();
  }
  await writeFile(`${destino}/verificacion.json`, JSON.stringify(resultados, null, 2));
  if (resultados.some((r) => r.errores.length))
    throw new Error('La página registró errores; revisa verificacion.json');
} finally {
  await browser.close();
}
