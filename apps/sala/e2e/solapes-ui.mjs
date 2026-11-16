// Comprueba que los controles fijos de la sala no se intersectan (rectángulos en pantalla),
// como dueño e invitado, en 1440, 1024, 390 y 320, y con el teclado del teléfono abierto.
// Requiere la sala en vivo configurada: DEMO_URL (página), DEMO_LLAVE_PRUEBA (si el emisor pide llave).
// Uso: DEMO_URL=http://127.0.0.1:5341 node apps/sala/e2e/solapes-ui.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { ARGS } from './lib.mjs';

const base = process.env.DEMO_URL ?? 'http://127.0.0.1:5369';
const salida =
  process.env.DEMO_CAPTURAS ?? `${process.env.HOME}/Desktop/oficina-producto/solapes-ui`;
mkdirSync(salida, { recursive: true });

/** Controles que comparten pantalla; cada tarea nueva de interfaz agrega aquí el suyo. */
export const CONTROLES = [
  '.cr-portada',
  '.cr-chip-sala',
  '.cr-esquina-sup',
  '.cr-misiones',
  '.ev-presencia',
  '.d2-controles',
  '.d2-panel-voto',
  '.d2-reacciones',
  '.d3-barra',
  '.ev-hablar',
  '.ev-abrir-chat',
  '.esc-accion',
  '.cr-palanca',
  '.cr-botones-tactiles',
];
const TAMANOS = [
  { ancho: 1440, alto: 900, tactil: false },
  { ancho: 1024, alto: 768, tactil: false },
  { ancho: 390, alto: 844, tactil: true },
  { ancho: 320, alto: 640, tactil: true },
];

async function solapes(p) {
  return p.evaluate((selectores) => {
    const visibles = [];
    for (const sel of selectores)
      for (const e of document.querySelectorAll(sel)) {
        const s = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) continue;
        if (r.width < 2 || r.height < 2) continue;
        visibles.push({ sel, e, r });
      }
    const pares = [];
    for (let i = 0; i < visibles.length; i++)
      for (let j = i + 1; j < visibles.length; j++) {
        const a = visibles[i];
        const b = visibles[j];
        if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
        const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (x > 1 && y > 1) pares.push(`${a.sel} × ${b.sel}`);
      }
    const fuera = visibles
      .filter(
        (v) =>
          v.r.left < -1 ||
          v.r.top < -1 ||
          v.r.right > innerWidth + 1 ||
          v.r.bottom > innerHeight + 1,
      )
      .map((v) => `${v.sel} fuera de la ventana`);
    return [...pares, ...fuera];
  }, CONTROLES);
}
async function entrar(p, nombre) {
  await p.locator('#fl-nombre').fill(nombre);
  await p.keyboard.press('Enter');
  await p
    .getByRole('button', { name: /Este soy yo|Entrar ya/ })
    .first()
    .click();
}
async function llave(p) {
  if (!process.env.DEMO_LLAVE_PRUEBA) return;
  const c = p.getByLabel('Llave de demo (si te la compartieron)');
  if (
    await c.waitFor({ timeout: 8000 }).then(
      () => true,
      () => false,
    )
  ) {
    await c.fill(process.env.DEMO_LLAVE_PRUEBA);
    await p.getByRole('button', { name: 'Entrar con la llave' }).click();
  }
}
const conectado = (p) =>
  p.waitForFunction(() => window.__vivo?.fuente?.instantanea().conexion === 'conectado', null, {
    timeout: 45000,
  });

const navegador = await chromium.launch({ channel: 'chrome', headless: true, args: ARGS });
const fallos = [];
try {
  for (const t of TAMANOS) {
    const opciones = {
      viewport: { width: t.ancho, height: t.alto },
      hasTouch: t.tactil,
      isMobile: t.tactil,
    };
    const ca = await navegador.newContext(opciones);
    const a = await ca.newPage();
    a.setDefaultTimeout(45000);
    await a.goto(`${base}/crear.html`);
    await a.getByRole('button', { name: /Crear mi sala/ }).click({ timeout: 60000 });
    await a.locator('.cr-mundos-miniaturas button[aria-label="Auditorio"]').click();
    await a.keyboard.press('Enter');
    await entrar(a, 'Ana');
    await a.keyboard.press('Enter');
    await llave(a);
    await a.waitForFunction(() => document.querySelector('#fl-enlace')?.value.includes('sala='));
    const enlace = await a.locator('#fl-enlace').inputValue();
    await a.getByRole('button', { name: /Entrar a la sala/ }).click();
    await conectado(a);
    // Pantalla puesta (para que el invitado vea «Ver pantalla») y aviso «E sentarse» a la vista.
    await a.evaluate(() => window.__crear.ir(0, -5.7, false));
    await a.waitForTimeout(4500);
    await a.getByRole('button', { name: 'Presentar', exact: true }).click();
    await a.getByRole('button', { name: 'Poner pantalla aquí', exact: true }).click();
    await a
      .getByRole('button', { name: 'Cerrar presentación' })
      .click()
      .catch(() => undefined);
    const butaca = (await a.evaluate(() => window.__crear.asientos())).find((s) => s.z > 3);
    await a.evaluate((b) => window.__crear.ir(b.aproximacion.x, b.aproximacion.z, false), butaca);
    await a.waitForTimeout(6000);
    const ci = await navegador.newContext(opciones);
    const g = await ci.newPage();
    g.setDefaultTimeout(45000);
    await g.goto(enlace);
    await entrar(g, 'Beto');
    await llave(g);
    await conectado(g);
    await g.waitForTimeout(2500);
    for (const [rol, p] of [
      ['dueno', a],
      ['invitado', g],
    ]) {
      const nombre = `${t.ancho}-${rol}`;
      const s = await solapes(p);
      await p.screenshot({ path: `${salida}/${nombre}.png` });
      if (s.length) fallos.push(`${nombre}: ${s.join(', ')}`);
      if (t.tactil) {
        // Teclado en pantalla: abre el chat y reduce el alto visible.
        await p
          .getByRole('button', { name: 'Hablar con agentes' })
          .click()
          .catch(() => undefined);
        await p.setViewportSize({ width: t.ancho, height: Math.round(t.alto * 0.55) });
        await p.waitForTimeout(400);
        const k = await solapes(p);
        await p.screenshot({ path: `${salida}/${nombre}-teclado.png` });
        if (k.length) fallos.push(`${nombre}-teclado: ${k.join(', ')}`);
        await p.setViewportSize({ width: t.ancho, height: t.alto });
      }
    }
    await ci.close();
    await ca.close();
  }
} finally {
  await navegador.close();
}
console.log(fallos.length ? `SOLAPES\n${fallos.join('\n')}` : 'SIN SOLAPES');
process.exitCode = fallos.length ? 1 : 0;
