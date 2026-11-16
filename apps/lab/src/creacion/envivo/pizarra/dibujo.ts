import { LIMITES, type Pizarra } from './modelo';
export const LIENZO = {
  ancho: 1920,
  alto: 1080,
  fondo: '#07080b',
  panel: '#141922',
  texto: '#f4efe6',
  suave: '#b9b2a6',
  acento: '#e9b949',
  linea: '#343b47',
  fuente: 'Inter, sans-serif',
  titulo: '"Bricolage Grotesque", sans-serif',
};
export interface Bloque {
  x: number;
  y: number;
  w: number;
  h: number;
  texto?: string;
  px?: number;
  fondo?: string;
  color?: string;
  orden?: number;
  linea?: boolean;
}
type Medir = (texto: string, px: number) => number;
/** Mide cada línea; incluso una palabra sin espacios se divide sin perder caracteres. */
export function ajustarTexto(
  texto: string,
  ancho: number,
  alto: number,
  maximo: number,
  medir: Medir,
): { px: number; lineas: string[] } {
  const envolver = (px: number): string[] => {
    const lineas: string[] = [];
    for (const parrafo of texto.split('\n')) {
      let linea = '';
      for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
        if (medir(palabra, px) > ancho) {
          if (linea) {
            lineas.push(linea);
            linea = '';
          }
          for (const caracter of palabra) {
            if (medir(linea + caracter, px) > ancho && linea) {
              lineas.push(linea);
              linea = '';
            }
            linea += caracter;
          }
        } else if (linea && medir(`${linea} ${palabra}`, px) > ancho) {
          lineas.push(linea);
          linea = palabra;
        } else linea += `${linea ? ' ' : ''}${palabra}`;
      }
      if (linea) lineas.push(linea);
    }
    return lineas;
  };
  for (let px = maximo; px >= 1; px--) {
    const lineas = envolver(px);
    if (lineas.length * px * 1.2 <= alto) return { px, lineas };
  }
  return { px: 1, lineas: envolver(1) };
}
/** Layout puro: las mismas cajas sirven para pruebas y para el lienzo de cada participante. */
export function componer(p: Pizarra): Bloque[] {
  const b: Bloque[] = [];
  const caja = (
    x: number,
    y: number,
    w: number,
    h: number,
    texto: string,
    px = 42,
    orden = 0,
    fondo?: string,
    color?: string,
  ) => b.push({ x, y, w, h, texto, px, orden, fondo, color });
  const linea = (x: number, y: number, w: number, h: number, orden = 0) =>
    b.push({ x, y, w, h, linea: true, orden });
  caja(96, 48, 1728, 150, p.titulo, 76);
  caja(
    96,
    198,
    1728,
    44,
    {
      idea: 'Una idea, en claro',
      pasos: 'Del primer paso al resultado',
      mapa: 'Cómo se conecta',
      comparacion: 'Dos formas de verlo',
      'linea-tiempo': 'Una historia en el tiempo',
      barras: `Datos · ${p.tipo === 'barras' ? p.unidad : ''}`,
      capas: 'Las partes que lo hacen posible',
    }[p.tipo],
    26,
    0,
    undefined,
    LIENZO.acento,
  );
  if (p.tipo === 'idea') {
    caja(96, 280, 1728, 200, p.frase, 68, 1);
    caja(96, 510, 1728, 120, p.analogia, 42, 2, LIENZO.panel);
    const w = 1696 / p.puntos.length;
    p.puntos.forEach((t, i) =>
      caja(96 + i * (w + 8), 680, w - 8, 172, `${i + 1}. ${t}`, 38, i + 3),
    );
  } else if (p.tipo === 'pasos') {
    const cols = p.pasos.length <= 4 ? p.pasos.length : Math.ceil(p.pasos.length / 2);
    const w = (1728 - (cols - 1) * 44) / cols;
    p.pasos.forEach((v, i) => {
      const x = 96 + (i % cols) * (w + 44),
        y = 290 + Math.floor(i / cols) * 290;
      caja(x, y, w, 88, `${i + 1}  ${v.texto}`, 40, i + 1, LIENZO.panel, LIENZO.acento);
      caja(
        x,
        y + 88,
        w,
        162,
        v.detalle + (v.alternativa ? `\n↳ ${v.alternativa}` : ''),
        35,
        i + 1,
        LIENZO.panel,
      );
      if (i % cols < cols - 1 && i < p.pasos.length - 1)
        caja(x + w, y + 90, 44, 70, '→', 36, i + 1);
    });
    if (p.pasos.length > cols) {
      const primero = 96 + w / 2,
        ultimo = 96 + (cols - 1) * (w + 44) + w / 2;
      linea(ultimo, 540, 0, 20, cols + 1);
      linea(ultimo, 560, primero - ultimo, 0, cols + 1);
      caja(primero - 22, 546, 44, 32, '↓', 24, cols + 1);
    }
  } else if (p.tipo === 'mapa') {
    caja(96, 440, 480, 220, p.centro, 54, 1, LIENZO.acento, LIENZO.fondo);
    const filas = Math.ceil(p.nodos.length / 2),
      h = 550 / filas;
    p.nodos.forEach((v, i) => {
      const x = 710 + (i % 2) * 570,
        y = 290 + Math.floor(i / 2) * h;
      linea(576, 550, x - 576, y + h / 2 - 550, i + 2);
      caja(x, y, 530, h - 16, `${v.relacion}\n${v.texto}`, 38, i + 2, LIENZO.panel);
    });
  } else if (p.tipo === 'comparacion') {
    const w = 1728 / (p.columnas.length + 1),
      h = 570 / (p.filas.length + 1);
    caja(96, 280, w - 8, h - 8, 'Qué cambia', 34, 1, LIENZO.panel);
    p.columnas.forEach((v, i) =>
      caja(96 + (i + 1) * w, 280, w - 8, h - 8, v, 38, 1, LIENZO.acento, LIENZO.fondo),
    );
    p.filas.forEach((f, i) => {
      caja(96, 280 + (i + 1) * h, w - 8, h - 8, f.criterio, 35, i + 2, LIENZO.panel, LIENZO.acento);
      f.celdas.forEach((v, j) =>
        caja(96 + (j + 1) * w, 280 + (i + 1) * h, w - 8, h - 8, v, 36, i + 2, LIENZO.panel),
      );
    });
  } else if (p.tipo === 'linea-tiempo') {
    const h = 570 / p.hitos.length;
    linea(440, 310, 0, 500);
    p.hitos.forEach((v, i) => {
      caja(96, 280 + i * h, 310, h - 8, v.fecha, 38, i + 1, undefined, LIENZO.acento);
      caja(490, 280 + i * h, 1334, h - 8, v.texto, 42, i + 1, LIENZO.panel);
    });
  } else if (p.tipo === 'barras') {
    const max = Math.max(1, ...p.valores.map((v) => v.valor)),
      h = 570 / p.valores.length;
    p.valores.forEach((v, i) => {
      caja(96, 280 + i * h, 420, h - 16, v.nombre, 38, i + 1);
      b.push({
        x: 540,
        y: 292 + i * h,
        w: Math.max(2, (990 * v.valor) / max),
        h: h - 40,
        fondo: LIENZO.acento,
        orden: i + 1,
      });
      caja(1550, 280 + i * h, 274, h - 16, v.valor.toLocaleString('es-CL'), 48, i + 1);
    });
  } else {
    const h = 570 / p.partes.length;
    p.partes.forEach((v, i) => {
      caja(96 + i * 32, 280 + i * h, 480, h - 12, v.nombre, 42, i + 1, LIENZO.acento, LIENZO.fondo);
      caja(590 + i * 32, 280 + i * h, 1234 - i * 64, h - 12, v.detalle, 40, i + 1, LIENZO.panel);
    });
  }
  caja(96, 900, 1728, 92, p.ejemplo, 34, 0, undefined, LIENZO.suave);
  const fuentes = [...p.fuentes, ...(p.tipo === 'barras' ? [p.fuente] : [])].filter(
    (f, i, xs) => xs.findIndex((x) => x.dominio === f.dominio) === i,
  );
  caja(
    96,
    1004,
    1728,
    50,
    fuentes.map((f) => `${f.titulo} · ${f.dominio}`).join('    /    ') ||
      'Pizarra compartida · Explicación del anfitrión',
    22,
    0,
    undefined,
    LIENZO.suave,
  );
  return b;
}
let actual: HTMLCanvasElement | null = null;
/** Superficie pública para enviar la lámina al cine cuando esa integración exista. */
export function laminaActual(): HTMLCanvasElement {
  if (!actual) {
    actual = document.createElement('canvas');
    actual.width = LIENZO.ancho;
    actual.height = LIENZO.alto;
  }
  return actual;
}
export function dibujar(
  canvas: HTMLCanvasElement,
  p: Pizarra | null,
  progreso = 1,
  estado = 'lista',
  texto = '',
  anterior: Pizarra | null = null,
): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  c.fillStyle = LIENZO.fondo;
  c.fillRect(0, 0, LIENZO.ancho, LIENZO.alto);
  const bloques = p
    ? componer(p)
    : [{ x: 96, y: 310, w: 1728, h: 330, texto: 'Una idea puede abrir una conversación.', px: 90 }];
  const previos = new Set(anterior ? componer(anterior).map((b) => b.texto) : []);
  const max = Math.max(1, ...bloques.map((b) => b.orden ?? 0));
  // Conexiones primero: ninguna línea se dibuja encima de un texto.
  for (const b of [...bloques.filter((b) => b.linea), ...bloques.filter((b) => !b.linea)]) {
    if ((b.orden ?? 0) > Math.ceil(progreso * max)) continue;
    c.globalAlpha = 1;
    if (b.linea) {
      c.strokeStyle = LIENZO.linea;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(b.x, b.y);
      c.lineTo(b.x + b.w, b.y + b.h);
      c.stroke();
      continue;
    }
    if (b.fondo) {
      c.fillStyle = b.fondo;
      c.beginPath();
      c.roundRect(b.x, b.y, b.w, b.h, 16);
      c.fill();
    }
    if (anterior && b.texto && !previos.has(b.texto) && progreso < 1 && b.orden) {
      c.strokeStyle = LIENZO.acento;
      c.lineWidth = 4;
      c.strokeRect(b.x, b.y, b.w, b.h);
    }
    if (!b.texto) continue;
    const font = b.px === 76 ? LIENZO.titulo : LIENZO.fuente;
    const medir: Medir = (s, px) => {
      c.font = `600 ${px}px ${font}`;
      return c.measureText(s).width;
    };
    const margenX = b.w < 80 ? 4 : 16,
      margenY = b.h < 65 ? 4 : 16;
    const a = ajustarTexto(b.texto, b.w - margenX * 2, b.h - margenY * 2, b.px ?? 40, medir);
    c.font = `600 ${a.px}px ${font}`;
    c.textBaseline = 'top';
    c.fillStyle = b.color ?? LIENZO.texto;
    const y = b.y + (b.h - a.lineas.length * a.px * 1.2) / 2;
    a.lineas.forEach((l, i) => c.fillText(l, b.x + margenX, y + i * a.px * 1.2));
  }
  if (estado !== 'lista') {
    c.fillStyle = '#07080bf2';
    c.fillRect(64, 260, 1792, 600);
    const titulo = estado === 'pensando' ? 'Pensando…' : 'No pude completar la explicación';
    for (const [t, y, px, h] of [
      [titulo, 330, 70, 120],
      [texto, 480, 42, 300],
    ] as const) {
      const a = ajustarTexto(t, 1600, h, px, (s, size) => {
        c.font = `600 ${size}px ${LIENZO.fuente}`;
        return c.measureText(s).width;
      });
      c.fillStyle = LIENZO.texto;
      c.font = `600 ${a.px}px ${LIENZO.fuente}`;
      a.lineas.forEach((l, i) => c.fillText(l, 144, y + i * a.px * 1.2));
    }
  }
}
/** Animación limitada a dos segundos; después no vuelve a subir texturas a la GPU. */
export function animar(
  canvas: HTMLCanvasElement,
  p: Pizarra | null,
  alDibujar: () => void,
  estado: string,
  texto: string,
  anterior: Pizarra | null = null,
): () => void {
  const inicio = performance.now();
  let id = 0;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cuadro = () => {
    const t =
      reducido || estado !== 'lista'
        ? 1
        : Math.min(1, (performance.now() - inicio) / LIMITES.animacion);
    dibujar(canvas, p, t, estado, texto, anterior);
    alDibujar();
    if (t < 1) id = requestAnimationFrame(cuadro);
  };
  cuadro();
  return () => cancelAnimationFrame(id);
}
