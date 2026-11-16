// Mediciones: node e2e/medir.mjs --n 5 [--completos 5] --seg 30 [--red 150,60,0.15] [--salida carpeta]
// Los primeros `completos` clientes dibujan la sala (calidad baja); el resto son ligeros (misma fuente, sin dibujar).
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  abrirCliente,
  cerrar,
  abrirCpu,
  abrirLigero,
  esperar,
  esperarPersonas,
  envios,
  lanzar,
  leerContadores,
  llegadas,
  pasearSolo,
  percentil,
} from './lib.mjs';

const arg = (nombre, defecto) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : defecto;
};
const N = Number(arg('n', 2));
const COMPLETOS = Math.min(N, Number(arg('completos', N)));
const SEG = Number(arg('seg', 30));
const RED = arg('red', '');
const SALIDA = arg('salida', `${process.env.HOME}/Desktop/oficina-producto/presencia/mediciones`);
const etiqueta = `n${N}${RED ? '-red' : ''}`;

const navegador = await lanzar();
const clientes = [];
try {
  const sala = `medir-${Date.now()}`;
  const primero = await abrirCliente(navegador, {
    nombre: 'C1',
    sala,
    ancho: 320,
    alto: 200,
    calidad: 'baja',
    red: RED,
  });
  clientes.push(primero);
  const { limites } = await primero.pagina.evaluate(() => window.__sala.escenario);
  const lims = [limites.x0 + 1, limites.x1 - 1, limites.z0 + 1, limites.z1 - 1];
  for (let i = 1; i < N; i++) {
    const nombre = `C${i + 1}`;
    clientes.push(
      i < COMPLETOS
        ? await abrirCliente(navegador, {
            nombre,
            sala,
            ancho: 320,
            alto: 200,
            calidad: 'baja',
            red: RED,
          })
        : await abrirLigero(navegador, { nombre, sala, limites: lims, red: RED || undefined }),
    );
    process.stdout.write(`\rclientes abiertos: ${clientes.length}/${N}`);
  }
  console.log();
  await Promise.all(clientes.map((c) => esperarPersonas(c, N - 1, 120_000)));
  console.log(`todos ven a ${N - 1} personas`);
  await Promise.all(clientes.map((c) => pasearSolo(c, lims)));
  await esperar(4000); // calentamiento

  const cpus = await Promise.all(clientes.map(abrirCpu));
  const antes = await Promise.all(clientes.map(leerContadores));
  const cpuAntes = await Promise.all(cpus.map((f) => f()));
  const t0 = Date.now();
  await esperar(SEG * 1000);
  const dt = (Date.now() - t0) / 1000;
  const despues = await Promise.all(clientes.map(leerContadores));
  const cpuDespues = await Promise.all(cpus.map((f) => f()));

  // Retraso extremo a extremo: cada llegada (emisor, seq) contra el envío de ese emisor con ese seq.
  const env = new Map(
    (await Promise.all(clientes.map(envios))).map((e) => [
      e.id,
      new Map(e.envios.map((x) => [x.seq, x.t])),
    ]),
  );
  const lleg = await Promise.all(clientes.map(llegadas));
  const retrasos = [];
  for (const r of lleg) {
    for (const l of r.llegadas) {
      const t = env.get(l.id)?.get(l.seq);
      if (t !== undefined && l.t >= t && l.t - t < 5000) retrasos.push(l.t - t);
    }
  }

  const por = clientes.map((c, i) => {
    const a = antes[i];
    const d = despues[i];
    const completo = i < COMPLETOS;
    return {
      cliente: c.nombre,
      tipo: completo ? 'completo' : 'ligero',
      subidaKBs: +((d.bytesEnviados - a.bytesEnviados) / dt / 1024).toFixed(2),
      bajadaKBs: +((d.bytesRecibidos - a.bytesRecibidos) / dt / 1024).toFixed(2),
      enviadosHz: +((d.paquetesEnviados - a.paquetesEnviados) / dt).toFixed(2),
      recibidosHz: +((d.paquetesRecibidos - a.paquetesRecibidos) / dt).toFixed(1),
      recibidosPorEmisorHz: +((d.paquetesRecibidos - a.paquetesRecibidos) / dt / (N - 1)).toFixed(
        2,
      ),
      viejos: d.paquetesViejos - a.paquetesViejos,
      descartadosPorRed: d.paquetesDescartados - a.paquetesDescartados,
      erroresEnvio: d.erroresEnvio - a.erroresEnvio,
      cpuHiloPrincipalPct: +(((cpuDespues[i].tarea - cpuAntes[i].tarea) / dt) * 100).toFixed(1),
      cpuScriptPct: +(((cpuDespues[i].script - cpuAntes[i].script) / dt) * 100).toFixed(1),
    };
  });
  const media = (k, solo) => {
    const xs = por.filter((p) => !solo || p.tipo === solo).map((p) => p[k]);
    return xs.length ? +(xs.reduce((s, v) => s + v, 0) / xs.length).toFixed(2) : null;
  };
  const resumen = {
    etiqueta,
    clientes: N,
    completos: COMPLETOS,
    segundos: +dt.toFixed(1),
    red: RED || 'sin degradar (loopback)',
    retrasoMs: {
      muestras: retrasos.length,
      p50: percentil(retrasos, 0.5),
      p95: percentil(retrasos, 0.95),
      max: retrasos.reduce((m, v) => Math.max(m, v), 0),
    },
    medias: {
      subidaKBs: media('subidaKBs'),
      bajadaKBs: media('bajadaKBs'),
      enviadosHz: media('enviadosHz'),
      recibidosPorEmisorHz: media('recibidosPorEmisorHz'),
      cpuHiloPrincipalPctCompletos: media('cpuHiloPrincipalPct', 'completo'),
      cpuHiloPrincipalPctLigeros: media('cpuHiloPrincipalPct', 'ligero'),
    },
    porCliente: por,
  };
  mkdirSync(SALIDA, { recursive: true });
  writeFileSync(`${SALIDA}/${etiqueta}.json`, JSON.stringify(resumen, null, 2));
  console.log(JSON.stringify({ ...resumen, porCliente: undefined }, null, 2));
} finally {
  await Promise.all(clientes.map(cerrar));
  await navegador.close();
}
