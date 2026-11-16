/**
 * Qué muestra cada pantalla del escenario. El escenario trae su contenido de ejemplo; si la persona
 * elige otro, se dibuja aquí en un lienzo y el motor lo usa como textura (`contenidoPantallas`).
 */
import type { ContenidoPantalla, Escenario } from '@oficina/motor';
import { dibujarMercadoPantalla } from '@oficina/motor';

export const OPCIONES_PANTALLA: { id: ContenidoPantalla; nombre: string; detalle: string }[] = [
  { id: 'mercado', nombre: 'Mercado', detalle: 'gráficos en vivo · ejemplo' },
  { id: 'tablero', nombre: 'Tablero del equipo', detalle: 'tareas por columna' },
  { id: 'presentacion', nombre: 'Presentación', detalle: 'una lámina' },
  { id: 'video', nombre: 'Video', detalle: 'reproductor' },
  { id: 'agente', nombre: 'Un agente', detalle: 'su ficha y lo que hace' },
];

const lienzos = new Map<string, HTMLCanvasElement>();

function lienzo(
  clave: string,
  dibujar: (g: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const hecho = lienzos.get(clave);
  if (hecho) return hecho;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 576;
  const g = c.getContext('2d');
  if (g) dibujar(g, c.width, c.height);
  lienzos.set(clave, c);
  return c;
}

const fuente = (px: number, peso = 600) => `${peso} ${px}px Inter, system-ui, sans-serif`;

function tablero(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#f4efe6';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b1f27';
  g.font = fuente(40, 700);
  g.fillText('Tablero del equipo', 40, 64);
  const cols = ['Por hacer', 'En curso', 'Listo'];
  const tarjetas = [
    ['Revisar cierre', 'Informe semanal', 'Llamar a clientes'],
    ['Alerta de riesgo', 'Guion del video'],
    ['Plan de la semana', 'Precios nuevos'],
  ];
  cols.forEach((t, i) => {
    const x = 40 + i * 325;
    g.fillStyle = '#e4dccd';
    g.fillRect(x, 100, 300, h - 140);
    g.fillStyle = '#4b4f58';
    g.font = fuente(26);
    g.fillText(t, x + 18, 140);
    (tarjetas[i] ?? []).forEach((c, k) => {
      g.fillStyle = '#ffffff';
      g.fillRect(x + 14, 165 + k * 92, 272, 76);
      g.fillStyle = ['#5b7fd6', '#d9825f', '#79b98a'][i] ?? '#999';
      g.fillRect(x + 14, 165 + k * 92, 8, 76);
      g.fillStyle = '#1b1f27';
      g.font = fuente(24, 500);
      g.fillText(c, x + 36, 211 + k * 92);
    });
  });
}

function presentacion(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#14161c';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#e9b949';
  g.fillRect(60, 80, 90, 10);
  g.fillStyle = '#f4efe6';
  g.font = fuente(64, 800);
  g.fillText('Plan del trimestre', 60, 180);
  g.font = fuente(32, 400);
  g.fillStyle = '#b9b2a6';
  ['Tres metas, una por mes', 'Quién lleva cada una', 'Cómo sabremos que funcionó'].forEach(
    (t, i) => g.fillText(`— ${t}`, 60, 270 + i * 60),
  );
}

function video(g: CanvasRenderingContext2D, w: number, h: number) {
  const d = g.createLinearGradient(0, 0, w, h);
  d.addColorStop(0, '#2f3e63');
  d.addColorStop(1, '#151719');
  g.fillStyle = d;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath();
  g.moveTo(w / 2 - 40, h / 2 - 55);
  g.lineTo(w / 2 + 60, h / 2);
  g.lineTo(w / 2 - 40, h / 2 + 55);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.25)';
  g.fillRect(40, h - 50, w - 80, 8);
  g.fillStyle = '#e9b949';
  g.fillRect(40, h - 50, (w - 80) * 0.35, 8);
}

function agente(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#10131a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#e9b949';
  g.fillRect(60, 70, 120, 120);
  g.fillStyle = '#f4efe6';
  g.font = fuente(56, 800);
  g.fillText('Nova', 210, 125);
  g.font = fuente(28, 400);
  g.fillStyle = '#b9b2a6';
  g.fillText('Analista de mercado · ejemplo', 210, 170);
  g.font = fuente(30, 500);
  g.fillStyle = '#f4efe6';
  [
    'Revisando el cierre de ayer',
    'Avisa si algo se mueve más de 2 %',
    'Próximo informe: 09:00',
  ].forEach((t, i) => g.fillText(t, 60, 280 + i * 64));
}

function mercado(g: CanvasRenderingContext2D, w: number, h: number) {
  dibujarMercadoPantalla(g, w, h);
}

const DIBUJOS: Record<ContenidoPantalla, typeof tablero> = {
  mercado,
  tablero,
  presentacion,
  video,
  agente,
};

/** Lienzo para una opción de pantalla (pantalla sin contenido de fábrica). */
export function lienzoDeContenido(id: ContenidoPantalla): HTMLCanvasElement {
  const dibujar = DIBUJOS[id];
  return lienzo(id, dibujar);
}

/** Lienzos para las pantallas cuyo contenido elegido difiere del que trae el escenario. */
export function contenidosDePantallas(
  escenario: Escenario,
  elegidos: Readonly<Record<string, ContenidoPantalla>>,
): Record<string, HTMLCanvasElement> {
  const r: Record<string, HTMLCanvasElement> = {};
  for (const p of escenario.pantallas) {
    const c = elegidos[p.id];
    if (!c || c === p.contenido) continue;
    r[p.id] = lienzo(c, DIBUJOS[c]);
  }
  return r;
}
