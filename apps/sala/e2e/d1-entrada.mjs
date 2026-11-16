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
const tiempos = [];
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
    window.__capturasMicrofono = 0;
    const capturar = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (...args) => {
      window.__capturasMicrofono++;
      return capturar(...args);
    };
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
async function nombre(p, texto, rapido = false) {
  await p.locator('#fl-nombre').fill(texto);
  await p.keyboard.press('Enter');
  if (rapido) {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
      [320, 640],
    ]) {
      await p.setViewportSize({ width, height });
      await p.locator('.pv-panel').waitFor({ state: 'visible' });
      await p.locator('.pv-opcion img').first().waitFor({ state: 'visible' });
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${salida}/personaje-${width}.png` });
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await p.setViewportSize({ width: 1440, height: 900 });
  }
  await p.getByRole('button', { name: rapido ? 'Entrar ya' : /Este soy yo/ }).click();
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
  for (const [i, n] of ['Beto', 'Carla'].entries()) {
    const invitado = await perfil();
    const url = new URL(enlace);
    // El tercer invitado intenta proclamarse dueño al editar el enlace.
    if (i === 2) url.searchParams.set('dueno', 'intruso');
    await invitado.p.goto(url.href);
    await nombre(invitado.p, n, i === 1);
    await llave(invitado.p);
    await conectado(invitado.p);
    await invitado.p.waitForFunction(() => window.__vivo.recibida);
    assert.equal(await invitado.p.evaluate(() => window.__vivo.sesion.invitado), true);
    await invitado.p.waitForFunction(
      () => performance.getEntriesByName('d1-enlace-hasta-dentro').length > 0,
    );
    tiempos.push(
      await invitado.p.evaluate(
        () => performance.getEntriesByName('d1-enlace-hasta-dentro')[0].duration,
      ),
    );
    invitados.push(invitado);
    console.log(`Invitado ${n} conectado`);
  }
  const paginas = [a, ...invitados.map((x) => x.p)];
  for (const p of paginas)
    await p.waitForFunction(() => window.__vivo.fuente.personas().length === 2, null, {
      timeout: 30000,
    });
  resultados.tresPerfiles = true;
  console.log('Tres perfiles presentes');
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
  resultados.entradaMs = tiempos;
  if (process.env.DEMO_SIN_VOZ_PRUEBA !== '0') {
    for (const p of paginas) {
      assert.equal(await p.getByRole('button', { name: 'Usar mi voz' }).count(), 0);
      await p.evaluate(() => window.__vivo.fuente.activarMicrofono());
      assert.equal(await p.evaluate(() => window.__capturasMicrofono), 0);
      assert.equal(await p.locator('audio[data-presencia-audio]').count(), 0);
      const rtp = await audio(p);
      assert.equal(rtp.pistasSalientes, 0);
      assert.equal(rtp.pistasEntrantes, 0);
    }
    // Un cliente de prueba sin el adaptador publica audio junto al anfitrión.
    const modulo =
      '/@fs' + new URL('../../../packages/presencia/src/index.ts', import.meta.url).pathname;
    await a.evaluate(async (modulo) => {
      const { crearFuenteLiveKit } = await import(modulo);
      const pase = await fetch('http://localhost:5372/api/pases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sala: window.__vivo.sesion.sala,
          identidad: crypto.randomUUID(),
          nombre: 'Audio de prueba',
          llaveDemo: sessionStorage.getItem('demo/llave'),
        }),
      }).then((r) => r.json());
      const fuente = crearFuenteLiveKit({
        url: 'ws://127.0.0.1:7880',
        rtcConfig: { iceServers: [] },
        obtenerToken: async () => pase.token,
        yo: {
          id: pase.identidad,
          nombre: 'Audio de prueba',
          atuendo: window.__crear.sala().ocupantes[0].atuendo,
          escenario: 'sala-en-vivo',
        },
      });
      window.__publicadorPrueba = fuente;
      await fuente.conectar();
      fuente.publicarPropio({ ...window.__crear.avatar, rumbo: 0, saltos: 0, asiento: null });
      await fuente.activarMicrofono();
    }, modulo);
    await a.waitForTimeout(1500);
    assert((await audio(a)).enviados > 0, 'El cliente de prueba publica audio real');
    for (const p of paginas) {
      assert.equal(await p.locator('audio[data-presencia-audio]').count(), 0);
      assert.equal((await audio(p)).pistasEntrantes, 0);
    }
    await a.evaluate(() => window.__publicadorPrueba.desconectar());
    resultados.sinVoz = {
      sinCaptura: true,
      sinPublicacion: true,
      sinSuscripcionInclusoConEmisorActivo: true,
    };
  } else {
    for (const p of paginas) {
      await p.getByRole('button', { name: 'Usar mi voz' }).click();
      await p.getByRole('button', { name: 'Permitir micrófono' }).click();
    }
    await a.waitForTimeout(2000);
    const antes = await Promise.all(paginas.map(audio));
    await a.waitForTimeout(1500);
    const despues = await Promise.all(paginas.map(audio));
    despues.forEach((s, i) => {
      assert(s.enviados > antes[i].enviados);
      assert(s.recibidos > antes[i].recibidos);
    });
    resultados.vozHabitual = { antes, despues };
  }
  const recarga = invitados[1].p;
  await recarga.reload();
  await nombre(recarga, 'Carla');
  await conectado(recarga);
  await recarga.waitForFunction(() => window.__vivo.recibida);
  assert.equal(await recarga.getByRole('button', { name: 'Entrar con la llave' }).count(), 0);
  assert.equal(
    await recarga.evaluate(() => sessionStorage.getItem('demo/llave')),
    process.env.DEMO_LLAVE_PRUEBA,
  );
  assert.equal(
    await recarga.evaluate(() => Object.keys(localStorage).some((k) => /llave/.test(k))),
    false,
  );
  assert.equal(
    await recarga.evaluate(() =>
      sessionStorage.getItem(`demo/anfitrion/${window.__vivo.sesion.sala}`),
    ),
    'Ana',
  );
  assert(
    await recarga.evaluate(() =>
      Boolean(sessionStorage.getItem(`demo/nombre/${window.__vivo.sesion.sala}`)),
    ),
  );
  resultados.llaveEnPestana = true;
  await captura(a, 'tres-personas');
  await b.setViewportSize({ width: 390, height: 844 });
  await b.waitForTimeout(1200);
  assert.equal(await b.locator('#ev-texto').isVisible(), false, 'Chat plegado al entrar en móvil');
  assert(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await captura(b, 'telefono-390');
  const salaOriginal = await a.evaluate(() => window.__vivo.sesion.sala);
  await a.getByRole('button', { name: 'Mis salas' }).click();
  await a
    .getByRole('button', { name: /^Entrar a / })
    .first()
    .click();
  await conectado(a);
  assert.equal(await a.evaluate(() => window.__vivo.sesion.sala), salaOriginal);
  const nombreOriginal = await a.evaluate(() => window.__crear.sala().nombre);
  await a.getByRole('button', { name: 'Mis salas' }).click();
  await a.getByRole('button', { name: 'Crear una sala nueva' }).click();
  await a.keyboard.press('Enter');
  await nombre(a, 'Otra');
  await a.keyboard.press('Enter');
  await conectado(a);
  const salaSegunda = await a.evaluate(() => window.__vivo.sesion.sala);
  assert.notEqual(salaSegunda, salaOriginal);
  await a.getByRole('button', { name: /Volver al paso anterior/ }).click();
  await a.keyboard.press('Enter');
  await conectado(a);
  assert.equal(await a.evaluate(() => window.__vivo.sesion.sala), salaSegunda);
  await a.getByRole('button', { name: /Entrar a la sala/ }).click();
  await a.waitForTimeout(600);
  await a.getByRole('button', { name: 'Mis salas' }).click();
  await a.getByRole('button', { name: /Mis salas/ }).click();
  await a.getByRole('button', { name: `Entrar a ${nombreOriginal}`, exact: true }).click();
  await conectado(a);
  assert.equal(await a.evaluate(() => window.__vivo.sesion.sala), salaOriginal);
  resultados.dosSalasYRepetirInvitar = true;
  await a.close();
  await b.getByText(/el anfitrión salió/i).waitFor({ timeout: 15000 });
  assert(
    await b.evaluate(() => window.__crear.sala().mundo.objetos.some((o) => o.id === 'demo-planta')),
  );
  await captura(b, 'anfitrion-ausente');
  // Regreso por portada en pestaña nueva: no usa el enlace de invitación.
  const regreso = await pagina(anfitrion.c);
  await regreso.goto(`${base}/crear.html`);
  await regreso.waitForLoadState('networkidle');
  await regreso
    .getByRole('button', { name: /^Entrar a / })
    .first()
    .click();
  await llave(regreso);
  await conectado(regreso);
  assert.equal(await regreso.evaluate(() => window.__vivo.sesion.invitado), false);
  assert.equal(await regreso.evaluate(() => window.__vivo.sesion.sala), salaOriginal);
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
  writeFileSync(
    `${salida}/${process.env.DEMO_SIN_VOZ_PRUEBA === '0' ? 'voz-habitual' : 'resultado'}.json`,
    JSON.stringify({ resultados, errores }, null, 2),
  );
  await navegador.close();
}
