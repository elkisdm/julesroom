// Fixture local; requiere Vite y el emisor configurados en los puertos D3.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire(new URL('../../../../../sala/package.json', import.meta.url))(
  'playwright',
);
const base = process.env.DEMO_URL ?? 'http://127.0.0.1:5375';
const salida =
  process.env.DEMO_CAPTURAS ?? `${process.env.HOME}/Desktop/oficina-producto/demo-noche/d3`;
mkdirSync(`${salida}/laminas`, { recursive: true });
const errores = [];
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const ruta = '/src/creacion/envivo/presentacion/prueba.html';
const contextos = [];
async function abrir(url, grabar = false) {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone'],
    ...(grabar
      ? { recordVideo: { dir: `${salida}/video`, size: { width: 1440, height: 900 } } }
      : {}),
  });
  contextos.push(c);
  const p = await c.newPage();
  p.setDefaultTimeout(30000);
  p.on('pageerror', (e) => {
    errores.push(e.message);
    console.log('PAGEERROR', e.message);
  });
  await p.goto(url);
  await p.waitForFunction(
    () => window.__vivo?.fuente?.instantanea().conexion === 'conectado',
    null,
    { timeout: 40000 },
  );
  await p.waitForFunction(() => window.__d3?.lienzo);
  return p;
}
const resultados = {};
try {
  const a = await abrir(`${base}${ruta}`, true);
  console.log('Dueño conectado');
  await a.getByRole('button', { name: 'Presentar', exact: true }).click();
  await a.getByRole('button', { name: 'Poner pantalla aquí', exact: true }).click();
  await a.waitForTimeout(250);
  await a.screenshot({ path: `${salida}/01-colocacion.png` });
  console.log('Colocación', await a.locator('.d3-panel').innerText());
  await a.waitForFunction(() => window.__d3.ver().estado.pantalla);
  const enlace = await a.evaluate(() => window.__vivo.sesion.enlace);
  const b = await abrir(enlace);
  console.log('Primer invitado conectado');
  await b.waitForFunction(() => window.__d3.ver().estado.pantalla);
  resultados.pantallaCompartida = true;
  const archivos = [];
  for (let i = 1; i <= 12; i++) {
    const png = await a.evaluate((i) => {
      const c = document.createElement('canvas');
      c.width = 1920;
      c.height = 1080;
      const x = c.getContext('2d');
      x.fillStyle = '#101722';
      x.fillRect(0, 0, 1920, 1080);
      x.fillStyle = '#e9b949';
      x.fillRect(100, 120, 100, 8);
      x.fillStyle = '#f4efe6';
      x.font = '600 100px "Bricolage Grotesque", sans-serif';
      x.fillText(`Una idea compartida · ${i}`, 100, 340);
      x.font = '400 52px Inter, sans-serif';
      x.fillText('Presentar, explicar y conversar dentro del mundo.', 100, 490);
      x.fillStyle = '#b9b2a6';
      x.fillText('12 láminas · prueba de sincronización', 100, 610);
      x.fillStyle = '#e9b949';
      x.font = '600 180px Inter, sans-serif';
      x.fillText(String(i).padStart(2, '0'), 1460, 900);
      return c.toDataURL('image/png').split(',')[1];
    }, i);
    const archivo = `${salida}/laminas/${String(i).padStart(2, '0')}.png`;
    writeFileSync(archivo, Buffer.from(png, 'base64'));
    archivos.push(archivo);
  }
  await a.locator('input[type=file]').setInputFiles(archivos);
  await a.waitForFunction(() => window.__d3.ver().estado.laminas.length === 12);
  console.log('12 imágenes reducidas e importadas');
  await b.waitForFunction(() => window.__d3.ver().imagenes.size === 12, null, { timeout: 90000 });
  resultados.imagenes = await a.evaluate(async () => {
    const datos = [];
    for (const [id, url] of window.__d3.ver().imagenes) {
      const blob = await (await fetch(url)).blob();
      const img = await createImageBitmap(blob);
      datos.push({ id, bytes: blob.size, ancho: img.width, alto: img.height });
      img.close();
    }
    return datos;
  });
  assert(resultados.imagenes.every((i) => i.bytes <= 204800 && i.ancho <= 1600 && i.alto <= 1600));
  await a.keyboard.press('ArrowRight');
  await a.keyboard.press('ArrowRight');
  await a.keyboard.press('ArrowRight');
  await a.keyboard.press('ArrowRight');
  await b.waitForFunction(() => window.__d3.ver().estado.actual === 4);
  const c = await abrir(enlace);
  await c.waitForFunction(() => window.__d3.ver().imagenes.size > 0);
  assert.equal(
    await c.evaluate(() => [...window.__d3.ver().imagenes.keys()][0]),
    await a.evaluate(() => window.__d3.ver().estado.laminas[4].id),
  );
  await c.waitForFunction(() => window.__d3.ver().imagenes.size === 12, null, { timeout: 90000 });
  console.log('Tardío recibió primero la actual y después las 12');
  resultados.tardioActualPrimero = true;
  const estado = await a.evaluate(() => window.__d3.ver().estado);
  await b.evaluate(async (estado) => {
    await window.__vivo.fuente.enviarDatos(
      JSON.stringify({ ...estado, revision: 999999, actual: 0, pantalla: null }),
    );
  }, estado);
  await a.waitForTimeout(400);
  for (const p of [a, b, c])
    assert.equal(await p.evaluate(() => window.__d3.ver().estado.actual), 4);
  resultados.suplantacionRechazada = true;
  const antes = await b.evaluate(() => window.__d3.camara());
  await b.getByRole('button', { name: 'Ver pantalla', exact: true }).click();
  await b.waitForTimeout(300);
  await b.screenshot({ path: `${salida}/02-invitado-encuadre.png` });
  const cerca = await b.evaluate(() => window.__d3.camara());
  assert.notDeepEqual(cerca, antes);
  await b.keyboard.press('Escape');
  await b.waitForTimeout(40);
  const despues = await b.evaluate(() => window.__d3.camara());
  assert(antes.every((v, i) => Math.abs(v - despues[i]) < 0.05));
  resultados.encuadreEsc = true;
  await a.getByRole('button', { name: 'Ver pantalla', exact: true }).click();
  await a.getByRole('button', { name: 'Presentar', exact: true }).click();
  await a.keyboard.down('p');
  await a.mouse.move(720, 450);
  await a.mouse.move(770, 470, { steps: 10 });
  await b.waitForFunction(() => window.__d3.ver().laser?.visible);
  await a.screenshot({ path: `${salida}/03-laser.png` });
  await a.keyboard.up('p');
  await b.waitForFunction(() => !window.__d3.ver().laser?.visible);
  resultados.laser = true;
  await a.keyboard.press('Escape');
  await a.getByRole('button', { name: 'Presentar', exact: true }).click();
  await a.getByText('Crear lámina de texto', { exact: true }).click();
  await a.getByLabel('Título', { exact: true }).fill('Una conversación, muchas ideas');
  await a
    .getByLabel('Hasta 5 líneas')
    .fill('Presenta una idea.\nEscucha al equipo.\nConstruye el siguiente paso.');
  await a.getByRole('button', { name: 'Mostrar texto', exact: true }).click();
  await b.waitForFunction(
    () => window.__d3.ver().estado.laminas[window.__d3.ver().estado.actual]?.tipo === 'texto',
  );
  await b.getByRole('button', { name: 'Visor 2D', exact: true }).click();
  await b.screenshot({ path: `${salida}/04-texto-2d.png` });
  resultados.texto = true;
  for (const ancho of [390, 320]) {
    await b.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 640 });
    await b.waitForTimeout(150);
    assert(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await b.screenshot({ path: `${salida}/05-visor-${ancho}.png` });
    await b.keyboard.press('Escape');
    await b.screenshot({ path: `${salida}/06-mundo-${ancho}.png` });
    await b.getByRole('button', { name: 'Visor 2D', exact: true }).click();
  }
  await b.getByRole('button', { name: 'Ampliar +' }).click();
  await b.getByRole('button', { name: 'Ampliar +' }).click();
  assert(await b.locator('.d3-visor-lamina').evaluate((e) => e.scrollWidth > e.clientWidth));
  await b.screenshot({ path: `${salida}/07-visor-ampliado-320.png` });
  resultados.movil = true;
  const texturasAntes = await a.evaluate(() => window.__d3.texturas());
  for (let i = 0; i < 20; i++) {
    await a.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowLeft');
    await a.waitForTimeout(80);
  }
  assert((await a.evaluate(() => window.__d3.texturas())) <= texturasAntes + 1);
  resultados.texturasEstables = true;
  for (const ancho of [390, 320]) {
    await a.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 640 });
    await a.waitForTimeout(120);
    assert(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await a.screenshot({ path: `${salida}/08-panel-anfitrion-${ancho}.png` });
  }
  resultados.texturas = await a.evaluate(() => window.__d3.texturas());
  assert.deepEqual(errores, []);
  console.log('D3 E2E VERDE', JSON.stringify(resultados));
} catch (error) {
  for (const [i, p] of contextos.flatMap((c) => c.pages()).entries()) {
    await p.screenshot({ path: `${salida}/fallo-${i}.png` }).catch(() => undefined);
    console.log(
      'Diagnóstico',
      i,
      await p
        .locator('body')
        .innerText()
        .catch(() => 'cerrada'),
    );
  }
  throw error;
} finally {
  writeFileSync(`${salida}/resultado.json`, JSON.stringify({ resultados, errores }, null, 2));
  await Promise.all(contextos.map((c) => c.close()));
  await browser.close();
}
