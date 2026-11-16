// E2E real de la experiencia existente. Ejecutar con SALA_SIMULADA=1 pnpm dev:sala.
import { chromium } from 'playwright';
import { nivelAudio } from './lib.mjs';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const salida = `${process.env.HOME}/Desktop/oficina-producto/sala-en-vivo`;
mkdirSync(salida, { recursive: true });
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
const errores = [],
  resultados = {};
async function pagina() {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone'],
  });
  await ctx.addInitScript(() => {
    window.__pcs = [];
    const Original = window.RTCPeerConnection;
    window.RTCPeerConnection = function (...args) {
      const pc = new Original(...args);
      window.__pcs.push(pc);
      return pc;
    };
    window.RTCPeerConnection.prototype = Original.prototype;
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  return p;
}
async function capturas(p, nombre) {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await p.setViewportSize({ width, height });
    await p.waitForTimeout(1300);
    await p.screenshot({ path: `${salida}/${nombre}-${width}.png` });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}
async function grabar(p, nombre) {
  const ws = createWriteStream(`${salida}/${nombre}.webm`);
  await p.exposeFunction('__trozoVivo', (b) => ws.write(Buffer.from(b, 'base64')));
  await p.evaluate(() => {
    const rec = new MediaRecorder(document.querySelector('canvas').captureStream(60), {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 10000000,
    });
    rec.ondataavailable = async (e) => {
      const b = new Uint8Array(await e.data.arrayBuffer());
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000)
        s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      await window.__trozoVivo(btoa(s));
    };
    rec.start(500);
    window.__grabacionViva = rec;
  });
  return async () => {
    await p.evaluate(
      () =>
        new Promise((resolve) => {
          window.__grabacionViva.onstop = () => setTimeout(resolve, 1000);
          window.__grabacionViva.stop();
        }),
    );
    await new Promise((r) => ws.end(r));
  };
}
const cerca = (p) =>
  p.waitForFunction(() => window.__vivo?.fuente?.personas().length === 1, null, { timeout: 30000 });
