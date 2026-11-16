// Cliente ligero para medir escala: la misma fuente de presencia y el mismo paquete que la sala, sin dibujar.
// Un avatar simulado pasea al azar por los límites dados y envía su posición como lo haría el motor (cada cuadro).
import { crearFuenteLiveKit, leerDegradacion } from '@oficina/presencia';
import type { EstadoPropio } from '@oficina/presencia';
import { atuendoDe, nombreDeSala, nuevaIdentidad, urlLiveKit } from './identidad';

const q = new URLSearchParams(window.location.search);
const id = nuevaIdentidad();
const nombre = q.get('nombre') ?? 'Ligero';
const sala = nombreDeSala(q.get('sala') ?? 'demo');
const escenario = q.get('escenario') ?? 'trading';
const [x0, x1, z0, z1] = (q.get('limites') ?? '-5,5,-5,5').split(',').map(Number) as [
  number,
  number,
  number,
  number,
];

let puerto = 7880;
const fuente = crearFuenteLiveKit({
  url: () => urlLiveKit(window.location, puerto),
  obtenerToken: async () => {
    const r = await fetch(`/api/token?${new URLSearchParams({ sala, identidad: id, nombre })}`);
    const c = (await r.json()) as { token: string; puerto: number };
    puerto = c.puerto;
    return c.token;
  },
  yo: { id, nombre, atuendo: atuendoDe('Backend', Math.floor(Math.random() * 20)), escenario },
  medicion: q.get('medir') === '1',
  degradacion: leerDegradacion(q.get('red')) ?? undefined,
});

const yo: EstadoPropio = {
  x: x0 + Math.random() * (x1 - x0),
  y: 0,
  z: z0 + Math.random() * (z1 - z0),
  rumbo: 0,
  saltos: 0,
  estado: 'de-pie',
  asiento: null,
};
let destino = { x: yo.x, z: yo.z };
let velocidad = 2.3;
let proximoDestino = 0;
let proximoSalto = 0;
let anterior = performance.now();

setInterval(() => {
  const t = performance.now();
  const dt = Math.min((t - anterior) / 1000, 0.1);
  anterior = t;
  if (t >= proximoDestino) {
    destino = { x: x0 + Math.random() * (x1 - x0), z: z0 + Math.random() * (z1 - z0) };
    velocidad = Math.random() < 0.3 ? 4.8 : 2.3;
    proximoDestino = t + 3000 + Math.random() * 3000;
  }
  if (t >= proximoSalto) {
    yo.saltos = (yo.saltos + 1) & 0xff;
    proximoSalto = t + 5000 + Math.random() * 5000;
  }
  const dx = destino.x - yo.x;
  const dz = destino.z - yo.z;
  const d = Math.hypot(dx, dz);
  if (d > 0.1) {
    const paso = Math.min(d, velocidad * dt);
    yo.x += (dx / d) * paso;
    yo.z += (dz / d) * paso;
    yo.rumbo = Math.atan2(dx, dz);
  }
  fuente.publicarPropio(yo);
}, 1000 / 60);

fuente.conectar().catch((e: unknown) => console.warn('[lite] no se pudo conectar', e));
window.__sala = { id, yo, fuente } as unknown as Window['__sala'];
