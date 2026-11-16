// Ejecutar con el emisor público y Vite configurados en los puertos reservados del encargo.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { ARGS } from './lib.mjs';

const base = process.env.DEMO_URL ?? 'http://localhost:5369';
const salida =
  process.env.DEMO_CAPTURAS ?? `${process.env.HOME}/Desktop/oficina-producto/demo-en-vivo`;
mkdirSync(salida, { recursive: true });
const navegador = await chromium.launch({ channel: 'chrome', headless: true, args: ARGS });
const resultados = {};
const errores = [];
async function pagina(contexto) {
  const p = await contexto.newPage();
  p.setDefaultTimeout(45000);
  p.on('pageerror', (e) => errores.push(e.message));
  return p;
}
async function perfil() {
  const c = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone'],
  });
  await c.addInitScript(() => {
    window.__pcs = [];
    const Original = window.RTCPeerConnection;
    window.RTCPeerConnection = function (...args) {
      const pc = new Original(...args);
      window.__pcs.push(pc);
      return pc;
    };
    window.RTCPeerConnection.prototype = Original.prototype;
  });
  return { c, p: await pagina(c) };
}
const conectado = (p) =>
  p.waitForFunction(() => window.__vivo?.fuente?.instantanea().conexion === 'conectado', null, {
    timeout: 45000,
  });
