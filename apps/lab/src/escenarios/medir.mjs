// Capturas y p95 del cuadro de /escenarios.html en un Chrome real con GPU, para cada escenario y vista.
// Uso: PLAYWRIGHT_DIR=<carpeta con node_modules/playwright> node medir.mjs --salida <carpeta> \
//   [--base http://127.0.0.1:5325] [--escenarios trading,mansion] [--vistas general,seguir] \
//   [--ag 40 --sim 60] (ag + sim = ocupantes, por defecto 100) [--seg 8] [--sin-medir] [--sin-capturas]
// Escribe <salida>/<escenario>-<vista>-<perfil>.png y <salida>/medidas.json.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(join(process.env.PLAYWRIGHT_DIR ?? process.cwd(), 'x.js'));
const { chromium } = require('playwright');

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const bandera = (k) => process.argv.includes(`--${k}`);

const salida = arg('salida', null);
if (!salida) {
  console.error('Falta --salida <carpeta>');
  process.exit(1);
}
mkdirSync(salida, { recursive: true });
const base = arg('base', 'http://127.0.0.1:5325');
const vistas = arg('vistas', 'general,seguir').split(',');
const ag = Number(arg('ag', '40'));
const sim = Number(arg('sim', '60'));
const seg = Number(arg('seg', '8'));
const filtro = arg('escenarios', null)?.split(',') ?? null;

/** Presupuesto inicial parametrizable (docs/specs/escenarios.md): p95 en ms. */
const PRESUPUESTO = { escritorio: 12, movil: 16.6 };

const PERFILES = {
  escritorio: {
    contexto: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
    cpu: 1,
  },
  movil: {
    contexto: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
    cpu: 4,
  },
};

const navegador = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
    // Sin tope de 60 Hz: el tiempo entre cuadros es el costo real, no el vsync.
    '--disable-frame-rate-limit',
    '--disable-gpu-vsync',
  ],
});

async function abrir(perfil, escenario, cantidades, cpu) {
  const contexto = await navegador.newContext(PERFILES[perfil].contexto);
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  if (cpu > 1) {
    const cdp = await contexto.newCDPSession(pagina);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  await pagina.goto(
    `${base}/escenarios.html?escenario=${escenario}&vista=general&ag=${cantidades.ag}&sim=${cantidades.sim}`,
  );
  await pagina.waitForFunction(() => window.__escenarios?.leer().cuadros > 30, null, {
    timeout: 90000,
  });
  await pagina.waitForTimeout(4000); // precalentado y calidad automática
  return { contexto, pagina, errores };
}

const idPrimero = (await (async () => {
  const c = await navegador.newContext();
  const p = await c.newPage();
  await p.goto(`${base}/escenarios.html`);
  await p.waitForFunction(() => window.__escenarios, null, { timeout: 60000 });
  const ids = await p.evaluate(() => window.__escenarios.escenarios);
  await c.close();
  return ids;
})()).filter((id) => !filtro || filtro.includes(id));

const medidas = [];
for (const escenario of idPrimero) {
  for (const perfil of Object.keys(PERFILES)) {
    // Capturas con pocos ocupantes (la escena legible) y medición con el total pedido.
    if (!bandera('sin-capturas')) {
      const { contexto, pagina, errores } = await abrir(perfil, escenario, { ag: 18, sim: 25 }, 1);
      for (const vista of vistas) {
        await pagina.evaluate((v) => window.__escenarios.cambiarVista(v), vista);
        await pagina.waitForTimeout(3500); // viaje de la cámara
        await pagina.screenshot({ path: join(salida, `${escenario}-${vista}-${perfil}.png`) });
      }
      if (errores.length) console.error(escenario, perfil, 'errores de página:', errores);
      await contexto.close();
    }
    if (!bandera('sin-medir')) {
      const cpu = PERFILES[perfil].cpu;
      const { contexto, pagina, errores } = await abrir(perfil, escenario, { ag, sim }, cpu);
      for (const vista of vistas) {
        await pagina.evaluate((v) => window.__escenarios.cambiarVista(v), vista);
        await pagina.waitForTimeout(3500);
        await pagina.evaluate(() => window.__escenarios.reiniciar());
        await pagina.waitForTimeout(seg * 1000);
        const l = await pagina.evaluate(() => window.__escenarios.leer());
        const fila = {
          escenario,
          perfil,
          cpu,
          vista,
          ocupantes: l.ocupantes,
          p50: +l.p50.toFixed(2),
          p95: +l.p95.toFixed(2),
          p99: +l.p99.toFixed(2),
          fps: +l.fps.toFixed(1),
          cuadros: l.cuadros,
          presupuesto: PRESUPUESTO[perfil],
          cumple: l.p95 <= PRESUPUESTO[perfil],
        };
        medidas.push(fila);
        console.log(JSON.stringify(fila));
      }
      if (errores.length) console.error(escenario, perfil, 'errores de página:', errores);
      await contexto.close();
    }
  }
}
await navegador.close();
writeFileSync(join(salida, 'medidas.json'), JSON.stringify(medidas, null, 2));
