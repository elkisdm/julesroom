// Mide la página /grafica.html en un Chrome real con GPU.
// Uso: PLAYWRIGHT_DIR=<carpeta con node_modules/playwright> node medir.mjs \
//   --base http://127.0.0.1:5324 --perfil escritorio|movil --cpu 1|4 --n 20,100,200 \
//   --calidad auto --seg 8 --salida medidas.json [--capturas carpeta --enfocar id]
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(join(process.env.PLAYWRIGHT_DIR ?? process.cwd(), 'x.js'));
const { chromium } = require('playwright');

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const base = arg('base', 'http://127.0.0.1:5324');
const perfil = arg('perfil', 'escritorio');
const cpu = Number(arg('cpu', '1'));
const lista = arg('n', '20,100,200').split(',').map(Number);
const calidad = arg('calidad', 'auto');
const seg = Number(arg('seg', '8'));
const salida = arg('salida', null);
const capturas = arg('capturas', null);

const PERFILES = {
  escritorio: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
  },
  movil: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};

const navegador = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
    // Sin tope de 60 Hz: el tiempo entre cuadros pasa a ser el costo real, no el vsync.
    ...(arg('libre', '1') === '1' ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : []),
  ],
});
const resultados = [];
for (const n of lista) {
  const contexto = await navegador.newContext(PERFILES[perfil]);
  const pagina = await contexto.newPage();
  const cdp = await contexto.newCDPSession(pagina);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await pagina.goto(`${base}/grafica.html?n=${n}&calidad=${calidad}&panel=0${arg('q', '')}`);
  await pagina.waitForFunction(() => window.__grafica?.leer().drawCalls > 0, null, {
    timeout: 60000,
  });
  await pagina.waitForTimeout(5000); // precalentado y estabilizar la calidad automática
  await pagina.evaluate(() => window.__grafica.reiniciar());
  await pagina.waitForTimeout(seg * 1000);
  const lectura = await pagina.evaluate(() => window.__grafica.leer());
  resultados.push({ perfil, cpu, ...lectura });
  if (capturas) {
    mkdirSync(capturas, { recursive: true });
    await pagina.screenshot({ path: join(capturas, `${perfil}-n${n}-cpu${cpu}.png`) });
  }
  console.log(JSON.stringify(resultados.at(-1)));
  await contexto.close();
}
await navegador.close();
if (salida) writeFileSync(salida, JSON.stringify(resultados, null, 2));
