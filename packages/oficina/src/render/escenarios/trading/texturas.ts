/**
 * Todo lo que se ve en las pantallas y las superficies dibujadas de la sala de trading, en lienzos 2D
 * con datos de ejemplo genéricos (`mercado.ts`). Paleta «hora azul»: tinta de fondo, verde señal y
 * coral solo en datos, ámbar y latón en los acentos.
 */
import type { ActivoId, Vela } from './mercado';
import {
  ACTIVOS,
  activo,
  aleatorio,
  formatoPct,
  formatoPrecio,
  generarVelas,
  niveles,
  serie,
  variacion,
} from './mercado';

const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const TINTA = {
  fondo: '#0a1220',
  panel: '#0f1a2b',
  linea: 'rgba(214, 226, 255, 0.09)',
  texto: '#f3efe6',
  suave: '#9aa6b8',
  ambar: '#ffbe6e',
  laton: '#c9a15a',
  frio: '#8fd8ff',
  alza: '#3ccf91',
  baja: '#ff6b5a',
} as const;

type Ctx = CanvasRenderingContext2D;
interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

function texto(
  ctx: Ctx,
  t: string,
  x: number,
  y: number,
  o: { peso?: number; px?: number; color?: string; alinear?: CanvasTextAlign } = {},
) {
  ctx.font = `${o.peso ?? 500} ${o.px ?? 32}px ${FUENTE}`;
  ctx.fillStyle = o.color ?? TINTA.texto;
  ctx.textAlign = o.alinear ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, x, y);
}

/** Recorta un texto con «…» para que quepa en `ancho` px (con la fuente ya fijada). */
function ajustar(ctx: Ctx, t: string, ancho: number): string {
  if (ctx.measureText(t).width <= ancho) return t;
  let s = t;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > ancho) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

function fondo(ctx: Ctx, w: number, h: number, color: string = TINTA.fondo) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

