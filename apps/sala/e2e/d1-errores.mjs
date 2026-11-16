// Con emisor local DEMO_TOPE_SALA=2: prueba cupo real con tres perfiles Chrome.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ARGS } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.DEMO_URL ?? 'http://localhost:5371';
const salida =
  process.env.DEMO_CAPTURAS ?? `${process.env.HOME}/Desktop/oficina-producto/demo-noche/d1`;
mkdirSync(salida, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ARGS });
const resultado = {};
const conectar = (p) =>
  p.waitForFunction(() => window.__vivo?.fuente?.instantanea().conexion === 'conectado');
async function abrir(enlace, nombre, llave = 'prueba-d1') {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await contexto.newPage();
  p.setDefaultTimeout(30000);
  await p.addInitScript((llave) => sessionStorage.setItem('demo/llave', llave), llave);
  await p.goto(enlace);
  await p.locator('#fl-nombre').fill(nombre);
  await p.keyboard.press('Enter');
  await p.getByRole('button', { name: 'Entrar ya' }).click();
  return p;
}
try {
  const creada = await fetch('http://localhost:5372/api/salas', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ llaveDemo: 'prueba-d1' }),
  }).then((r) => r.json());
  assert(creada.sala);
  const enlace = `${base}/crear.html?sala=${creada.sala}`;
  // Dos invitados bastan para ocupar el cupo; aquí no se requiere transmitir mundo.
  const a = await abrir(enlace, 'Primera');
  await conectar(a);
  const b = await abrir(enlace, 'Segunda');
  await conectar(b);
  const c = await abrir(enlace, 'En espera');
  await c
    .getByText('La sala está llena (2). Entrarás apenas se libere un lugar', { exact: true })
    .waitFor();
  assert.equal(await c.getByRole('button', { name: 'Entrar con la llave' }).count(), 0);
  assert.equal(
    await c.getByText('Esperando al anfitrión para recibir el mundo.', { exact: true }).count(),
    0,
  );
  await c.screenshot({ path: `${salida}/sala-llena.png` });
  await b.context().close();
  await conectar(c);
  resultado.cupoYReintentoReal = true;
  await c.context().close();

  const incorrecta = await abrir(enlace, 'Llave errónea', 'incorrecta');
  await incorrecta.getByText('La llave de demo es incorrecta.', { exact: true }).waitFor();
  assert.equal(await incorrecta.getByRole('button', { name: 'Entrar con la llave' }).count(), 1);
  await incorrecta.screenshot({ path: `${salida}/llave-incorrecta.png` });
  await incorrecta.context().close();
  resultado.llaveIncorrecta = true;

  const contexto = await browser.newContext();
  await contexto.addInitScript(() => sessionStorage.setItem('demo/llave', 'prueba-d1'));
  const transitorio = await contexto.newPage();
  let fase = 'limite';
  const solicitudes = [];
  await transitorio.route('**/api/pases', (route) => {
    solicitudes.push(Date.now());
    if (fase === 'limite')
      return route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
    return route.continue();
  });
  await transitorio.goto(enlace);
  await transitorio.locator('#fl-nombre').fill('Reintento');
  await transitorio.keyboard.press('Enter');
  await transitorio.getByRole('button', { name: 'Entrar ya' }).click();
  await transitorio
    .getByText('Hay mucha gente entrando a la vez, reintentando…', { exact: true })
    .waitFor();
  assert.equal(await transitorio.getByRole('button', { name: 'Entrar con la llave' }).count(), 0);
  await transitorio.waitForFunction(() => window.__crear?.paso() === 'dentro');
  const limite = Date.now() + 20000;
  while (solicitudes.length < 3 && Date.now() < limite) await transitorio.waitForTimeout(500);
  assert(solicitudes.length >= 3, 'Se produjeron los reintentos esperados');
  assert(solicitudes[2] - solicitudes[1] > solicitudes[1] - solicitudes[0]);
  await transitorio.screenshot({ path: `${salida}/limite-reintentando.png` });
  fase = 'normal';
  await conectar(transitorio);
  resultado.limiteSinLlaveYEsperaCreciente = solicitudes.slice(1).map((t, i) => t - solicitudes[i]);
  await contexto.close();

  const red = await browser.newContext();
  await red.addInitScript(() => sessionStorage.setItem('demo/llave', 'prueba-d1'));
  const p = await red.newPage();
  await p.route('**/api/salud', (route) => route.abort('internetdisconnected'));
  await p.goto(enlace);
  await p.locator('#fl-nombre').fill('Sin red');
  await p.keyboard.press('Enter');
  await p.getByRole('button', { name: 'Entrar ya' }).click();
  await p.getByText('No pudimos conectar; reintentando', { exact: true }).waitFor();
  assert.equal(await p.getByRole('button', { name: 'Entrar con la llave' }).count(), 0);
  assert.equal(await p.evaluate(() => window.__crear.paso()), 'dentro');
  await p.screenshot({ path: `${salida}/sin-red.png` });
  await p.unroute('**/api/salud');
  await conectar(p);
  resultado.redRecuperadaSinRomperIndividual = true;
  console.log(JSON.stringify(resultado));
} finally {
  writeFileSync(`${salida}/errores.json`, JSON.stringify(resultado, null, 2));
  await browser.close();
}
