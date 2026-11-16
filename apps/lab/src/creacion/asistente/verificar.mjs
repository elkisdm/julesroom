import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(new URL('../../../../sala/package.json', import.meta.url))(
  'playwright',
);
const salida = process.env.AK_SALIDA;
if (!salida) throw new Error('Define AK_SALIDA para las capturas y resultados.');
mkdirSync(salida, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'],
});
const registros = [];
let pagina;
async function registrar(texto) {
  registros.push(texto);
  console.log(texto);
}
async function sinFoco(p) {
  await p.evaluate(() => document.activeElement?.blur());
}
async function chat(p, texto) {
  if (!(await p.locator('#ev-texto').isVisible())) await p.locator('.ev-abrir-chat').click();
  await p.locator('#ev-texto').fill(texto);
  await p.locator('#ev-texto').press('Enter');
}
async function entrar(p, mundo) {
  await p.goto('http://127.0.0.1:5388/crear.html');
  await p.waitForLoadState('networkidle');
  await p.getByRole('button', { name: /Crear mi sala/ }).click();
  await p.getByRole('button', { name: mundo, exact: true }).click();
  await p.getByRole('button', { name: /Elegir esta sala/ }).click();
  await p.locator('#fl-nombre').fill('Ana');
  await p.getByRole('button', { name: /Ese soy yo/ }).click();
  await p.getByRole('button', { name: /Este soy yo/ }).click();
  await p.getByRole('button', { name: /^Seguir/ }).click();
  await p.getByRole('button', { name: /Entrar a la sala/ }).click();
  await p.waitForFunction(() => window.__crear?.paso() === 'dentro' && window.__crear.lista());
  await p.evaluate(() => {
    window.addEventListener('ak-jules-control', (e) => {
      window.__ak = e.detail;
    });
    window.dispatchEvent(new Event('ak-jules-lista'));
  });
  await p.waitForFunction(() => window.__ak?.disponible);
}
async function espera(p) {
  await p.waitForFunction(
    () => document.querySelector('.ak-jules-nombre')?.textContent.includes('espera aquí'),
    null,
    { timeout: 18000 },
  );
}
async function paso(p, n) {
  await p.waitForFunction(
    (n) => document.querySelector('.ak-ayuda-cabecera')?.textContent.includes(`${n}/5`),
    n,
  );
}
try {
  const mundos = process.env.AK_MUNDO ? [process.env.AK_MUNDO] : ['Auditorio', 'Oficina'];
  const anchos = process.env.AK_ANCHO ? [Number(process.env.AK_ANCHO)] : [1440, 390];
  for (const mundo of mundos)
    for (const ancho of anchos) {
      const errores = [];
      const c = await browser.newContext({
        viewport: { width: ancho, height: ancho === 1440 ? 900 : ancho === 320 ? 640 : 844 },
      });
      const p = (pagina = await c.newPage());
      p.setDefaultTimeout(10000);
      p.on('pageerror', (e) => errores.push(e.message));
      await entrar(p, mundo);
      await registrar(`${mundo} ${ancho}: entrada`);
      const inicio = await p.evaluate(() => ({ ...window.__ak.posicion }));
      assert.equal(await p.evaluate(() => window.__ak.seguir), false);
      await sinFoco(p);
      await p.keyboard.down('KeyW');
      await p.waitForTimeout(700);
      await p.keyboard.up('KeyW');
      await p.waitForTimeout(300);
      const quieta = await p.evaluate(() => ({ ...window.__ak.posicion }));
      assert(
        Math.hypot(quieta.x - inicio.x, quieta.z - inicio.z) < 0.4,
        'Jules espera por defecto',
      );
      await p.keyboard.press('KeyJ');
      await espera(p);
      await p.keyboard.press('KeyE');
      await p.getByRole('group', { name: 'Órdenes para Jules' }).waitFor();
      await p.screenshot({ path: `${salida}/${mundo}-${ancho}-menu.png` });
      await p.getByRole('button', { name: 'Sígueme', exact: true }).click();
      assert.equal(await p.evaluate(() => window.__ak.seguir), true);
      await chat(p, '@JULES, QUÉDATE AQUÍ');
      await espera(p);
      assert.equal(await p.evaluate(() => window.__ak.seguir), false);
      await chat(p, 'vuelve a tu puesto');
      await espera(p);
      await registrar(`${mundo} ${ancho}: E, seguir, esperar, J y puesto OK`);
      await chat(p, '¿qué tiempo hará mañana?');
      assert(
        (await p.locator('.ak-sugerencias').innerText()).includes(
          'Todavía no puedo responder preguntas libres aquí',
        ),
      );
      await p.getByRole('button', { name: 'Muéstrame qué puedo hacer', exact: true }).click();
      await paso(p, 1);
      // Completa primero la ruta manual: sirve también en móviles y salas sin pantalla.
      for (let n = 1; n <= 5; n++) {
        await paso(p, n);
        if (n === 2) await p.waitForTimeout(500);
        await p.getByRole('button', { name: 'Siguiente', exact: true }).click();
      }
      assert((await p.locator('.ak-sugerencias').innerText()).includes('Ya puedes explorar'));
      await registrar(`${mundo} ${ancho}: recorrido completo con Siguiente OK`);
      // Cancelar mediante el atajo no deja guía ni marca pendientes.
      await p.getByRole('button', { name: 'Muéstrame qué puedo hacer', exact: true }).click();
      await sinFoco(p);
      await p.keyboard.press('KeyJ');
      assert.equal(await p.getByText('1/5 · Moverte y correr').count(), 0);
      assert.equal(await p.evaluate(() => window.__ak.marca), null);
      await chat(p, 'Dime los atajos');
      await p.screenshot({ path: `${salida}/${mundo}-${ancho}-atajos.png` });
      const panel = await p.locator('.ak-sugerencias').boundingBox();
      assert(
        panel.x >= 0 && panel.x + panel.width <= ancho + 1,
        `Panel dentro del ancho: ${JSON.stringify(panel)} ${await p.evaluate(() => JSON.stringify({ scroll: scrollX, w: innerWidth, ancho: document.documentElement.scrollWidth, form: document.querySelector('.ev-hablar').getBoundingClientRect().toJSON() }))}`,
      );
      await chat(p, 'Llévame a…');
      await p.getByRole('button', { name: 'Zona central', exact: true }).click();
      await espera(p);
      const distancia = await p.evaluate(() =>
        Math.hypot(
          window.__ak.posicion.x - window.__ak.marca.x,
          window.__ak.posicion.z - window.__ak.marca.z,
        ),
      );
      assert(distancia < 0.9, `Guía llegó al centro: ${distancia}`);
      await p.screenshot({ path: `${salida}/${mundo}-${ancho}-guia.png` });
      await registrar(`${mundo} ${ancho}: guía caminando, ayuda honesta y diseño OK`);
      if (process.env.AK_FISICO === '1') {
        await chat(p, 'Muéstrame qué puedo hacer');
        await paso(p, 1);
        await sinFoco(p);
        await p.evaluate(() => {
          const m = window.__ak.marca;
          window.__crear.ir(m.x, m.z, true, m.y);
        });
        await paso(p, 2);
        await p.keyboard.press('Space');
        await paso(p, 3);
        await p.waitForTimeout(600);
        await p.evaluate(() => {
          const marca = window.__ak.marca;
          const a = window.__crear
            .asientos()
            .sort(
              (a, b) =>
                Math.hypot(a.x - marca.x, a.z - marca.z) - Math.hypot(b.x - marca.x, b.z - marca.z),
            )[0];
          const q = a.aproximacion;
          window.__crear.ir(q.x, q.z, true, q.y ?? 0);
          return a;
        });
        await p.waitForFunction(() => window.__crear.accion()?.tipo === 'sentarse', null, {
          timeout: 15000,
        });
        await p.keyboard.press('KeyE');
        await paso(p, 4);
        assert.equal(await p.evaluate(() => window.__crear.avatar.estado), 'sentado');
        await p.keyboard.press('Digit2');
        await paso(p, 5);
        await p.keyboard.press('KeyE');
        await p.evaluate(() => {
          const m = window.__ak.marca;
          window.__crear.ir(m.x, m.z, true, m.y);
        });
        await p.waitForFunction(
          () =>
            document.querySelector('.ak-sugerencias')?.textContent.includes('Ya puedes explorar'),
          null,
          { timeout: 18000 },
        );
        await registrar(
          `${mundo} ${ancho}: recorrido por correr, saltar, sentarse, reaccionar y acercarse a pantalla OK`,
        );
      }
      assert.deepEqual(errores, []);
      await c.close();
    }
} catch (e) {
  if (pagina && !pagina.isClosed()) {
    await pagina.screenshot({ path: `${salida}/fallo.png` });
    console.log(
      await pagina.evaluate(() => ({
        texto: document.body.innerText,
        yo: window.__crear?.avatar,
        jules: window.__ak?.posicion,
      })),
    );
  }
  throw e;
} finally {
  writeFileSync(`${salida}/verificacion.json`, JSON.stringify(registros, null, 2));
  await browser.close();
}
