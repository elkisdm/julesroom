import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

// No adopta ni termina procesos ajenos. Falla si algún puerto reservado está ocupado.
for (const port of [5352, 8797, 8798, 7880, 7881, 7882]) {
  await new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', () => reject(new Error(`Puerto ${port} ocupado; no se tocó ese proceso.`)));
    s.listen(port, '127.0.0.1', () => s.close(resolve));
  });
}
const hijos = [];
let cerrando = false;
function cerrar(codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  for (const p of hijos) if (p.pid && p.exitCode === null) process.kill(-p.pid, 'SIGTERM');
  process.exitCode = codigo;
}
for (const [cmd, args] of [
  [
    'livekit-server',
    ['--dev', '--bind', '127.0.0.1', '--node-ip', '127.0.0.1', '--rtc.enable_loopback_candidate'],
  ],
  ['pnpm', ['--filter', '@oficina/lab', 'exec', 'tsx', 'servidor/main.ts']],
  ['pnpm', ['--filter', '@oficina/lab', 'dev', '--port', '5352']],
]) {
  // VITE_SALA_EN_VIVO enciende la sala compartida en la web (sin él, la sala es individual).
  const hijo = spawn(cmd, args, {
    stdio: 'inherit',
    detached: true,
    env: { ...process.env, VITE_SALA_EN_VIVO: '1' },
  });
  hijos.push(hijo);
  hijo.on('error', (e) => {
    console.error(`No se pudo iniciar ${cmd}: ${e.message}`);
    cerrar(1);
  });
  hijo.on('exit', (code) => {
    if (!cerrando) cerrar(code ?? 1);
  });
}
process.on('SIGINT', () => cerrar());
process.on('SIGTERM', () => cerrar());
console.log('Sala local: http://localhost:5352/crear.html · Ctrl+C cierra solo estos procesos.');
