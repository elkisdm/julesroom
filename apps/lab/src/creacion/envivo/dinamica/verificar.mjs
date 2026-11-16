import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(process.cwd() + '/apps/sala/package.json');
const { chromium } = require('playwright');
const out = process.env.HOME + '/Desktop/oficina-producto/demo-noche/d2';
mkdirSync(out, { recursive: true });
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
const errors = [];
const comprobaciones = [];
const pages = [];
const registrar = (...datos) => {
  console.log(...datos);
  comprobaciones.push(datos);
};
const rendimiento = {};
async function medir(p) {
  return p.evaluate(
    () =>
      new Promise((resolve) => {
        const muestras = [];
        let anterior = performance.now();
        function cuadro(t) {
          muestras.push(t - anterior);
          anterior = t;
          if (muestras.length < 60) requestAnimationFrame(cuadro);
          else {
            const orden = muestras.slice(5).sort((a, b) => a - b);
            resolve({
              medianaMs: orden[Math.floor(orden.length / 2)],
              p95Ms: orden[Math.floor(orden.length * 0.95)],
              drawCalls: window.__crear.drawCalls(),
            });
          }
        }
        requestAnimationFrame(cuadro);
      }),
  );
}
async function page() {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: out, size: { width: 1440, height: 900 } },
  });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.setDefaultTimeout(30000);
  pages.push(p);
  return p;
}
async function name(p, n) {
  await p.locator('#fl-nombre').fill(n);
  await p.keyboard.press('Enter');
  await p.getByRole('button', { name: /Este soy yo/ }).click();
}
try {
  const a = await page();
  await a.goto('http://127.0.0.1:5373/crear.html');
  await a.getByRole('button', { name: /Crear mi sala/ }).click();
  await a.keyboard.press('Enter');
  await name(a, 'Ana');
  await a.keyboard.press('Enter');
  await a.waitForFunction(() => document.querySelector('#fl-enlace')?.value.includes('sala='));
  const link = await a.locator('#fl-enlace').inputValue();
  await a.getByRole('button', { name: /Entrar a la sala/ }).click();
  for (const n of ['Beto', 'Carla']) {
    const p = await page();
    await p.goto(link);
    await name(p, n);
    await p.waitForFunction(
      () =>
        window.__vivo?.recibida && window.__vivo?.fuente?.instantanea().conexion === 'conectado',
    );
  }
  await a.waitForFunction(() => window.__vivo?.fuente?.personas().length === 2);
  await a.waitForTimeout(1800);
  await a.screenshot({ path: out + '/01-nombres.png' });
  registrar('PASS: tres perfiles');
  const b = pages[1],
    c = pages[2];
  const before = await c.evaluate(() => ({ ...window.__crear.avatar }));
  await a.getByRole('button', { name: 'Reunir aquí', exact: true }).click();
  await b.getByRole('button', { name: 'Ir', exact: true }).waitFor();
  await c.getByRole('button', { name: 'Quedarme', exact: true }).click();
  await b.getByRole('button', { name: 'Ir', exact: true }).click();
  await b.waitForTimeout(700);
  const pos = await b.evaluate(() => ({ ...window.__crear.avatar }));
  const after = await c.evaluate(() => ({ ...window.__crear.avatar }));
  if (Math.hypot(before.x - after.x, before.z - after.z) > 0.4)
    throw Error('Quedarme movió a Carla');
  registrar('PASS: reunir y rechazar', pos);
  await a.screenshot({ path: out + '/02-reunidos.png' });
  const antesAuto = await c.evaluate(() => ({ ...window.__crear.avatar }));
  await a.getByRole('button', { name: 'Reunir aquí', exact: true }).click();
  await b.getByRole('button', { name: 'Quedarme', exact: true }).click();
  await c.getByRole('button', { name: 'Ir', exact: true }).waitFor();
  await c.waitForTimeout(3500);
  const aun = await c.evaluate(() => ({ ...window.__crear.avatar }));
  if (Math.hypot(aun.x - antesAuto.x, aun.z - antesAuto.z) > 0.4)
    throw Error('La invitación movió antes de 5 segundos');
  await c.getByRole('button', { name: 'Ir', exact: true }).waitFor({ state: 'hidden' });
  await c.waitForTimeout(500);
  const auto = await c.evaluate(() => ({ ...window.__crear.avatar }));
  if (Math.hypot(auto.x - antesAuto.x, auto.z - antesAuto.z) < 1)
    throw Error('La invitación no aceptó por defecto');
  registrar('PASS: espera cinco segundos y acepta por defecto');
  await a.getByRole('button', { name: 'Sígueme', exact: true }).click();
  await b.getByRole('button', { name: 'Ir', exact: true }).click();
  await c.getByRole('button', { name: 'Quedarme', exact: true }).click();
  await b.getByRole('button', { name: /Soltarme/ }).waitFor();
  const antesSeguir = await b.evaluate(() => ({ ...window.__crear.avatar }));
  await a.evaluate(() => {
    const p = window.__crear.avatar;
    window.__crear.ir(p.x - 3, p.z, true);
  });
  await b.waitForTimeout(3500);
  const siguiendo = await b.evaluate(() => ({ ...window.__crear.avatar }));
  if (Math.hypot(siguiendo.x - antesSeguir.x, siguiendo.z - antesSeguir.z) < 0.4)
    throw Error('El seguidor no caminó');
  await b.keyboard.press('w');
  await b.getByRole('button', { name: /Soltarme/ }).waitFor({ state: 'hidden' });
  registrar('PASS: seguimiento y liberación manual');
  await b.keyboard.press('3');
  await a.locator('.d2-manos').getByText('Beto', { exact: true }).waitFor();
  await c.getByRole('button', { name: 'Levantar la mano', exact: true }).click();
  await a.locator('.d2-manos').getByText('Carla', { exact: true }).waitFor();
  await b.waitForTimeout(900);
  await b.keyboard.press('4');
  await a.locator('.d2-reaccion [aria-label="Risa"]').waitFor();
  if ((await a.locator('.d2-manos li').allTextContents()).join(',') !== 'Beto,Carla')
    throw Error('Orden de manos incorrecto');
  await a.screenshot({ path: out + '/03-manos-reacciones.png' });
  await b.waitForTimeout(900);
  await Promise.all(
    pages.map((p) => p.getByRole('button', { name: 'Aplaudir', exact: true }).click()),
  );
  await a.getByLabel('Aplauso de grupo', { exact: true }).waitFor();
  await a.screenshot({ path: out + '/04-aplauso-grupo.png' });
  await b.waitForTimeout(900);
  await b.keyboard.press('3');
  await a.locator('.d2-manos').getByText('Beto', { exact: true }).waitFor({ state: 'hidden' });
  await c.setViewportSize({ width: 390, height: 844 });
  await c.screenshot({ path: out + '/05-telefono-390.png' });
  await c.setViewportSize({ width: 320, height: 640 });
  await c.screenshot({ path: out + '/06-telefono-320.png' });
  registrar('PASS: reacción remota, manos y aplauso');
  // Sitúa al anfitrión en el pasillo abierto y mirando al oeste antes de la votación.
  if (await a.getByRole('button', { name: 'Dejar de guiar', exact: true }).isVisible())
    await a.getByRole('button', { name: 'Dejar de guiar', exact: true }).click();
  await a.evaluate(() => window.__crear.ir(5, 5, true));
  await a.waitForFunction(
    () => Math.hypot(window.__crear.avatar.x - 5, window.__crear.avatar.z - 5) < 0.5,
  );
  await a.evaluate(() => window.__crear.ir(0, 5, true));
  await a.waitForFunction(
    () => Math.hypot(window.__crear.avatar.x, window.__crear.avatar.z - 5) < 0.3,
  );
  await a.waitForTimeout(700);
  await a.locator('.d2-panel-voto summary').click();
  await a.getByLabel('Tu pregunta', { exact: true }).fill('¿Qué exploramos ahora?');
  await a.getByLabel('Opción 1', { exact: true }).fill('Ideas');
  await a.getByLabel('Opción 2', { exact: true }).fill('Prototipos');
  registrar(
    'Posición para votar',
    await a.evaluate(() => window.__crear.mundo(window.__vivo.sesion.yo)),
  );
  await a.getByRole('button', { name: 'Lanzar pregunta', exact: true }).click();
  await a.locator('[data-d2-zona="0"]').waitFor();
  const zone = await a
    .locator('[data-d2-zona="0"]')
    .evaluate((el) => ({ x: Number(el.dataset.x), z: Number(el.dataset.z) }));
  await b.evaluate(({ x, z }) => window.__crear.ir(x, z, true), zone);
  await a
    .locator('[data-d2-zona="0"]')
    .getByText('1 persona', { exact: true })
    .waitFor({ timeout: 25000 });
  await b.screenshot({ path: out + '/07-invitado-votando.png' });
  await a.mouse.move(700, 500);
  await a.mouse.wheel(0, 1400);
  await a.waitForTimeout(1000);
  await a.screenshot({ path: out + '/07-votacion.png' });
  await a.getByRole('button', { name: 'Cerrar votación', exact: true }).click();
  await c.locator('.d2-pregunta').getByText('Ganó: Ideas', { exact: true }).waitFor();
  await a.screenshot({ path: out + '/08-resultado-voto.png' });
  registrar('PASS: zonas compartidas, voto caminando, cierre y ganador remoto');
  await a.keyboard.press('h');
  await a.getByText('Modo grabación · H o Esc para volver', { exact: true }).waitFor();
  await a.waitForTimeout(1200);
  if (await a.getByRole('button', { name: 'Reunir aquí', exact: true }).isVisible())
    throw Error('La UI sigue visible al grabar');
  if (await a.locator('.d2-aviso-grabacion').count()) throw Error('Aviso de grabación no caducó');
  await a.screenshot({ path: out + '/09-grabacion-limpia.png' });
  await a.keyboard.press('Escape');
  await a.getByRole('button', { name: 'Reunir aquí', exact: true }).waitFor();
  await a.locator('.d2-panel-voto summary').click();
  await a.getByLabel('Tu pregunta', { exact: true }).fill('');
  await a.getByLabel('Tu pregunta', { exact: true }).pressSequentially('h12345');
  if (await a.locator('html').evaluate((el) => el.classList.contains('d2-grabando')))
    throw Error('H activó grabación al escribir');
  await a.getByLabel('Tu pregunta', { exact: true }).blur();
  await a.locator('.d2-panel-voto summary').click();
  await a.keyboard.press('h');
  await a.waitForTimeout(1200);
  await a.keyboard.press('h');
  await a.getByRole('button', { name: 'Reunir aquí', exact: true }).waitFor();
  registrar('PASS: H/Esc, aviso y escritura');
  await b.evaluate(async () => {
    await window.__vivo.fuente.enviarDatos(
      JSON.stringify({ tipo: 'd2-parar', revision: Number.MAX_SAFE_INTEGER }),
    );
    await window.__vivo.fuente.enviarDatos(
      JSON.stringify({
        tipo: 'd2-votacion',
        revision: Number.MAX_SAFE_INTEGER,
        id: 'intrusa',
        pregunta: 'Pregunta intrusa',
        opciones: [
          { x: 0, y: 0, z: 0, rotulo: 'X' },
          { x: 4, y: 0, z: 0, rotulo: 'Y' },
        ],
        cerrada: false,
        conteos: [0, 0],
      }),
    );
  });
  await a.waitForTimeout(400);
  if ((await a.locator('.d2-pregunta').innerText()).includes('intrusa'))
    throw Error('Se aceptó una pregunta de invitado');
  registrar('PASS: órdenes y votación intrusas rechazadas');
  rendimiento.tres = await medir(a);
  await a.evaluate(async (raiz) => {
    const { crearFuenteLiveKit } = await import('/@fs' + raiz + '/packages/presencia/src/index.ts');
    const fuentes = [];
    window.__d2Bots = fuentes;
    const atuendo = window.__crear.sala().ocupantes.find((p) => p.id === 'yo').atuendo;
    const host = window.__crear.avatar;
    for (let i = 0; i < 17; i++) {
      const nombre = 'Persona ' + String(i + 1).padStart(2, '0');
      const respuesta = await fetch('http://127.0.0.1:5374/api/pases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sala: window.__vivo.sesion.sala,
          identidad: crypto.randomUUID(),
          nombre,
        }),
      });
      if (!respuesta.ok) throw Error('No se pudo emitir pase ligero: ' + respuesta.status);
      const pase = await respuesta.json();
      const f = crearFuenteLiveKit({
        url: 'ws://127.0.0.1:7893',
        obtenerToken: async () => pase.token,
        yo: { id: pase.identidad, nombre, atuendo, escenario: 'sala-en-vivo' },
        parametros: { fuente: { topeSala: 25 } },
      });
      fuentes.push(f);
      await f.conectar();
      const posicion = {
        x: host.x + ((i % 5) - 2) * 1.05,
        y: host.y,
        z: host.z - 2 - Math.floor(i / 5) * 1.1,
        rumbo: Math.PI,
        saltos: 0,
        estado: 'de-pie',
        asiento: null,
      };
      f.publicarPropio(posicion);
      setInterval(() => f.publicarPropio(posicion), 150);
    }
  }, process.cwd());
  await a.waitForFunction(() => window.__vivo.fuente.personas().length === 19);
  await a.mouse.move(700, 500);
  await a.mouse.wheel(0, 2000);
  await a.waitForTimeout(1200);
  rendimiento.veinte = await medir(a);
  await a.screenshot({ path: out + '/10-veinte-personas.png' });
  await a.keyboard.press('h');
  await a.waitForTimeout(1300);
  await a.screenshot({ path: out + '/11-veinte-grabacion.png' });
  await a.keyboard.press('Escape');
  registrar(
    'PASS: veinte conexiones LiveKit (tres perfiles completos y diecisiete clientes ligeros); errores:',
    errors,
  );
  await a.evaluate(async () => {
    await Promise.all(window.__d2Bots.map((f) => f.desconectar()));
  });
} catch (e) {
  for (const [i, p] of pages.entries()) {
    await p.screenshot({ path: out + '/fallo-' + i + '.png' });
    registrar(i, await p.locator('body').innerText());
  }
  throw e;
} finally {
  writeFileSync(
    out + '/resultado.json',
    JSON.stringify({ comprobaciones, errors, rendimiento }, null, 2),
  );
  await browser.close();
}
