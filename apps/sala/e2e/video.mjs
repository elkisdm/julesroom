// Video lado a lado a 60 fps: B corre, salta, sube una escalera y se sienta; a la izquierda lo que ve B
// (su propia pantalla) y a la derecha lo que ve A (otro navegador, otra conexión) de B.
// Uso: node e2e/video.mjs [--escenario mansion] [--salida carpeta]
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { abrirCliente, esperar, esperarPersonas, irA, lanzar, remotos, yo } from './lib.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const ESCENARIO = arg('escenario', 'mansion');
const SALIDA = arg('salida', `${process.env.HOME}/Desktop/oficina-producto/presencia/video`);
mkdirSync(SALIDA, { recursive: true });

const ANCHO = 960;
const ALTO = 600;

/** Graba el lienzo de la página con MediaRecorder a 60 fps reales (no con reloj virtual: hay red de por medio). */
async function grabar(c, archivo) {
  const ws = createWriteStream(archivo);
  await c.pagina.exposeFunction('__trozo', (b64) => ws.write(Buffer.from(b64, 'base64')));
  await c.pagina.evaluate(() => {
    const flujo = document.querySelector('canvas').captureStream(60);
    const rec = new MediaRecorder(flujo, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 12_000_000,
    });
    rec.ondataavailable = async (e) => {
      const b = new Uint8Array(await e.data.arrayBuffer());
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000)
        s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      window.__trozo(btoa(s));
    };
    rec.start(1000);
    window.__rec = rec;
  });
  return async () => {
    await c.pagina.evaluate(
      () =>
        new Promise((r) => {
          window.__rec.onstop = () => setTimeout(r, 800);
          window.__rec.stop();
        }),
    );
    ws.end();
  };
}

