// Prueba automática: A ve moverse a B y oye su audio solo cuando están cerca.
import {
  abrirCliente,
  cerrar,
  esperar,
  esperarPersonas,
  instantanea,
  irA,
  lanzar,
  nivelAudio,
  remotos,
  yo,
} from './lib.mjs';

const resultados = [];
const comprobar = (nombre, ok, detalle = '') => {
  resultados.push({ nombre, ok });
  console.log(`${ok ? '✔' : '✘'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const navegador = await lanzar();
let A, B;
try {
  A = await abrirCliente(navegador, { nombre: 'Ana', sala: `prueba-${Date.now()}` });
  const sala = new URL(A.pagina.url()).searchParams.get('sala');
  B = await abrirCliente(navegador, { nombre: 'Beto', sala });
  await esperarPersonas(A, 1);
  await esperarPersonas(B, 1);
  comprobar('cada cliente ve a la otra persona', true);

  const [ra] = await remotos(A);
  comprobar('A ve el nombre de B', ra?.nombre === 'Beto');

  // 1. Movimiento: B camina y A lo ve llegar a la misma posición.
  const { entrada, limites } = await A.pagina.evaluate(() => window.__sala.escenario);
  const destino = { x: entrada.x + 3, z: entrada.z };
  await irA(B, destino.x, destino.z);
  await esperar(1200);
  const [vistoPorA] = await remotos(A);
  const real = await yo(B);
  const error = Math.hypot(vistoPorA.x - real.x, vistoPorA.z - real.z);
  comprobar('A ve a B en la posición real de B', error < 0.5, `error ${error.toFixed(2)} m`);

  // 2. Voz: ambos activan el micrófono con un clic real.
  await Promise.all(
    [A, B].map((c) => c.pagina.getByRole('button', { name: 'Activar micrófono' }).click()),
  );
  await esperar(2500);
  const cerca = await instantanea(A);
  const dCerca = Math.hypot(real.x - (await yo(A)).x, real.z - (await yo(A)).z);
  const audioCerca = await nivelAudio(A, 3000);
  comprobar(
    'cerca: A está suscrito al audio de B',
    cerca.cercanos.some((c) => c.oyendo),
    `distancia ${dCerca.toFixed(1)} m`,
  );
  comprobar(
    'cerca: suena audio en A',
    audioCerca.elementos > 0 && audioCerca.rms > 0.005,
    `rms ${audioCerca.rms.toFixed(3)}, ${audioCerca.elementos} elemento(s)`,
  );

  // 3. Lejos: B se va más allá del radio de salida (4,5 × 1,25 = 5,6 m).
  const mia = await yo(A);
  const candidatos = [
    [limites.x0 + 1, limites.z0 + 1],
    [limites.x1 - 1, limites.z0 + 1],
    [limites.x0 + 1, limites.z1 - 1],
    [limites.x1 - 1, limites.z1 - 1],
  ];
  candidatos.sort(
    (p, q) => Math.hypot(q[0] - mia.x, q[1] - mia.z) - Math.hypot(p[0] - mia.x, p[1] - mia.z),
  );
  await irA(B, candidatos[0][0], candidatos[0][1], 40_000);
  await esperar(2500);
  const lejos = await instantanea(A);
  const rb = await yo(B);
  const dLejos = Math.hypot(rb.x - mia.x, rb.z - mia.z);
  const audioLejos = await nivelAudio(A, 3000);
  comprobar(
    'lejos: A deja de estar suscrito a B',
    !lejos.cercanos.some((c) => c.oyendo),
    `distancia ${dLejos.toFixed(1)} m`,
  );
  comprobar(
    'lejos: no suena audio en A',
    audioLejos.elementos === 0 || audioLejos.rms < 0.002,
    `rms ${audioLejos.rms.toFixed(4)}`,
  );
  comprobar('lejos: A sigue viendo a B moverse', (await remotos(A)).length === 1);

  // 4. Silenciar a otro.
  await irA(B, mia.x + 1.5, mia.z, 40_000);
  await esperar(2500);
  const bId = (await remotos(A))[0].id;
  await A.pagina.evaluate((id) => window.__sala.fuente.silenciar(id, true), bId);
  await esperar(800);
  const silenciado = await instantanea(A);
  comprobar(
    'silenciar: A deja de oír a B aunque esté cerca',
    !silenciado.cercanos.some((c) => c.oyendo),
  );

  // 5. Salida.
  await cerrar(B);
  await esperarPersonas(A, 0, 15_000);
  comprobar('cuando B sale, A deja de verlo', true);

  for (const c of [A, B])
    if (c.logs.length) console.log(`[${c.nombre}] consola:`, c.logs.slice(0, 5));
} catch (e) {
  comprobar('la prueba terminó sin excepciones', false, e.message);
} finally {
  await navegador.close();
}
const fallas = resultados.filter((r) => !r.ok).length;
console.log(fallas === 0 ? '\nTodo en verde.' : `\n${fallas} comprobación(es) falló.`);
process.exit(fallas === 0 ? 0 : 1);