async function bytesAudio(p) {
  return p.evaluate(async () => {
    let n = 0;
    for (const pc of window.__pcs)
      for (const s of (await pc.getStats()).values())
        if (s.type === 'inbound-rtp' && s.kind === 'audio') n += s.bytesReceived ?? 0;
    return n;
  });
}
async function ir(p, x, z, correr = false) {
  await p.evaluate(({ x, z, correr }) => window.__crear.ir(x, z, correr), { x, z, correr });
  await p.waitForFunction(
    ({ x, z }) => Math.hypot(window.__crear.avatar.x - x, window.__crear.avatar.z - z) < 0.5,
    { x, z },
    { timeout: 20000 },
  );
}
try {
  const a = await pagina();
  await a.goto('http://localhost:5352/crear.html');
  await a.waitForLoadState('networkidle');
  const salud = await a.evaluate(() => fetch('/api/salud').then((r) => r.json()));
  assert.equal(salud.clave, false, 'Pruebas automáticas solo con proveedor simulado');
  await a.getByRole('button', { name: /Crear mi sala/ }).click({ timeout: 60000 });
  await a.keyboard.press('Enter');
  await a.locator('#fl-nombre').fill('Ana');
  await a.keyboard.press('Enter');
  await a.getByRole('button', { name: /Este soy yo/ }).click();
  await a.keyboard.press('Enter');
  await a.locator('#fl-enlace').waitFor();
  console.log('onboarding listo');
  const enlace = await a.locator('#fl-enlace').inputValue();
  await capturas(a, 'invitacion');
  await a.getByRole('button', { name: /Entrar a la sala/ }).click();
  await a.waitForFunction(() => window.__vivo?.fuente?.instantanea().conexion === 'conectado');
  assert(
    await a.evaluate(() =>
      window.__pcs.every((pc) => (pc.getConfiguration().iceServers ?? []).length === 0),
    ),
    'ICE no debe usar STUN externo',
  );
  // Un objeto colocado por el dueño cruza a otro perfil sin localStorage compartido.
  await a.evaluate(() =>
    window.__crear.colocarObjetos([
      { id: 'e2e-mueble', tipo: 'planta-grande', x: -10, z: 5, giro: 0 },
    ]),
  );
  const b = await pagina();
  await b.goto(enlace);
  await b.locator('#fl-nombre').fill('Beto');
  await b.keyboard.press('Enter');
  await b.keyboard.press('ArrowRight');
  await b.getByRole('button', { name: /Este soy yo/ }).click();
  await Promise.all([cerca(a), cerca(b)]);
  await b.waitForFunction(() => window.__vivo.recibida);
  const salab = await b.evaluate(() => window.__crear.sala());
  assert.equal(salab.nombre, 'Sala de Ana');
  assert.equal(salab.mundo.objetos[0]?.id, 'e2e-mueble');
  resultados.invitacionYEstado = true;
  console.log('invitación y mundo sincronizados');
  const atuendos = await a.evaluate(() => ({
    yo: window.__crear.sala().ocupantes.find((o) => o.id === 'yo').atuendo,
    otro: window.__vivo.fuente.personas()[0].atuendo,
  }));
  assert.notDeepEqual(atuendos.yo, atuendos.otro);
  resultados.ropa = true;
  console.log('atuendos distintos replicados');
  await capturas(a, 'presentes');
  for (const p of [a, b]) {
    await p.getByRole('button', { name: 'Usar mi voz' }).click();
    if (p === a) await capturas(a, 'explicacion-microfono');
    await p.getByRole('button', { name: 'Permitir micrófono' }).click();
  }
  await a.waitForFunction(
    () => document.querySelectorAll('audio[data-presencia-audio]').length === 1,
  );
  const antes = await bytesAudio(a);
  await a.waitForTimeout(1200);
  const despues = await bytesAudio(a);
  assert(despues > antes);
  const rms = await nivelAudio({ pagina: a }, 1200);
  assert(rms.rms > 0.002);
  resultados.audioCerca = { antes, despues, rms: rms.rms };
  console.log('audio cerca: bytes', antes, despues);
  await capturas(a, 'voz-activa');
  const parar = process.argv.includes('--video')
    ? await Promise.all([grabar(a, 'ana'), grabar(b, 'beto')])
    : [];
  const inicio = await b.evaluate(() => ({ ...window.__crear.avatar }));
  await ir(b, -7, inicio.z, true);
  await a.waitForFunction(() => window.__vivo.fuente.personas()[0].x < -6);
  await a.waitForFunction(() => !window.__vivo.fuente.instantanea().cercanos.some((p) => p.oyendo));
  const fuera1 = await bytesAudio(a);
  await a.waitForTimeout(1400);
  const fuera2 = await bytesAudio(a);
  assert(fuera2 - fuera1 < 1000, `Audio siguió recibiendo lejos: ${fuera1} → ${fuera2}`);
  resultados.bytesLejos = { fuera1, fuera2 };
  resultados.audioLejos = true;
  resultados.movimientoB = true;
  console.log('movimiento B y audio lejos');
  await ir(b, inicio.x - 1.4, inicio.z, true);
  await a.waitForFunction(() => !!document.querySelector('audio[data-presencia-audio]'));
  await b.keyboard.press('Space');
  await a.waitForFunction(() => window.__vivo.fuente.personas()[0].saltos > 0);
  resultados.salto = true;
  await ir(a, inicio.x - 3, inicio.z, true);
  await b.waitForFunction(() => window.__vivo.fuente.personas()[0].x < 2);
  resultados.movimientoA = true;
  // @mención desde lejos: la misma respuesta SSE cruza el canal fiable.
  await a.locator('#ev-texto').fill('@Nova Hola, equipo');
  await a.locator('.ev-hablar button[type="submit"], .ev-hablar button').first().click();
  await b.waitForFunction(() => window.__vivo.burbuja?.fase === 'fin');
  assert.match(await b.evaluate(() => window.__vivo.burbuja.texto), /respuesta simulada/);
  resultados.agenteCompartido = true;
  console.log('agente', await a.evaluate(() => window.__crear.mundo('ag-1')));
  // Acercarse al agente y E usa la misma acción del motor.
  const ag = await a.evaluate(() => window.__crear.mundo('ag-1'));
  if (ag) {
    await ir(a, -9.5, inicio.z, true);
    await ir(a, -9.5, -6.64, true);
    await ir(a, ag.x, -6.64, true);
    await ir(a, ag.x, -6.75, false);
    await a.waitForTimeout(700);
    console.log(
      'acción antes de E',
      await a.evaluate(() => ({
        accion: window.__crear.accion()?.tipo,
        avatar: window.__crear.avatar,
      })),
    );
    await a.keyboard.press('e');
    await a.waitForFunction(() =>
      document.querySelector('#ev-texto')?.placeholder.startsWith('Escríbele a Nova'),
    );
    resultados.hablarConE = true;
  }
  await a.locator('#ev-texto').fill('¿En qué me ayudas?');
  await a.getByRole('button', { name: 'Enviar', exact: true }).click();
  await a.waitForTimeout(1800);
  await b.waitForFunction(
    () => window.__vivo.burbuja?.fase === 'fin' && window.__vivo.burbuja.texto.includes('ayudas'),
  );
  // B observa la burbuja desde el mismo lugar, no solo el estado recibido.
  if (ag) {
    await ir(b, -9.5, inicio.z, true);
    await ir(b, -9.5, -6.64, true);
    await ir(b, ag.x + 1.6, -6.64, true);
  }
  await capturas(a, 'conversacion');
  await capturas(b, 'conversacion-invitado');
  // Las sillas de los bancos están reservadas a los agentes. Usa un asiento libre del descanso.
  const asiento = await b.evaluate(() =>
    window.__crear.asientos().find((a) => a.x > 8 && a.z > 3 && (a.y ?? 0) < 1),
  );
  assert(asiento, 'Debe existir un asiento libre en el descanso');
  await ir(b, -9.5, -6.64, true);
  await ir(b, -9.5, inicio.z, true);
  await ir(b, inicio.x, inicio.z, true);
  await ir(b, asiento.aproximacion.x, asiento.aproximacion.z, true);
  await b.waitForTimeout(700);
  console.log('acción antes de sentarse', await b.evaluate(() => window.__crear.accion()?.tipo));
  await b.keyboard.press('e');
  await b.waitForFunction(() => window.__crear.avatar.estado === 'sentado');
  await a.waitForFunction(() => window.__vivo.fuente.personas()[0]?.estado === 'sentado');
  resultados.sentarse = true;
  await capturas(a, 'postura-remota');
  await Promise.all(parar.map((f) => f()));
  await b.close();
  await a.waitForFunction(() => window.__vivo.fuente.personas().length === 0);
  resultados.salida = true;
  await a.getByRole('button', { name: 'Silenciar mi voz' }).click();
  assert.equal(await a.evaluate(() => window.__vivo.fuente.instantanea().silenciadoPropio), true);
  resultados.silencio = true;
  // El rechazo real se prueba sin fake-ui en resiliencia-envivo.mjs.
  assert.deepEqual(errores, []);
  console.log(JSON.stringify({ resultados, errores }, null, 2));
  if (process.argv.includes('--video'))
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      `${salida}/ana.webm`,
      '-i',
      `${salida}/beto.webm`,
      '-filter_complex',
      '[0:v]fps=60,scale=960:600,setsar=1[a];[1:v]fps=60,scale=960:600,setsar=1[b];[a][b]hstack=inputs=2[v]',
      '-map',
      '[v]',
      '-c:v',
      'libx264',
      '-threads',
      '4',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '60',
      '-fps_mode',
      'cfr',
      `${salida}/sala-en-vivo-60fps.mp4`,
    ]);
} catch (e) {
  resultados.fallo = e.stack;
  console.error(e);
  process.exitCode = 1;
} finally {
  writeFileSync(`${salida}/resultado.json`, JSON.stringify({ resultados, errores }, null, 2));
  await browser.close();
}