const navegador = await lanzar();
const trazas = [];
try {
  const sala = `video-${Date.now()}`;
  const A = await abrirCliente(navegador, {
    nombre: 'Ana',
    sala,
    escenario: ESCENARIO,
    ancho: ANCHO,
    alto: ALTO,
    medir: false,
    rol: 'Front designer',
  });
  const B = await abrirCliente(navegador, {
    nombre: 'Beto',
    sala,
    escenario: ESCENARIO,
    ancho: ANCHO,
    alto: ALTO,
    medir: false,
    rol: 'Backend',
  });
  await Promise.all([esperarPersonas(A, 1), esperarPersonas(B, 1)]);
  const esc = await B.pagina.evaluate(() => window.__sala.escenario);
  const escalera = esc.escaleras[0];
  const base = escalera.tramos[0].desde;
  const cima = escalera.tramos[escalera.tramos.length - 1].hasta;

  // Ana espera al lado de la escalera, mirando; Beto parte de la entrada.
  await irA(A, base.x - 2.6, base.z - 0.5, 20_000);
  await esperar(1500);

  const detener = await Promise.all([
    grabar(B, `${SALIDA}/b-propio.webm`),
    grabar(A, `${SALIDA}/a-ve-a-b.webm`),
  ]);
  const t0 = Date.now();
  const traza = setInterval(async () => {
    const [b, vistoPorA] = await Promise.all([yo(B), remotos(A)]);
    trazas.push({
      t: Date.now() - t0,
      b: { x: b.x, y: b.y, z: b.z, estado: b.estado },
      aVeAB: vistoPorA[0]
        ? { x: vistoPorA[0].x, y: vistoPorA[0].y, z: vistoPorA[0].z, estado: vistoPorA[0].estado }
        : null,
    });
  }, 100);

  // Ana escolta a Beto a ~2,5 m, así su cámara lo tiene siempre a la vista.
  let pisoB = 0;
  const escolta = setInterval(async () => {
    try {
      const b = await yo(B);
      if (b.estado === 'de-pie') pisoB = b.y;
      await A.pagina.evaluate(
        ([x, z, y]) => window.__sala.ir(x, z, y, false),
        [b.x - 2.4, b.z + 1.1, pisoB],
      );
    } catch {
      // La página puede estar cerrándose al final de la toma.
    }
  }, 700);
  await esperar(1500);
  // 1. Corre (doble clic: va corriendo) hasta cerca de Ana.
  await B.pagina.evaluate(
    ([x, z]) => window.__sala.ir(x, z, undefined, true),
    [base.x - 5.5, base.z - 0.5],
  );
  await esperar(3500);
  // 2. Salta dos veces.
  await B.pagina.evaluate(() => window.__sala.saltar());
  await esperar(1100);
  await B.pagina.evaluate(() => window.__sala.saltar());
  await esperar(1500);
  // 3. Corre a la escalera y la sube hasta la pasarela.
  await B.pagina.evaluate(
    ([x, z]) => window.__sala.ir(x, z, undefined, true),
    [base.x, base.z + 0.2],
  );
  await esperar(3200);
  await B.pagina.evaluate(
    ([x, z, y]) => window.__sala.ir(x, z, y, false),
    [cima.x, cima.z, cima.y],
  );
  try {
    await B.pagina.waitForFunction((y) => window.__sala.yo.y > y - 0.3, cima.y, {
      timeout: 15_000,
    });
  } catch {
    console.log('B no llegó a la cima en 15 s');
  }
  await esperar(1500);
  // 4. Baja y se sienta en el asiento más cercano del piso 1.
  const asientos = esc.acciones.filter(
    (a) => a.tipo === 'sentarse' && Math.abs((a.y ?? 0) - base.y) < 1.2,
  );
  asientos.sort(
    (p, q) => Math.hypot(p.x - base.x, p.z - base.z) - Math.hypot(q.x - base.x, q.z - base.z),
  );
  let sentado = false;
  for (const a of asientos.slice(0, 4)) {
    await B.pagina.evaluate(
      ([x, y, z]) => window.__sala.ir(x, z, y, false),
      [a.aproximacion.x, a.aproximacion.y, a.aproximacion.z],
    );
    await esperar(7000);
    await B.pagina.keyboard.press('KeyE');
    await esperar(2500);
    if ((await yo(B)).estado === 'sentado') {
      sentado = true;
      break;
    }
  }
  console.log(sentado ? 'B se sentó' : 'B no logró sentarse (sin asiento alcanzable)');
  await esperar(4000);
  clearInterval(traza);
  clearInterval(escolta);
  await Promise.all(detener.map((f) => f()));

  // Comparación de lo que llegó a A contra lo real de B (último dato recibido, sin interpolar).
  const errores = trazas
    .filter((p) => p.aVeAB)
    .map((p) => Math.hypot(p.b.x - p.aVeAB.x, p.b.z - p.aVeAB.z, p.b.y - p.aVeAB.y));
  const ord = [...errores].sort((p, q) => p - q);
  const q = (f) => ord[Math.min(ord.length - 1, Math.floor(f * ord.length))];
  const coincideEstado =
    trazas.filter((p) => p.aVeAB && p.aVeAB.estado === p.b.estado).length /
    Math.max(1, trazas.filter((p) => p.aVeAB).length);
  const resumen = {
    muestras: errores.length,
    errorMediana_m: +q(0.5).toFixed(3),
    errorP95_m: +q(0.95).toFixed(3),
    errorMax_m: +ord[ord.length - 1].toFixed(3),
    mismoEstado: +coincideEstado.toFixed(3),
    sento: sentado,
    alturaMaximaB: Math.max(...trazas.map((p) => p.b.y)),
  };
  writeFileSync(`${SALIDA}/comparacion.json`, JSON.stringify({ resumen, trazas }, null, 1));
  console.log(resumen);
} finally {
  await navegador.close();
}

// Etiquetas (PNG con Chrome) y unión lado a lado a 60 fps.
const nav2 = await lanzar();
const pag = await nav2.newPage({ viewport: { width: ANCHO * 2, height: 44 } });
await pag.setContent(
  `<body style="margin:0;background:transparent;font:600 22px system-ui;color:#fff"><div style="display:flex"><div style="width:${ANCHO}px;padding:8px 14px;box-sizing:border-box"><span style="background:#000a;padding:4px 10px;border-radius:8px">Beto — su propia pantalla</span></div><div style="width:${ANCHO}px;padding:8px 14px;box-sizing:border-box"><span style="background:#000a;padding:4px 10px;border-radius:8px">Ana — lo que ve de Beto (otro navegador, por LiveKit)</span></div></div></body>`,
);
await pag.screenshot({ path: `${SALIDA}/etiquetas.png`, omitBackground: true });
await nav2.close();
execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-i',
  `${SALIDA}/b-propio.webm`,
  '-i',
  `${SALIDA}/a-ve-a-b.webm`,
  '-i',
  `${SALIDA}/etiquetas.png`,
  '-filter_complex',
  `[0:v]fps=60,scale=${ANCHO}:${ALTO}[l];[1:v]fps=60,scale=${ANCHO}:${ALTO}[r];[l][r]hstack=shortest=1[m];[m][2:v]overlay=0:0`,
  '-c:v',
  'libx264',
  '-crf',
  '17',
  '-pix_fmt',
  'yuv420p',
  '-r',
  '60',
  `${SALIDA}/presencia-lado-a-lado.mp4`,
]);
console.log('video listo:', `${SALIDA}/presencia-lado-a-lado.mp4`);
