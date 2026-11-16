// Comparación controlada: conexión al entrar (comportamiento anterior) frente a precargar en personaje.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ARGS } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const base = process.env.DEMO_URL ?? 'http://localhost:5371';
const salida =
  process.env.DEMO_CAPTURAS ?? `${process.env.HOME}/Desktop/oficina-producto/demo-noche/d1`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ARGS });
const resultados = {};
try {
  const creada = await fetch('http://localhost:5372/api/salas', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ llaveDemo: 'prueba-d1' }),
  }).then((r) => r.json());
  assert(creada.sala);
  const enlace = `${base}/crear.html?sala=${creada.sala}`;
  const dueno = await browser.newContext();
  await dueno.addInitScript(({ sala, secretoDueno }) => {
    localStorage.setItem(`demo/dueno/${sala}`, secretoDueno);
    sessionStorage.setItem('demo/llave', 'prueba-d1');
  }, creada);
  const a = await dueno.newPage();
  await a.goto(enlace);
  await a.locator('#fl-nombre').fill('Anfitrión');
  await a.keyboard.press('Enter');
  await a.waitForFunction(() => window.__vivo?.fuente?.instantanea().conexion === 'conectado');
  for (const anterior of [true, false, true, false]) {
    const contexto = await browser.newContext();
    await contexto.addInitScript(() => sessionStorage.setItem('demo/llave', 'prueba-d1'));
    const p = await contexto.newPage();
    if (anterior)
      await p.route('**/api/salud', async (route) => {
        await p.waitForFunction(() => window.__crear?.paso() === 'dentro');
        await route.continue();
      });
    await p.goto(enlace);
    await p.locator('#fl-nombre').fill('Invitado');
    await p.keyboard.press('Enter');
    // Misma pausa de selección para ambos casos; mide además el tiempo después del clic final.
    await p.getByRole('button', { name: 'Entrar ya' }).waitFor();
    await p.waitForTimeout(1000);
    const clic = await p.evaluate(() => performance.now());
    await p.getByRole('button', { name: 'Entrar ya' }).click();
    await p.waitForFunction(
      () => performance.getEntriesByName('d1-enlace-hasta-dentro').length > 0,
    );
    const dentro = await p.evaluate(
      () => performance.getEntriesByName('d1-enlace-hasta-dentro')[0].duration,
    );
    const modo = anterior ? 'conexionAlEntrarSimulada' : 'conexionEnPersonaje';
    (resultados[modo] ??= []).push({ totalMs: dentro, despuesDelClicMs: dentro - clic });
    await contexto.close();
  }
  console.log(JSON.stringify(resultados));
} finally {
  writeFileSync(`${salida}/tiempos.json`, JSON.stringify(resultados, null, 2));
  await browser.close();
}
