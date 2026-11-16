import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(new URL('../../../../../sala/package.json', import.meta.url));
const { chromium } = require('playwright');
if (!process.argv[2]) throw new Error('Indica la carpeta de salida como primer argumento.');
const salida = resolve(process.argv[2]);
await mkdir(salida, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: salida, size: { width: 1440, height: 900 } },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
const errores = [];
page.on('pageerror', (error) => {
  errores.push(error.message);
  console.error(error.message);
});
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return route.abort();
  if (url.pathname !== '/d5-verificacion.html') return route.continue();
  await route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="es"><meta charset="UTF-8"><div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js'; const {createRoot}=ReactDOM;
import {Oficina, atuendoPorRol, crearMando, migrarDefinicion} from '/@fs/${process.cwd()}/packages/oficina/src/index.ts';
import {Momentos} from '/src/creacion/envivo/momentos/Momentos.tsx';
import {crearMomento} from '/src/creacion/envivo/momentos/protocolo.ts';
import '/src/creacion/crear.css';
const h=React.createElement;
const personas=Array.from({length:19},(_,i)=>({id:'invitado-'+i,nombre:'Participante '+(i+1),atuendo:atuendoPorRol('Dev',i),x:(i%5-2)*1.8,y:0,z:Math.floor(i/5)*1.8,rumbo:0}));
const receptores=new Set();
const fuente={personas:()=>personas,suscribir:()=>()=>{},instantanea:()=>({conexion:'conectado'}),suscribirDatos:(r)=>{receptores.add(r);return ()=>receptores.delete(r)},enviarDatos:async(t)=>{window.paquetes.push(JSON.parse(t))}};
window.paquetes=[];
window.recibir=(p,emisor='dueno')=>{for(const r of receptores)r(JSON.stringify(p),emisor)};
window.momento=(a,o)=>window.recibir(crearMomento(a,Date.now(),o));
const sala=migrarDefinicion({version:1,nombre:'Una noche juntos',plano:{plantilla:'oficina'},departamentos:[],ocupantes:[],tema:{calidad:'media'}});
const proyector={current:null};
const sesion={sala:'simulada',yo:'dueno',dueno:'dueno',invitado:false,enlace:''};
const avatar={id:'dueno',nombre:'Anfitrión',atuendo:atuendoPorRol('Community',1),x:0,z:0,mando:crearMando()};
const root=createRoot(document.getElementById('root'));
window.montar=(invitado=false)=>root.render(h('div',{className:'cr'},h('div',{className:'cr-chip-sala',style:{zIndex:1}},'Una noche juntos',h('small',null,'Simulación local · 20 participantes')),h(Oficina,{escenario:'oficina',agentes:[],calidad:'media',fuentePresencia:fuente,avatarPropio:avatar,vista:'general',onProyector:p=>proyector.current=p},h(Momentos,{fuente,sesion:{...sesion,invitado,yo:invitado?'invitado-0':'dueno'},sala,proyector}))));
window.montar();
</script></html>`,
  });
});
try {
  await page.goto('http://127.0.0.1:5378/d5-verificacion.html');
  await page.getByRole('button', { name: 'Momentos', exact: true }).waitFor();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Momentos', exact: true }).click();
  await page.screenshot({ path: resolve(salida, '01-panel-1440.png') });
  await page.locator('canvas').screenshot({ path: resolve(salida, 'lienzo-referencia.png') });
  await page.getByRole('button', { name: 'Foto de grupo', exact: true }).click();
  await page.getByText('Mira a la cámara').waitFor();
  await page.screenshot({ path: resolve(salida, '02-cuenta-1440.png') });
  await page.getByRole('region', { name: 'Tu foto de grupo' }).waitFor({ timeout: 15000 });
  await page.locator('.d5-foto').nth(1).waitFor();
  await page.screenshot({ path: resolve(salida, '03-fotos-1440.png') });
  for (let i = 0; i < 2; i++) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Guardar foto', exact: true }).nth(i).click();
    const download = await downloadPromise;
    await download.saveAs(resolve(salida, download.suggestedFilename()));
  }
  await page.getByRole('button', { name: 'Copiar', exact: true }).first().click();
  await page.getByText('Foto copiada', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cerrar fotos' }).click();
  await page.getByRole('button', { name: 'Momentos', exact: true }).click();
  await page.getByLabel('Título opcional').fill('Receso');
  await page.getByRole('button', { name: 'Iniciar temporizador' }).click();
  await page.getByRole('timer').waitFor();
  await page.getByRole('button', { name: 'Celebrar', exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(salida, '04-celebrar-1440.png') });
  await page.getByRole('button', { name: 'Momentos', exact: true }).click();
  await page.getByRole('button', { name: 'Atención', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar momentos' }).click();
  await page.screenshot({ path: resolve(salida, '05-atencion-1440.png') });
  await page.getByRole('button', { name: 'Momentos', exact: true }).click();
  await page.getByRole('button', { name: 'Apagar foco', exact: true }).click();
  await page.getByLabel('Mensaje de bienvenida').fill('Qué bueno estar juntos');
  await page.getByRole('button', { name: 'Mostrar bienvenida' }).click();
  await page.getByText('Qué bueno estar juntos', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(salida, '06-bienvenida-1440.png') });
  for (const [width, height] of [
    [390, 844],
    [320, 640],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: 'Momentos', exact: true }).click();
    await page.screenshot({ path: resolve(salida, '07-panel-' + width + '.png') });
    const fuera = await page.locator('.d5-controles').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.left < 0 || r.right > innerWidth || r.bottom > innerHeight;
    });
    if (fuera) throw new Error('Panel fuera del viewport ' + width);
    await page.keyboard.press('Escape');
    await page.locator('.d5-controles').waitFor({ state: 'detached' });
    if (!(await page.locator('.d5-panel > button').evaluate((el) => el === document.activeElement)))
      throw new Error('Escape no restaura el foco');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.momento('celebrar'));
  await page.screenshot({ path: resolve(salida, '08-movimiento-reducido.png') });
  await page.evaluate(() => window.montar(true));
  await page.getByRole('button', { name: 'Momentos', exact: true }).waitFor({ state: 'detached' });
  await page.evaluate(() =>
    window.recibir(
      {
        tipo: 'd5/momento',
        version: 1,
        accion: 'bienvenida',
        inicio: Date.now(),
        fin: Date.now() + 6000,
        texto: 'INTRUSO',
      },
      'invitado-1',
    ),
  );
  if (await page.getByText('INTRUSO', { exact: true }).count()) throw new Error('Aceptó invitado');
  await page.clock.install();
  await page.clock.fastForward(6000);
  await page.evaluate(() => window.momento('temporizador', { minutos: 1, texto: 'Pausa breve' }));
  await page.getByRole('timer', { name: 'Pausa breve' }).waitFor();
  await page.clock.fastForward(61_000);
  await page.getByText('Tiempo cumplido', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(salida, '09-temporizador-terminado.png') });
  await page.evaluate(() => window.momento('foto'));
  await page.getByText('Mira a la cámara').waitFor();
  await page.clock.fastForward(3100);
  await page.locator('.d5-foto').first().waitFor();
  if ((await page.locator('.d5-foto').count()) !== 1)
    throw new Error('El invitado debe obtener solo su vista');
  await page.screenshot({ path: resolve(salida, '10-foto-invitado-320.png') });
  const persistente = await page
    .locator('canvas')
    .evaluate((el) => el.getContext('webgl2').getContextAttributes().preserveDrawingBuffer);
  if (persistente) throw new Error('La captura dejó buffer persistente');
  const paquetes = await page.evaluate(() => window.paquetes);
  if (errores.length) throw new Error(errores.join('\n'));
  await writeFile(
    resolve(salida, 'resultado.json'),
    JSON.stringify(
      {
        ok: true,
        participantes: 20,
        paquetes,
        errores,
        simulacion: 'Una pestaña, fuente en memoria; sin LiveKit ni Docker',
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ ok: true, salida, paquetes: paquetes.length }));
} catch (error) {
  await page.screenshot({ path: resolve(salida, 'error.png') });
  console.error(await page.locator('body').innerText());
  throw error;
} finally {
  const video = page.video();
  await context.close();
  if (video) {
    await video.saveAs(resolve(salida, 'momentos-d5.webm'));
    await video.delete();
  }
  await browser.close();
}
