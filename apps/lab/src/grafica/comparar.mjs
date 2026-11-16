// Costo de cada técnica: la misma escena con la técnica apagada y encendida (calidad alta, 100 ocupantes).
// Uso: PLAYWRIGHT_DIR=<carpeta> node comparar.mjs --salida carpeta [--base http://127.0.0.1:5324]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const salida = arg('salida', '.');
mkdirSync(salida, { recursive: true });

const TECNICAS = [
  ['lod', 'LOD de geometría'],
  ['descarte', 'Descarte por cámara'],
  ['volumen', 'Rampa + sombras frías'],
  ['rim', 'Luz de contorno (Fresnel)'],
  ['blob', 'Sombra blob'],
  ['contorno', 'Contorno (seleccionado/habla)'],
  ['etiquetas', 'Nombres SDF'],
  ['dprAdaptable', 'DPR adaptable'],
  ['anisotropia=1', 'Anisotropía 8 → 1'],
  ['rangosParciales=1', 'Rangos parciales (encendida)'],
];
const PERFILES = [
  ['escritorio', 1],
  ['movil', 4],
];

const filas = [];
for (const [perfil, cpu] of PERFILES) {
  for (const [clave, nombre] of TECNICAS) {
    const [k, v] = clave.includes('=') ? clave.split('=') : [clave, '0'];
    // rangosParciales parte apagada en alta: «sin» = por defecto, «con» = encendida.
    const casos =
      k === 'rangosParciales'
        ? [
            ['sin', ''],
            ['con', `&t=${k}=${v}`],
          ]
        : [
            ['con', ''],
            ['sin', `&t=${k}=${v}`],
          ];
    const r = {};
    for (const [estado, q] of casos) {
      const archivo = join(salida, `tmp-${perfil}-${k}-${estado}.json`);
      execFileSync(
        'node',
        [
          join(aqui, 'medir.mjs'),
          '--perfil',
          perfil,
          '--cpu',
          String(cpu),
          '--calidad',
          'alta',
          '--n',
          '100',
          '--seg',
          '6',
          '--q',
          q,
          '--salida',
          archivo,
          '--base',
          arg('base', 'http://127.0.0.1:5324'),
        ],
        { stdio: 'ignore', env: process.env },
      );
      r[estado] = JSON.parse(readFileSync(archivo, 'utf8'))[0];
    }
    filas.push({ perfil, cpu, tecnica: nombre, clave: k, con: r.con, sin: r.sin });
    console.log(perfil, nombre, 'con p95', r.con.p95.toFixed(1), 'sin p95', r.sin.p95.toFixed(1));
  }
}
writeFileSync(join(salida, 'tecnicas.json'), JSON.stringify(filas, null, 2));
const f = (x) => x.toFixed(1);
const md = [
  '| Perfil | Técnica | p50 con/sin (ms) | p95 con/sin (ms) | Llamadas con/sin | Triángulos con/sin (k) | CPU render p95 con/sin (ms) |',
  '|---|---|---|---|---|---|---|',
];
for (const x of filas) {
  md.push(
    `| ${x.perfil}${x.cpu > 1 ? ` ×${x.cpu}` : ''} | ${x.tecnica} | ${f(x.con.p50)} / ${f(x.sin.p50)} | ${f(x.con.p95)} / ${f(x.sin.p95)} | ${x.con.drawCalls} / ${x.sin.drawCalls} | ${Math.round(x.con.triangulos / 1000)} / ${Math.round(x.sin.triangulos / 1000)} | ${f(x.con.renderCpuP95)} / ${f(x.sin.renderCpuP95)} |`,
  );
}
writeFileSync(join(salida, 'tecnicas.md'), md.join('\n') + '\n');