function redondeado(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

const precio = (id: ActivoId, v: number) => formatoPrecio(v, activo(id).decimales);

// --- velas ------------------------------------------------------------------------------------

interface OpcionesVelas {
  /** Líneas de soporte y resistencia con su etiqueta. */
  niveles?: { decimales: number; px: number };
  /** Cuántas velas dibujar (desde la primera). */
  hasta?: number;
  /** Mueve el cierre de la última vela (latido del precio en vivo). */
  latido?: number;
  grosor?: number;
  rejilla?: boolean;
}

function dibujarVelas(ctx: Ctx, c: Caja, velas: readonly Vela[], o: OpcionesVelas = {}) {
  const n = Math.max(1, Math.min(velas.length, o.hasta ?? velas.length));
  const lista = velas.slice(0, n).map((v, i) => {
    if (i !== n - 1 || !o.latido) return v;
    const cierre = v.cierre * (1 + o.latido);
    return { ...v, cierre, max: Math.max(v.max, cierre), min: Math.min(v.min, cierre) };
  });
  const nv = niveles(velas);
  const precios = velas.flatMap((v) => [v.max, v.min]);
  const minimo = Math.min(...precios);
  const maximo = Math.max(...precios);
  const y = (p: number) => c.y + c.h - ((p - minimo) / (maximo - minimo || 1)) * c.h;
  const grosor = o.grosor ?? 2;
  if (o.rejilla !== false) {
    ctx.strokeStyle = TINTA.linea;
    ctx.lineWidth = Math.max(1, grosor * 0.6);
    for (let i = 0; i <= 4; i++) {
      const yy = c.y + (c.h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(c.x, yy);
      ctx.lineTo(c.x + c.w, yy);
      ctx.stroke();
    }
  }
  if (o.niveles) {
    const { px, decimales } = o.niveles;
    for (const [valor, color, nombre] of [
      [nv.resistencia, TINTA.baja, 'R'],
      [nv.soporte, TINTA.alza, 'S'],
    ] as const) {
      ctx.fillStyle =
        color === TINTA.alza ? 'rgba(60, 207, 145, 0.10)' : 'rgba(255, 107, 90, 0.10)';
      ctx.fillRect(c.x, y(valor) - px * 0.35, c.w, px * 0.7);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, px * 0.08);
      ctx.setLineDash([px * 0.5, px * 0.35]);
      ctx.beginPath();
      ctx.moveTo(c.x, y(valor));
      ctx.lineTo(c.x + c.w, y(valor));
      ctx.stroke();
      ctx.setLineDash([]);
      texto(
        ctx,
        `${nombre} ${formatoPrecio(valor, decimales)}`,
        c.x + c.w + px * 0.4,
        y(valor) + px * 0.35,
        {
          px,
          peso: 600,
          color,
        },
      );
    }
  }
  const paso = c.w / velas.length;
  lista.forEach((v, i) => {
    const x = c.x + i * paso + paso / 2;
    ctx.strokeStyle = ctx.fillStyle = v.cierre >= v.apertura ? TINTA.alza : TINTA.baja;
    ctx.lineWidth = grosor;
    ctx.beginPath();
    ctx.moveTo(x, y(v.max));
    ctx.lineTo(x, y(v.min));
    ctx.stroke();
    ctx.fillRect(
      x - paso * 0.32,
      y(Math.max(v.apertura, v.cierre)),
      paso * 0.64,
      Math.max(2, Math.abs(y(v.apertura) - y(v.cierre))),
    );
  });
  return { y, ultima: lista[lista.length - 1]! };
}

/** Línea de precio sin velas (miniaturas y letreros). */
function dibujarLinea(ctx: Ctx, c: Caja, velas: readonly Vela[], color: string, grosor: number) {
  const cierres = velas.map((v) => v.cierre);
  const min = Math.min(...cierres);
  const max = Math.max(...cierres);
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  cierres.forEach((p, i) => {
    const x = c.x + (i / (cierres.length - 1)) * c.w;
    const y = c.y + c.h - ((p - min) / (max - min || 1)) * c.h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// --- muro de datos ------------------------------------------------------------------------------

const AGENDA: readonly [string, string, 'alto' | 'medio' | 'bajo'][] = [
  ['09:30', 'Dato de inflación', 'alto'],
  ['11:00', 'Informe de empleo', 'alto'],
  ['14:00', 'Inventarios de crudo', 'medio'],
  ['16:30', 'Discurso de banco central', 'medio'],
  ['18:00', 'Cierre de la sesión', 'bajo'],
];

/**
 * El muro de datos: el gráfico grande de BTC con sus niveles, el mapa de los cuatro activos y la
 * agenda del día. `t` (s) mueve el último precio con calma.
 */
export function dibujarMuro(ctx: Ctx, w: number, h: number, t: number) {
  fondo(ctx, w, h, '#070d18');
  const s = h / 480;
  const latido = Math.sin(t * 0.7) * 0.0009 + Math.sin(t * 1.9) * 0.0004;
  const velas = serie('btc');
  const vivo = velas.at(-1)!.cierre * (1 + latido);
  const pad = 40 * s;
  const ancho1 = w * 0.5;
  texto(ctx, 'BTC/USDT', pad, 78 * s, { peso: 800, px: 60 * s });
  texto(ctx, '1 h · datos de ejemplo', pad + 300 * s, 72 * s, { px: 24 * s, color: TINTA.suave });
  const cambio = variacion('btc');
  texto(ctx, precio('btc', vivo), ancho1 - 30 * s, 78 * s, {
    peso: 800,
    px: 60 * s,
    alinear: 'right',
  });
  texto(ctx, `${formatoPct(cambio)} en 24 h`, ancho1 - 30 * s, 112 * s, {
    peso: 600,
    px: 24 * s,
    color: cambio >= 0 ? TINTA.alza : TINTA.baja,
    alinear: 'right',
  });
  dibujarVelas(ctx, { x: pad, y: 140 * s, w: ancho1 - pad - 160 * s, h: h - 190 * s }, velas, {
    niveles: { decimales: 0, px: 22 * s },
    latido,
    grosor: 3 * s,
  });

  const x2 = ancho1 + 24 * s;
  const ancho2 = w * 0.24;
  texto(ctx, 'Mercado', x2, 78 * s, { peso: 800, px: 44 * s });
  const alto = (h - 130 * s - 30 * s) / 4 - 12 * s;
  ACTIVOS.forEach((a, i) => {
    const y0 = 110 * s + i * (alto + 12 * s);
    const v = variacion(a.id);
    redondeado(
      ctx,
      x2,
      y0,
      ancho2,
      alto,
      14 * s,
      v >= 0 ? 'rgba(60, 207, 145, 0.14)' : 'rgba(255, 107, 90, 0.14)',
    );
    const medio = y0 + alto / 2 + 11 * s;
    texto(ctx, a.simbolo, x2 + 20 * s, medio, { peso: 700, px: 28 * s });
    const p = serie(a.id).at(-1)!.cierre * (i === 0 ? 1 + latido : 1);
    texto(ctx, precio(a.id, p), x2 + ancho2 * 0.68, medio, {
      peso: 600,
      px: 27 * s,
      alinear: 'right',
    });
    texto(ctx, formatoPct(v), x2 + ancho2 - 20 * s, medio, {
      peso: 700,
      px: 27 * s,
      color: v >= 0 ? TINTA.alza : TINTA.baja,
      alinear: 'right',
    });
  });

  const x3 = x2 + ancho2 + 32 * s;
  const ancho3 = w - x3 - pad;
  texto(ctx, 'Agenda', x3, 78 * s, { peso: 800, px: 44 * s });
  AGENDA.forEach(([hora, titulo, impacto], i) => {
    const y0 = 140 * s + i * 64 * s;
    texto(ctx, hora, x3, y0, { peso: 700, px: 28 * s, color: TINTA.ambar });
    ctx.font = `500 26px ${FUENTE}`;
    texto(ctx, ajustar(ctx, titulo, ancho3 - 100 * s), x3 + 92 * s, y0, { px: 26 * s });
    texto(ctx, `Impacto ${impacto}`, x3 + 92 * s, y0 + 26 * s, {
      px: 19 * s,
      color: impacto === 'alto' ? TINTA.baja : TINTA.suave,
    });
  });
}

/** La cinta de cotizaciones bajo el muro: una vuelta exacta, se repite sin costura. */
export function medirCinta(): { ancho: number; dibujar: (ctx: Ctx, w: number, h: number) => void } {
  const px = 44;
  const piezas = ACTIVOS.map((a) => {
    const v = variacion(a.id);
    return {
      simbolo: a.simbolo,
      precio: precio(a.id, serie(a.id).at(-1)!.cierre),
      cambio: formatoPct(v),
      sube: v >= 0,
    };
  });
  const medida = document.createElement('canvas').getContext('2d');
  if (!medida) throw new Error('No se pudo medir la cinta');
  const ancho = (s: string, peso: number) => {
    medida.font = `${peso} ${px}px ${FUENTE}`;
    return medida.measureText(s).width;
  };
  const SEP = 110;
  const largo = piezas.reduce(
    (s, p) => s + ancho(p.simbolo, 700) + ancho(p.precio, 500) + ancho(p.cambio, 700) + 60 + SEP,
    0,
  );
  return {
    ancho: Math.ceil(largo),
    dibujar: (ctx, w, h) => {
      fondo(ctx, w, h, '#060b14');
      let x = 40;
      for (const p of piezas) {
        texto(ctx, p.simbolo, x, h * 0.7, { peso: 700, px, color: TINTA.ambar });
        x += ancho(p.simbolo, 700) + 24;
        texto(ctx, p.precio, x, h * 0.7, { px });
        x += ancho(p.precio, 500) + 24;
        texto(ctx, p.cambio, x, h * 0.7, {
          peso: 700,
          px,
          color: p.sube ? TINTA.alza : TINTA.baja,
        });
        x += ancho(p.cambio, 700) + 12 + SEP;
      }
    },
  };
}

// --- monitores de los puestos (atlas) -----------------------------------------------------------

export const ATLAS_MONITOR = { columnas: 4, filas: 4, celda: { w: 512, h: 300 } } as const;
const VARIANTES = [
  'grafico',
  'niveles',
  'tabla',
  'agenda',
  'grafico',
  'escenarios',
  'alertas',
  'niveles',
] as const;
type Variante = (typeof VARIANTES)[number];
const ACTIVO_MONITOR: readonly ActivoId[] = ['btc', 'eth', 'eur', 'xau'];

function dibujarMonitor(ctx: Ctx, c: Caja, variante: Variante, semilla: number) {
  ctx.save();
  ctx.translate(c.x, c.y);
  const { w, h } = c;
  fondo(ctx, w, h, TINTA.panel);
  const id = ACTIVO_MONITOR[semilla % ACTIVO_MONITOR.length]!;
  const a = activo(id);
  const titulo = (t: string, d: string) => {
    texto(ctx, t, 22, 44, { peso: 700, px: 30 });
    texto(ctx, d, w - 22, 44, { px: 22, color: TINTA.suave, alinear: 'right' });
  };
  if (variante === 'grafico' || variante === 'niveles') {
    titulo(a.simbolo, semilla % 2 ? '4 h' : '1 h');
    const velas = generarVelas({
      semilla: a.semilla + semilla * 7,
      cantidad: 40,
      precioInicial: a.precioBase,
      volatilidad: a.volatilidad,
    });
    dibujarVelas(
      ctx,
      { x: 22, y: 70, w: w - (variante === 'niveles' ? 150 : 44), h: h - 96 },
      velas,
      {
        niveles: variante === 'niveles' ? { decimales: a.decimales, px: 18 } : undefined,
        grosor: 2,
      },
    );
  } else if (variante === 'tabla') {
    titulo('Tendencia', '4 h');
    ACTIVOS.forEach((x, i) => {
      const y = 98 + i * 50;
      const v = variacion(x.id);
      texto(ctx, x.simbolo, 22, y, { peso: 600, px: 23 });
      texto(ctx, precio(x.id, serie(x.id).at(-1)!.cierre), w * 0.62, y, {
        px: 23,
        alinear: 'right',
      });
      texto(ctx, formatoPct(v), w - 22, y, {
        px: 22,
        peso: 700,
        color: v >= 0 ? TINTA.alza : TINTA.baja,
        alinear: 'right',
      });
    });
  } else if (variante === 'agenda') {
    titulo('Agenda', 'hoy');
    AGENDA.forEach(([hora, t, imp], i) => {
      const y = 96 + i * 46;
      texto(ctx, hora, 22, y, { peso: 700, px: 23, color: TINTA.ambar });
      texto(ctx, t, 104, y, { px: 21 });
      if (imp === 'alto')
        texto(ctx, '●', w - 22, y, { px: 18, color: TINTA.baja, alinear: 'right' });
    });
  } else if (variante === 'escenarios') {
    titulo('Escenarios', a.simbolo);
    const rnd = aleatorio(semilla + 3);
    const alcista = 30 + Math.round(rnd() * 30);
    const bajista = 15 + Math.round(rnd() * 20);
    for (const [i, [nombre, valor, color]] of (
      [
        ['Alcista', alcista, TINTA.alza],
        ['Lateral', 100 - alcista - bajista, TINTA.suave],
        ['Bajista', bajista, TINTA.baja],
      ] as const
    ).entries()) {
      const y = 100 + i * 70;
      texto(ctx, nombre, 22, y, { px: 23 });
      texto(ctx, `${valor} %`, w - 22, y, { peso: 700, px: 23, alinear: 'right' });
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(22, y + 14, w - 44, 14);
      ctx.fillStyle = color;
      ctx.fillRect(22, y + 14, ((w - 44) * valor) / 100, 14);
    }
  } else {
    titulo('Alertas', 'en vivo');
    const lineas = [
      'EUR/USD cerca de resistencia',
      'BTC/USDT tocó soporte',
      'XAU/USD rompe máximo diario',
      'ETH/USDT volumen alto',
    ];
    lineas.forEach((t, i) => {
      const y = 98 + i * 50;
      texto(
        ctx,
        `${String(10 - i).padStart(2, '0')}:${String((semilla * 13 + i * 17) % 60).padStart(2, '0')}`,
        22,
        y,
        {
          peso: 700,
          px: 21,
          color: TINTA.frio,
        },
      );
      texto(ctx, t, 104, y, { px: 21 });
    });
  }
  ctx.restore();
}

/** Atlas de los monitores: 16 celdas (8 variantes con dos semillas). */
export function dibujarAtlasMonitores(ctx: Ctx, w: number, h: number) {
  fondo(ctx, w, h, '#000');
  const { columnas, filas, celda } = ATLAS_MONITOR;
  for (let i = 0; i < columnas * filas; i++) {
    const c = {
      x: (i % columnas) * celda.w,
      y: Math.floor(i / columnas) * celda.h,
      w: celda.w,
      h: celda.h,
    };
    dibujarMonitor(ctx, c, VARIANTES[i % VARIANTES.length]!, i);
  }
}

// --- letreros de los puestos de agentes (atlas) -------------------------------------------------

export const ATLAS_LETRERO = { columnas: 2, filas: 3, celda: { w: 1024, h: 280 } } as const;

/** Letrero colgante del puesto `n`: el puesto, su equipo y una línea del activo que sigue. */
export function dibujarAtlasLetreros(ctx: Ctx, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const { columnas, celda } = ATLAS_LETRERO;
  for (let n = 0; n < 6; n++) {
    ctx.save();
    ctx.translate((n % columnas) * celda.w, Math.floor(n / columnas) * celda.h);
    const cw = celda.w;
    const ch = celda.h;
    redondeado(ctx, 6, 6, cw - 12, ch - 12, 28, 'rgba(10, 16, 28, 0.94)');
    ctx.strokeStyle = 'rgba(201, 161, 90, 0.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, cw - 16, ch - 16, 26);
    ctx.stroke();
    const id = ACTIVO_MONITOR[n % ACTIVO_MONITOR.length]!;
    const v = variacion(id);
    texto(ctx, `Puesto ${n + 1}`, 48, 112, { peso: 800, px: 76 });
    texto(ctx, `Agente · equipo ${Math.floor(n / 2) + 1}`, 50, 168, { px: 36, color: TINTA.suave });
    texto(ctx, activo(id).simbolo, 50, 232, { peso: 700, px: 36, color: TINTA.ambar });
    texto(ctx, formatoPct(v), cw - 48, 232, {
      peso: 700,
      px: 40,
      color: v >= 0 ? TINTA.alza : TINTA.baja,
      alinear: 'right',
    });
    dibujarLinea(
      ctx,
      { x: cw * 0.55, y: 50, w: cw * 0.4, h: 110 },
      serie(id).slice(-30),
      v >= 0 ? TINTA.alza : TINTA.baja,
      6,
    );
    ctx.restore();
  }
}

// --- aula, sala privada, mesas y quiosco --------------------------------------------------------

/** La pantalla del aula: una lección de ejemplo con su lámina que se dibuja a medida que avanza. */
export function dibujarAula(ctx: Ctx, w: number, h: number, t: number) {
  fondo(ctx, w, h, '#08101c');
  const avance = (t / 90) % 1;
  const pad = 64;
  texto(ctx, 'Curso de ejemplo · lección 3 de 8', pad, 92, {
    px: 34,
    color: TINTA.ambar,
    peso: 600,
  });
  texto(ctx, 'Soportes y', pad, 196, { peso: 800, px: 84 });
  texto(ctx, 'resistencias', pad, 286, { peso: 800, px: 84 });
  const resumen = [
    'Dónde el precio tiende a',
    'detenerse y cómo marcar',
    'esas zonas en el gráfico.',
  ];
  resumen.forEach((l, i) => texto(ctx, l, pad, 380 + i * 48, { px: 36, color: TINTA.suave }));
  const velas = generarVelas({ semilla: 21, cantidad: 46, precioInicial: 100, volatilidad: 0.012 });
  const lamina = { x: w * 0.5, y: 110, w: w * 0.5 - pad - 30, h: h - 280 };
  redondeado(ctx, lamina.x - 24, lamina.y - 24, lamina.w + 48, lamina.h + 48, 22, '#0d1626');
  const hasta = Math.max(6, Math.round(velas.length * (0.15 + 0.85 * avance)));
  const { y } = dibujarVelas(ctx, lamina, velas, { hasta, grosor: 4 });
  const nivel = [...velas].map((v) => v.min).sort((a, b) => a - b)[
    Math.floor(velas.length * 0.15)
  ]!;
  ctx.fillStyle = 'rgba(60, 207, 145, 0.16)';
  ctx.fillRect(lamina.x, y(nivel) - 14, lamina.w, 28);
  texto(ctx, 'Zona de soporte', lamina.x + 16, y(nivel) - 24, {
    px: 28,
    color: TINTA.alza,
    peso: 600,
  });
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(pad, h - 80, w - pad * 2, 12);
  ctx.fillStyle = TINTA.ambar;
  ctx.fillRect(pad, h - 80, (w - pad * 2) * avance, 12);
}

/** Pantalla de la sala privada cuando nadie comparte. */
export function dibujarPrivado(ctx: Ctx, w: number, h: number) {
  fondo(ctx, w, h, '#08101c');
  texto(ctx, 'Sala privada', 56, 130, { peso: 800, px: 84 });
  texto(ctx, 'Lo que se habla aquí queda aquí.', 58, 206, { px: 38, color: TINTA.suave });
  dibujarLinea(ctx, { x: 58, y: 270, w: w - 116, h: 170 }, serie('xau').slice(-40), TINTA.ambar, 5);
  texto(ctx, 'Comparte tu pantalla para verla en grande.', 58, h - 60, {
    px: 32,
    color: TINTA.ambar,
  });
}

/** Pantalla inclinada de una mesa: el gráfico del activo de su mercado. */
export function dibujarMesa(ctx: Ctx, w: number, h: number, id: ActivoId) {
  fondo(ctx, w, h, TINTA.panel);
  const a = activo(id);
  texto(ctx, a.simbolo, 30, 64, { peso: 800, px: 48 });
  texto(ctx, '4 h', w - 30, 60, { px: 30, color: TINTA.suave, alinear: 'right' });
  dibujarVelas(ctx, { x: 30, y: 96, w: w - 180, h: h - 130 }, serie(id).slice(-40), {
    niveles: { decimales: a.decimales, px: 22 },
    grosor: 3,
  });
}

export const ATLAS_CARTEL = { celda: { w: 1024, h: 200 }, filas: 3 } as const;

/** Carteles colgantes de las mesas (uno por fila): el mercado, su activo y el último precio. */
export function dibujarAtlasCarteles(
  ctx: Ctx,
  w: number,
  h: number,
  mesas: readonly { nombre: string; activo: ActivoId }[],
) {
  ctx.clearRect(0, 0, w, h);
  const { celda } = ATLAS_CARTEL;
  mesas.forEach((m, i) => {
    ctx.save();
    ctx.translate(0, i * celda.h);
    redondeado(ctx, 4, 4, celda.w - 8, celda.h - 8, 26, 'rgba(10, 16, 28, 0.95)');
    ctx.strokeStyle = 'rgba(201, 161, 90, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(6, 6, celda.w - 12, celda.h - 12, 24);
    ctx.stroke();
    const v = variacion(m.activo);
    texto(ctx, m.nombre, 40, 104, { peso: 800, px: 78 });
    texto(ctx, `Mesa · ${activo(m.activo).simbolo}`, 42, 160, { px: 34, color: TINTA.suave });
    texto(ctx, precio(m.activo, serie(m.activo).at(-1)!.cierre), celda.w - 40, 100, {
      peso: 800,
      px: 60,
      alinear: 'right',
    });
    texto(ctx, `${formatoPct(v)} en 24 h`, celda.w - 40, 156, {
      peso: 600,
      px: 34,
      color: v >= 0 ? TINTA.alza : TINTA.baja,
      alinear: 'right',
    });
    ctx.restore();
  });
}

const VIDEOS: readonly [string, string][] = [
  ['Velas en diez minutos', '10:24'],
  ['Cómo marcar niveles', '14:02'],
  ['Gestión del riesgo', '18:40'],
  ['Leer la agenda económica', '09:15'],
  ['Bitácora de operaciones', '12:30'],
  ['Indicadores básicos', '16:05'],
];

/** Pantalla del quiosco de la videoteca: seis videos de ejemplo con su miniatura. */
export function dibujarQuiosco(ctx: Ctx, w: number, h: number) {
  fondo(ctx, w, h, '#08101c');
  texto(ctx, 'Videoteca', 48, 92, { peso: 800, px: 72 });
  texto(ctx, `${VIDEOS.length} videos de ejemplo`, w - 48, 88, {
    px: 32,
    color: TINTA.suave,
    alinear: 'right',
  });
  const columnas = 3;
  const gap = 28;
  const cw = (w - 96 - gap * (columnas - 1)) / columnas;
  const ch = (h - 160 - gap) / 2;
  VIDEOS.forEach(([titulo, duracion], i) => {
    const x = 48 + (i % columnas) * (cw + gap);
    const y = 130 + Math.floor(i / columnas) * (ch + gap);
    redondeado(ctx, x, y, cw, ch, 16, '#111c2e');
    const velas = generarVelas({
      semilla: 40 + i,
      cantidad: 30,
      precioInicial: 100,
      volatilidad: 0.012,
    });
    dibujarVelas(ctx, { x: x + 18, y: y + 18, w: cw - 36, h: ch * 0.5 }, velas, {
      grosor: 2,
      rejilla: false,
    });
    ctx.font = `600 26px ${FUENTE}`;
    texto(ctx, ajustar(ctx, titulo, cw - 36), x + 18, y + ch * 0.5 + 64, { px: 26, peso: 600 });
    texto(ctx, `Video · ${duracion}`, x + 18, y + ch - 22, { px: 22, color: TINTA.suave });
  });
}

// --- superficies --------------------------------------------------------------------------------

/**
 * La ciudad a la hora azul vista desde un piso alto: cielo azul profundo que se entibia en el
 * horizonte, tres capas de edificios con ventanas encendidas. Se repite a lo ancho sin costura.
 */
export function dibujarCiudad(ctx: Ctx, w: number, h: number) {
  const rnd = aleatorio(7);
  const cielo = ctx.createLinearGradient(0, 0, 0, h);
  cielo.addColorStop(0, '#0d1c36');
  cielo.addColorStop(0.45, '#1f3c68');
  cielo.addColorStop(0.75, '#4a6a98');
  cielo.addColorStop(0.9, '#a88a7a');
  cielo.addColorStop(1, '#d59a6a');
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, w, h);
  const capas = [
    { base: 0.93, alto: [0.16, 0.4], color: '#26385a', luz: 0.12, ancho: [40, 90] },
    { base: 0.97, alto: [0.22, 0.56], color: '#1a2843', luz: 0.22, ancho: [60, 130] },
    { base: 1.0, alto: [0.28, 0.72], color: '#111b2f', luz: 0.32, ancho: [80, 170] },
  ] as const;
  for (const capa of capas) {
    let x = -20;
    while (x < w) {
      const bw = capa.ancho[0] + rnd() * (capa.ancho[1] - capa.ancho[0]);
      const bh = h * (capa.alto[0] + rnd() * (capa.alto[1] - capa.alto[0]));
      const y0 = h * capa.base - bh;
      ctx.fillStyle = capa.color;
      ctx.fillRect(x, y0, bw, bh + 4);
      const vx = 7 + Math.floor(rnd() * 4);
      const vy = 9 + Math.floor(rnd() * 4);
      for (let yy = y0 + 10; yy < h * capa.base - 8; yy += vy)
        for (let xx = x + 6; xx < x + bw - 6; xx += vx) {
          if (rnd() > capa.luz) continue;
          const k = 0.45 + rnd() * 0.55;
          ctx.fillStyle =
            rnd() < 0.7
              ? `rgba(255, ${190 + Math.round(rnd() * 40)}, ${120 + Math.round(rnd() * 40)}, ${k})`
              : `rgba(170, 210, 255, ${k * 0.8})`;
          ctx.fillRect(xx, yy, vx * 0.5, vy * 0.45);
        }
      if (bh > h * 0.5 && rnd() < 0.5) {
        ctx.fillStyle = '#ff5a4a';
        ctx.fillRect(x + bw / 2 - 2, y0 - 6, 4, 4);
      }
      x += bw + rnd() * 10;
    }
  }
}

/** Piso de pizarra cálida: losas de 1,5 m con juntas finas y grano (se repite). */
export function dibujarPiso(ctx: Ctx, w: number, h: number) {
  const rnd = aleatorio(11);
  fondo(ctx, w, h, '#24211e');
  const losas = 2;
  const lado = w / losas;
  for (let i = 0; i < losas; i++)
    for (let j = 0; j < losas; j++) {
      const k = 0.94 + rnd() * 0.1;
      ctx.fillStyle = `rgb(${Math.round(64 * k)}, ${Math.round(59 * k)}, ${Math.round(54 * k)})`;
      ctx.fillRect(i * lado + 2, j * lado + 2, lado - 4, lado - 4);
    }
  for (let n = 0; n < 9000; n++) {
    const g = 60 + rnd() * 50;
    ctx.fillStyle = `rgba(${g + 6}, ${g}, ${g - 6}, ${0.1 + rnd() * 0.2})`;
    const s = rnd() < 0.92 ? 1.4 : 3;
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
}

/** Mancha radial (luz que cae al piso o sombra de contacto), blanca sobre transparente. */
export function dibujarMancha(ctx: Ctx, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Fachada de vidrio de los pisos de abajo (bajo el corte): franjas de losa, montantes cada módulo y
 * algunas oficinas encendidas. Llena la franja que, si no, quedaría vacía bajo el piso de la sala.
 * Cuatro pisos de alto; se repite.
 */
export function dibujarFachada(ctx: Ctx, w: number, h: number) {
  const rnd = aleatorio(5);
  const pisos = 4;
  const altoPiso = h / pisos;
  const modulos = 15;
  const anchoModulo = w / modulos;
  for (let p = 0; p < pisos; p++) {
    const y0 = p * altoPiso;
    const vidrio = ctx.createLinearGradient(0, y0, 0, y0 + altoPiso);
    vidrio.addColorStop(0, '#1b2f4f');
    vidrio.addColorStop(1, '#101d33');
    ctx.fillStyle = vidrio;
    ctx.fillRect(0, y0, w, altoPiso);
    for (let m = 0; m < modulos; m++) {
      if (rnd() > 0.3) continue;
      const k = 0.16 + rnd() * 0.18;
      const tono = rnd() < 0.75 ? '255, 190, 120' : '150, 200, 255';
      const luz = ctx.createLinearGradient(0, y0 + altoPiso * 0.14, 0, y0 + altoPiso);
      luz.addColorStop(0, `rgba(${tono}, ${k * 1.8})`);
      luz.addColorStop(1, `rgba(${tono}, ${k * 0.4})`);
      ctx.fillStyle = luz;
      ctx.fillRect(m * anchoModulo + 3, y0 + altoPiso * 0.14, anchoModulo - 6, altoPiso * 0.86);
      // Siluetas de los escritorios contra la luz.
      ctx.fillStyle = 'rgba(8, 13, 24, 0.55)';
      ctx.fillRect(m * anchoModulo + 6, y0 + altoPiso * 0.7, anchoModulo - 12, altoPiso * 0.08);
    }
    ctx.fillStyle = '#0a1120';
    ctx.fillRect(0, y0, w, altoPiso * 0.14);
  }
  ctx.fillStyle = 'rgba(8, 13, 24, 0.9)';
  for (let m = 0; m <= modulos; m++) ctx.fillRect(m * anchoModulo - 2, 0, 4, h);
}
