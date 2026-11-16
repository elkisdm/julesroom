import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(new URL('../../../../sala/package.json', import.meta.url))(
  'playwright',
);
const out = process.env.AK_SALIDA;
if (!out) throw new Error('Define AK_SALIDA');
mkdirSync(`${out}/video-final`, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: `${out}/video-final`, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const chat = async (texto) => {
  await page.locator('#ev-texto').fill(texto);
  await page.locator('#ev-texto').press('Enter');
};
try {
  await page.goto('http://127.0.0.1:5388/crear.html');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Crear mi sala/ }).click();
  await page.getByRole('button', { name: 'Auditorio', exact: true }).click();
  await page.getByRole('button', { name: /Elegir esta sala/ }).click();
  await page.locator('#fl-nombre').fill('Ana');
  await page.getByRole('button', { name: /Ese soy yo/ }).click();
  await page.getByRole('button', { name: /Este soy yo/ }).click();
  await page.getByRole('button', { name: /^Seguir/ }).click();
  await page.getByRole('button', { name: /Entrar a la sala/ }).click();
  await page.waitForFunction(() => window.__crear?.paso() === 'dentro');
  await page.evaluate(() => {
    window.addEventListener('ak-jules-control', (e) => (window.__ak = e.detail));
    window.dispatchEvent(new Event('ak-jules-lista'));
    document.activeElement?.blur();
    window.__crear.ir(0, -1, true);
  });
  await page.waitForFunction(() => window.__crear.avatar.z < 0);
  await page.getByRole('button', { name: 'Presentar', exact: true }).click();
  await page.getByRole('button', { name: 'Poner pantalla aquí', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar presentación', exact: true }).click();
  await page.waitForFunction(() => window.__ak?.pantalla);
  await chat('Llévame a…');
  await page.getByRole('button', { name: 'Pantalla', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.ak-jules-nombre').textContent.includes('espera aquí'),
    null,
    { timeout: 15000 },
  );
  const antes = await page.evaluate(() => ({ ...window.__ak.posicion }));
  await chat('quédate');
  await page.waitForFunction(
    (antes) => Math.hypot(window.__ak.posicion.x - antes.x, window.__ak.posicion.z - antes.z) > 1,
    antes,
  );
  await page.screenshot({ path: `${out}/pantalla-colocada.png` });
  console.log('Pantalla colocada: guía y paso lateral OK');
  await page.evaluate(async () => {
    const { conectarD2 } = await import('/src/creacion/envivo/dinamica/conexion.ts');
    const oyentes = new Set();
    window.__akPersonas = [{ id: 'beto', nombre: 'Beto', x: 2, y: 0, z: -1, estado: 'de-pie' }];
    window.__akDatos = (texto, id) => {
      for (const f of oyentes) f(texto, id);
    };
    conectarD2({
      fuente: {
        personas: () => window.__akPersonas,
        suscribirDatos: (f) => {
          oyentes.add(f);
          return () => oyentes.delete(f);
        },
        enviarDatos: async () => {},
        instantanea: () => ({ conexion: 'conectado' }),
        suscribir: () => () => {},
      },
      yo: 'ana',
      dueno: 'ana',
      invitado: false,
    });
  });
  await page.getByRole('button', { name: 'Ocultar ayuda de Jules' }).click();
  await page.waitForTimeout(400);
  await page.evaluate(() =>
    window.__akPersonas.push({
      id: 'carla',
      nombre: 'Carla',
      x: 1.6,
      y: 0,
      z: -1,
      estado: 'de-pie',
    }),
  );
  await page.waitForFunction(() =>
    document.querySelector('.ak-jules-burbuja')?.textContent.includes('Carla'),
  );
  await page.screenshot({ path: `${out}/saludo-simulado.png` });
  await page.evaluate(() =>
    window.__akPersonas.push({ id: 'dani', nombre: 'Dani', x: 3, y: 0, z: -2, estado: 'de-pie' }),
  );
  await page.waitForTimeout(500);
  assert((await page.locator('.ak-jules-burbuja').innerText()).includes('Carla'));
  assert.equal(await page.evaluate(() => window.__ak.mirar?.id), 'carla');
  await page.locator('.ak-jules-nombre').click();
  await page.waitForTimeout(1200);
  await page
    .getByRole('group', { name: 'Órdenes para Jules' })
    .getByRole('button', { name: 'Sígueme', exact: true })
    .click();
  await page.waitForTimeout(1200);
  await chat('Jules, quédate aquí');
  await page.waitForTimeout(1000);
  await chat('¿Quién está aquí?');
  assert((await page.locator('.ak-sugerencias').innerText()).includes('Ana · anfitrión'));
  await page.screenshot({ path: `${out}/presentes-simulados.png` });
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Dime los atajos', exact: true }).click();
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Muéstrame qué puedo hacer', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Terminar recorrido', exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar ayuda de Jules' }).click();
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('KeyJ');
  await page.waitForFunction(
    () =>
      Math.hypot(
        window.__ak.posicion.x - window.__ak.usuario.x,
        window.__ak.posicion.z - window.__ak.usuario.z,
      ) < 2.2,
    null,
    { timeout: 15000 },
  );
  await page.evaluate(() => {
    for (const id of ['beto', 'carla', 'dani'])
      window.__akDatos(JSON.stringify({ tipo: 'd2-reaccion', reaccion: 2, activa: true }), id);
  });
  await page.waitForTimeout(600);
  assert(await page.getByLabel('Aplauso de grupo').isVisible());
  assert(await page.evaluate(() => window.__ak.aplaudirHasta > Date.now()));
  await page.screenshot({ path: `${out}/aplauso-simulado.png` });
  await page.waitForTimeout(1800);
  assert.deepEqual(errores, []);
  console.log(
    'Mirada, saludo limitado, nombres, gesto y botones sobre D2 OK; cero errores de navegador',
  );
  writeFileSync(
    `${out}/presencia-verificacion.json`,
    JSON.stringify(
      {
        pantalla: true,
        mirada: true,
        saludos: true,
        aplauso: true,
        participantes: 'simulados en memoria',
        errores,
      },
      null,
      2,
    ),
  );
} finally {
  console.log(`Video: ${await page.video().path()}`);
  await context.close();
  await browser.close();
}
