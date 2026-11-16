import { chromium } from 'playwright';

export const BASE = process.env.SALA_URL ?? 'http://localhost:5328';

export const ARGS = [
  '--enable-gpu',
  '--ignore-gpu-blocklist',
  '--use-angle=metal',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
];

export const lanzar = (opciones = {}) =>
  chromium.launch({ channel: 'chrome', headless: true, args: ARGS, ...opciones });

/** Registra cada RTCPeerConnection de la página para medir bytes reales de la conexión. */
const GUION_PCS = () => {
  window.__pcs = [];
  const Original = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...a) {
    const pc = new Original(...a);
    window.__pcs.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Original.prototype;
};

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Abre un cliente (contexto propio) y espera a estar conectado. */
export async function abrirCliente(
  navegador,
  {
    nombre,
    sala = 'prueba',
    escenario = 'trading',
    medir = true,
    ancho = 640,
    alto = 400,
    rol = 'Backend',
    red = '',
    calidad = '',
  },
) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    permissions: ['microphone'],
  });
  await contexto.addInitScript(GUION_PCS);
  const pagina = await contexto.newPage();
  const logs = [];
  pagina.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`);
  });
  pagina.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  const q = new URLSearchParams({
    nombre,
    sala,
    escenario,
    rol,
    ...(medir ? { medir: '1' } : {}),
    ...(red ? { red } : {}),
    ...(calidad ? { calidad } : {}),
  });
  await pagina.goto(`${BASE}/?${q}`);
  await pagina.waitForFunction(
    () => window.__sala?.fuente?.instantanea().conexion === 'conectado',
    null,
    { timeout: 30_000 },
  );
  return { contexto, pagina, logs, nombre };
}

/** Espera a que el cliente vea `n` personas remotas. */
export const esperarPersonas = (c, n, timeout = 30_000) =>
  c.pagina.waitForFunction((n) => window.__sala.fuente.personas().length === n, n, { timeout });

export const yo = (c) => c.pagina.evaluate(() => ({ ...window.__sala.yo }));
export const remotos = (c) =>
  c.pagina.evaluate(() =>
    window.__sala.fuente.personas().map((p) => ({
      id: p.id,
      nombre: p.nombre,
      x: p.x,
      y: p.y,
      z: p.z,
      estado: p.estado,
      saltos: p.saltos,
    })),
  );

/** Pide ir a (x, z) y espera a llegar (o `ms` como tope). */
export async function irA(c, x, z, ms = 25_000) {
  await c.pagina.evaluate(([x, z]) => window.__sala.ir(x, z), [x, z]);
  try {
    await c.pagina.waitForFunction(
      ([x, z]) => Math.hypot(window.__sala.yo.x - x, window.__sala.yo.z - z) < 0.7,
      [x, z],
      { timeout: ms },
    );
  } catch {
    // El destino puede estar bloqueado: se sigue con donde quedó.
  }
}

/** Nivel de audio (RMS máximo) que suena en los <audio> de la página durante `ms`. */
export function nivelAudio(c, ms = 3000) {
  return c.pagina.evaluate(async (ms) => {
    const els = [...document.querySelectorAll('audio[data-presencia-audio]')];
    if (els.length === 0) return { elementos: 0, rms: 0 };
    const ctx = new AudioContext();
    await ctx.resume();
    const analizadores = els
      .map((el) => el.srcObject)
      .filter(Boolean)
      .map((flujo) => {
        const fuente = ctx.createMediaStreamSource(flujo);
        const an = ctx.createAnalyser();
        an.fftSize = 2048;
        fuente.connect(an);
        return an;
      });
    const buf = new Float32Array(2048);
    let max = 0;
    const fin = performance.now() + ms;
    while (performance.now() < fin) {
      for (const an of analizadores) {
        an.getFloatTimeDomainData(buf);
        let s = 0;
        for (const v of buf) s += v * v;
        max = Math.max(max, Math.sqrt(s / buf.length));
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    await ctx.close();
    return { elementos: els.length, rms: max };
  }, ms);
}

export const instantanea = (c) =>
  c.pagina.evaluate(() => {
    const f = window.__sala.fuente.instantanea();
    return {
      conexion: f.conexion,
      microfono: f.microfono,
      cercanos: f.cercanos.map((x) => ({
        id: x.id,
        nombre: x.nombre,
        oyendo: x.oyendo,
        d: +x.distancia.toFixed(2),
      })),
    };
  });

/** Cliente ligero (sin dibujar) para medir escala: misma fuente y mismo paquete que la sala. */
export async function abrirLigero(
  navegador,
  { nombre, sala, limites, red, escenario = 'trading' },
) {
  const contexto = await navegador.newContext({ viewport: { width: 200, height: 120 } });
  await contexto.addInitScript(GUION_PCS);
  const pagina = await contexto.newPage();
  const q = new URLSearchParams({
    nombre,
    sala,
    escenario,
    medir: '1',
    limites: limites.join(','),
    ...(red ? { red } : {}),
  });
  await pagina.goto(`${BASE}/lite.html?${q}`);
  await pagina.waitForFunction(
    () => window.__sala?.fuente?.instantanea().conexion === 'conectado',
    null,
    { timeout: 60_000 },
  );
  return { contexto, pagina, logs: [], nombre };
}

/** Bytes del transporte (suma de todas las conexiones) y métricas de la fuente. */
export const leerContadores = (c) =>
  c.pagina.evaluate(async () => {
    let bytesEnviados = 0;
    let bytesRecibidos = 0;
    for (const pc of window.__pcs) {
      const stats = await pc.getStats();
      stats.forEach((r) => {
        if (r.type === 'transport') {
          bytesEnviados += r.bytesSent ?? 0;
          bytesRecibidos += r.bytesReceived ?? 0;
        }
      });
    }
    const m = window.__sala.fuente.metricas();
    return {
      bytesEnviados,
      bytesRecibidos,
      paquetesEnviados: m.paquetesEnviados,
      paquetesRecibidos: m.paquetesRecibidos,
      paquetesViejos: m.paquetesViejos,
      paquetesDescartados: m.paquetesDescartados,
      erroresEnvio: m.erroresEnvio,
      personas: window.__sala.fuente.personas().length,
    };
  });

/** Tiempo de CPU del hilo principal de la página (s) según Chrome, para sacar el uso entre dos instantes. */
export async function abrirCpu(c) {
  const cdp = await c.contexto.newCDPSession(c.pagina);
  await cdp.send('Performance.enable');
  return async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    const v = (n) => metrics.find((m) => m.name === n)?.value ?? 0;
    return { tarea: v('TaskDuration'), script: v('ScriptDuration') };
  };
}

export const envios = (c) =>
  c.pagina.evaluate(() => ({
    id: window.__sala.id,
    envios: window.__sala.fuente.metricas().envios,
  }));
export const llegadas = (c) =>
  c.pagina.evaluate(() => ({
    id: window.__sala.id,
    llegadas: window.__sala.fuente.metricas().llegadas,
  }));

/** Percentil (0..1) de una lista de números. */
export const percentil = (xs, p) => {
  if (xs.length === 0) return NaN;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor(p * o.length))];
};

/** Hace que el cliente (completo o ligero) pasee solo: destinos al azar, a veces corriendo, y saltos. */
export const pasearSolo = (c, limites) =>
  c.pagina.evaluate((l) => {
    if (!window.__sala.ir) return; // el ligero ya pasea solo
    const azar = (a, b) => a + Math.random() * (b - a);
    setInterval(
      () => window.__sala.ir(azar(l[0], l[1]), azar(l[2], l[3]), undefined, Math.random() < 0.3),
      4000,
    );
    setInterval(() => window.__sala.saltar(), 6500);
  }, limites);

/** Sale de la sala con gracia (así los demás lo dejan de ver al instante) y cierra el contexto. */
export async function cerrar(c) {
  await c.pagina.evaluate(() => window.__sala?.fuente.desconectar()).catch(() => undefined);
  await c.contexto.close().catch(() => undefined);
}
