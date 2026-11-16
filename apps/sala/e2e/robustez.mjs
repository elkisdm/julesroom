// Robustez: pestaña oculta (pausa y desconexión), reconexión tras caerse el servidor y entrada tardía.
import { spawn } from 'node:child_process';
import { openSync, writeFileSync } from 'node:fs';
import {
  abrirCliente,
  cerrar,
  esperar,
  esperarPersonas,
  irA,
  lanzar,
  remotos,
  yo,
} from './lib.mjs';

const resultados = [];
const comprobar = (nombre, ok, detalle = '') => {
  resultados.push(ok);
  console.log(`${ok ? '✔' : '✘'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const navegador = await lanzar();
let servidor;
try {
  const sala = `robustez-${Date.now()}`;
  // ocultoMin=0.05 → 3 s oculta para desconectar (en producción 5 min).
  const A = await abrirCliente(navegador, { nombre: 'Ana', sala });
  const B = await abrirCliente(navegador, { nombre: 'Beto', sala });
  await Promise.all([esperarPersonas(A, 1), esperarPersonas(B, 1)]);

  // 1. Entrada tardía: C llega después y ve a los que ya estaban.
  const C = await abrirCliente(navegador, { nombre: 'Cata', sala });
  await esperarPersonas(C, 2);
  comprobar('entrada tardía: quien llega ve a los que ya estaban', true);
  await esperarPersonas(A, 2);
  await cerrar(C);
  await esperarPersonas(A, 1, 15_000);
  comprobar('salida: los demás dejan de ver a quien se fue', true);

  // 2. Pestaña oculta: B se oculta; sus envíos se pausan y, pasado el plazo, se desconecta.
  const B2 = await abrirCliente(navegador, { nombre: 'Beto2', sala: `${sala}-o` });
  await cerrar(B2);
  const contexto = await navegador.newContext({ viewport: { width: 640, height: 400 } });
  const pagina = await contexto.newPage();
  const O = { contexto, pagina, nombre: 'Oculto', logs: [] };
  await pagina.goto(
    `${process.env.SALA_URL ?? 'http://localhost:5328'}/?nombre=Oculto&sala=${sala}&escenario=trading&ocultoMin=0.05`,
  );
  await pagina.waitForFunction(
    () => window.__sala?.fuente?.instantanea().conexion === 'conectado',
    null,
    { timeout: 30_000 },
  );
  await esperarPersonas(A, 2);
  const enviadosAntes = await pagina.evaluate(
    () => window.__sala.fuente.metricas().paquetesEnviados,
  );
  await pagina.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await pagina.evaluate(() => window.__sala.ir(window.__sala.yo.x + 2, window.__sala.yo.z)); // intenta moverse oculta
  await esperar(1800);
  const enviadosPausa = await pagina.evaluate(
    () => window.__sala.fuente.metricas().paquetesEnviados,
  );
  comprobar(
    'oculta: se pausan los envíos',
    enviadosPausa - enviadosAntes <= 2,
    `${enviadosPausa - enviadosAntes} paquetes en 1,8 s`,
  );
  await esperar(3500);
  const estado = await pagina.evaluate(() => window.__sala.fuente.instantanea().conexion);
  comprobar('oculta mucho tiempo: se desconecta', estado === 'suspendido', `estado ${estado}`);
  await esperarPersonas(A, 1, 20_000);
  comprobar('oculta mucho tiempo: los demás ya no la ven', true);
  await pagina.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await pagina.waitForFunction(
    () => window.__sala.fuente.instantanea().conexion === 'conectado',
    null,
    { timeout: 20_000 },
  );
  await esperarPersonas(A, 2, 20_000);
  comprobar('al volver visible: reconecta y los demás la ven de nuevo', true);
  await cerrar(O);

  // 3. Reconexión: se cae LiveKit y vuelve.
  const pid = Number(process.env.LIVEKIT_PID);
  if (pid) {
    const tCaida = Date.now();
    process.kill(pid, 'SIGKILL'); // caída abrupta: SIGTERM espera a que la sala quede vacía
    await A.pagina.waitForFunction(
      () => window.__sala.fuente.instantanea().conexion !== 'conectado',
      null,
      { timeout: 60_000 },
    );
    const tNota = Date.now() - tCaida;
    comprobar('servidor caído: el cliente lo nota', true, `${(tNota / 1000).toFixed(1)} s`);
    const registro = openSync(
      `${process.env.HOME}/Desktop/oficina-producto/presencia/livekit.log`,
      'a',
    );
    servidor = spawn('livekit-server', ['--dev', '--bind', '0.0.0.0'], {
      stdio: ['ignore', registro, registro],
      detached: true,
    });
    servidor.unref();
    writeFileSync(
      `${process.env.HOME}/Desktop/oficina-producto/presencia/livekit.pid`,
      String(servidor.pid),
    );
    await Promise.all(
      [A, B].map((c) =>
        c.pagina.waitForFunction(
          () => window.__sala.fuente.instantanea().conexion === 'conectado',
          null,
          { timeout: 90_000 },
        ),
      ),
    );
    comprobar(
      'servidor de vuelta: los clientes reconectan solos',
      true,
      `${((Date.now() - tCaida) / 1000).toFixed(1)} s desde la caída`,
    );
    await Promise.all([esperarPersonas(A, 1, 45_000), esperarPersonas(B, 1, 45_000)]);
    comprobar(
      'tras reconectar, cada uno vuelve a ver al otro',
      true,
      `${((Date.now() - tCaida) / 1000).toFixed(1)} s desde la caída`,
    );
    await irA(B, (await yo(B)).x + 1.5, (await yo(B)).z);
    await esperar(1200);
    const [visto] = await remotos(A);
    const real = await yo(B);
    comprobar(
      'tras reconectar, A vuelve a ver moverse a B',
      Math.hypot(visto.x - real.x, visto.z - real.z) < 0.5,
    );
    console.log(`livekit-server relanzado con pid ${servidor.pid}`);
  } else {
    console.log('(reconexión omitida: falta LIVEKIT_PID)');
  }
} catch (e) {
  comprobar('la prueba terminó sin excepciones', false, e.message);
} finally {
  await navegador.close();
}
const fallas = resultados.filter((r) => !r).length;
console.log(fallas === 0 ? '\nTodo en verde.' : `\n${fallas} comprobación(es) falló.`);
process.exit(fallas === 0 ? 0 : 1);