async function nombre(p, texto) {
  await p.locator('#fl-nombre').fill(texto);
  await p.keyboard.press('Enter');
  await p.getByRole('button', { name: /Este soy yo/ }).click();
}
async function llave(p) {
  if (!process.env.DEMO_LLAVE_PRUEBA) return;
  await p.getByLabel('Llave de demo (si te la compartieron)').fill(process.env.DEMO_LLAVE_PRUEBA);
  await p.getByRole('button', { name: 'Entrar con la llave' }).click();
}
async function audio(p) {
  return p.evaluate(async () => {
    const total = { enviados: 0, recibidos: 0, pistasSalientes: 0, pistasEntrantes: 0 };
    for (const pc of window.__pcs)
      for (const s of (await pc.getStats()).values()) {
        if (s.kind !== 'audio') continue;
        if (s.type === 'outbound-rtp') {
          total.enviados += s.bytesSent ?? 0;
          total.pistasSalientes++;
        }
        if (s.type === 'inbound-rtp') {
          total.recibidos += s.bytesReceived ?? 0;
          total.pistasEntrantes++;
        }
      }
    return total;
  });
}
async function captura(p, nombre) {
  await p.screenshot({ path: `${salida}/${nombre}.png` });
}
try {
  const anfitrion = await perfil();
  const a = anfitrion.p;
  await a.goto(`${base}/crear.html`);
  await a.waitForLoadState('networkidle');
  await a.getByRole('button', { name: /Crear mi sala/ }).click({ timeout: 60000 });
  await a.keyboard.press('Enter');
  await nombre(a, 'Ana');
  await a.keyboard.press('Enter');
  await a.locator('#fl-enlace').waitFor();
  await llave(a);
  await a.waitForFunction(() => document.querySelector('#fl-enlace')?.value.includes('sala='));
  const enlace = await a.locator('#fl-enlace').inputValue();
  assert(!enlace.includes('secreto'), 'El enlace no contiene la capacidad del dueño');
  await a.getByRole('button', { name: /Entrar a la sala/ }).click();
  await conectado(a);
  console.log('Anfitrión conectado');
  assert.equal(await a.evaluate(() => window.__vivo.sesion.invitado), false);
  const invitados = [];
  for (const [i, n] of ['Beto', 'Carla', 'Diego'].entries()) {
    const invitado = await perfil();
    const url = new URL(enlace);
    // El tercer invitado intenta proclamarse dueño al editar el enlace.
    if (i === 2) url.searchParams.set('dueno', 'intruso');
    await invitado.p.goto(url.href);
    await nombre(invitado.p, n);
    await llave(invitado.p);
    await conectado(invitado.p);
    await invitado.p.waitForFunction(() => window.__vivo.recibida);
    assert.equal(await invitado.p.evaluate(() => window.__vivo.sesion.invitado), true);
    invitados.push(invitado);
    console.log(`Invitado ${n} conectado`);
  }
  const paginas = [a, ...invitados.map((x) => x.p)];
  for (const p of paginas)
    await p.waitForFunction(() => window.__vivo.fuente.personas().length === 3, null, {
      timeout: 30000,
    });
  resultados.cuatroPerfiles = true;
  console.log('Cuatro perfiles presentes');
  const b = invitados[0].p;
  const idB = await b.evaluate(() => window.__vivo.sesion.yo);
  const inicio = await b.evaluate(() => ({ ...window.__crear.avatar }));
  await b.evaluate(({ x, z }) => window.__crear.ir(x - 2, z, true), inicio);
  await a.waitForFunction(
    ({ idB, x }) => window.__vivo.fuente.personas().some((p) => p.id === idB && p.x < x - 1),
    { idB, x: inicio.x },
  );
  resultados.movimiento = true;
  // Cada perfil mueve su avatar y los otros tres reciben su nueva posición.
  for (const p of paginas) {
    const propio = await p.evaluate(() => ({
      id: window.__vivo.sesion.yo,
      x: window.__crear.avatar.x,
      z: window.__crear.avatar.z,
    }));
    await p.evaluate(({ x, z }) => window.__crear.ir(x - 1, z, true), propio);
    for (const otro of paginas.filter((q) => q !== p))
      await otro.waitForFunction(
        ({ id, x }) => window.__vivo.fuente.personas().some((q) => q.id === id && q.x < x - 0.5),
        propio,
      );
  }
  console.log('Movimiento remoto comprobado');
  await a.evaluate(() => window.__crear.entrarConstruir());
  await a.waitForFunction(() => window.__crear.construyendo());
  await a.evaluate(() =>
    window.__crear.colocarObjetos([
      { id: 'demo-planta', tipo: 'planta-grande', x: -10, z: 5, giro: 0 },
    ]),
  );
  await a.keyboard.press('Escape');
  for (const p of paginas.slice(1))
    await p.waitForFunction(() =>
      window.__crear.sala().mundo.objetos.some((o) => o.id === 'demo-planta'),
    );
  for (const p of paginas.slice(1)) {
    await p.evaluate(() => window.__crear.entrarConstruir());
    assert.equal(await p.evaluate(() => window.__crear.construyendo()), false);
  }
  resultados.construccionYRol = true;
  await b.evaluate(async () => {
    const sala = structuredClone(window.__crear.sala());
    sala.nombre = 'Mundo intruso';
    await window.__vivo.fuente.enviarDatos(
      JSON.stringify({
        tipo: 'mundo',
        revision: Number.MAX_SAFE_INTEGER,
        sala,
      }),
    );
  });
  await a.waitForTimeout(800);
  for (const p of paginas)
    assert.notEqual(await p.evaluate(() => window.__crear.sala().nombre), 'Mundo intruso');
  resultados.mundoIntrusoRechazado = true;
  console.log('Construcción compartida y rol comprobados');
  for (const p of paginas) {
    await p.getByRole('button', { name: 'Usar mi voz' }).click();
    await p.getByRole('button', { name: 'Permitir micrófono' }).click();
  }
  await a.waitForFunction(
    () => document.querySelectorAll('audio[data-presencia-audio]').length >= 1,
  );
  const antes = await Promise.all(paginas.map(audio));
  await a.waitForTimeout(2000);
  const despues = await Promise.all(paginas.map(audio));
  despues.forEach((s, i) => {
    assert(s.enviados > antes[i].enviados, `Perfil ${i}: audio publicado`);
    assert(s.recibidos > antes[i].recibidos, `Perfil ${i}: audio suscrito`);
  });
  resultados.audio = { antes, despues };
  console.log('Audio RTP enviado y recibido en los cuatro perfiles');
  await captura(a, 'cuatro-personas');
  await b.setViewportSize({ width: 390, height: 844 });
  await b.waitForTimeout(1200);
  assert.equal(await b.locator('#ev-texto').isVisible(), false, 'Chat plegado al entrar en móvil');
  assert(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await captura(b, 'telefono-390');
  await a.close();
  await b.getByText(/el anfitrión salió/i).waitFor({ timeout: 15000 });
  assert(
    await b.evaluate(() => window.__crear.sala().mundo.objetos.some((o) => o.id === 'demo-planta')),
  );
  await captura(b, 'anfitrion-ausente');
  // Conserva el almacenamiento del navegador del anfitrión, pero crea una pestaña nueva.
  const regreso = await pagina(anfitrion.c);
  await regreso.goto(enlace);
  await nombre(regreso, 'Ana');
  await regreso.keyboard.press('Enter');
  await llave(regreso);
  await regreso.getByRole('button', { name: /Entrar a la sala/ }).click();
  await conectado(regreso);
  assert.equal(await regreso.evaluate(() => window.__vivo.sesion.invitado), false);
  await regreso.evaluate(() =>
    window.__crear.colocarObjetos([
      { id: 'demo-regreso', tipo: 'planta-grande', x: -10, z: 5, giro: 0 },
    ]),
  );
  await b.waitForFunction(() =>
    window.__crear.sala().mundo.objetos.some((o) => o.id === 'demo-regreso'),
  );
  resultados.ausenciaYRegreso = true;
  await captura(regreso, 'anfitrion-regreso');
  assert.deepEqual(errores, []);
  console.log(JSON.stringify(resultados));
} catch (error) {
  for (const [i, p] of navegador
    .contexts()
    .flatMap((c) => c.pages())
    .entries()) {
    await captura(p, `fallo-${i}`).catch(() => undefined);
    console.error(
      'Diagnóstico',
      i,
      await p
        .evaluate(() => ({
          paso: window.__crear?.paso(),
          conexion: window.__vivo?.fuente?.instantanea(),
          texto: document.body.innerText.slice(-1400),
        }))
        .catch(() => 'Página cerrada'),
    );
  }
  throw error;
} finally {
  writeFileSync(`${salida}/resultado.json`, JSON.stringify({ resultados, errores }, null, 2));
  await navegador.close();
}
