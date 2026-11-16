/**
 * Superficies y pantallas de la oficina «Nave de la mañana», dibujadas en lienzos 2D con contenido de
 * ejemplo genérico: ladrillo encalado, cemento pulido, el barrio de naves tras los ventanales, las franjas
 * de sol, el tablero del equipo, la presentación de la sala de reunión y los monitores.
 */
import { aleatorio } from '../trading/mercado';
import { CAJA_FRANJAS } from './franjas';
import type { PuntoPiso } from './franjas';

type Ctx = CanvasRenderingContext2D;

const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const PALETA = {
  papel: '#f6f1e8',
  tinta: '#2b2b2b',
  suave: '#7b7368',
  linea: 'rgba(43, 43, 43, 0.12)',
  terracota: '#c4673f',
  salvia: '#7f9b7c',
  mostaza: '#d9a441',
  petroleo: '#3f7f8f',
  crema: '#efe9df',
} as const;

function texto(
  ctx: Ctx,
  t: string,
  x: number,
  y: number,
  o: { peso?: number; px?: number; color?: string; alinear?: CanvasTextAlign } = {},
) {
  ctx.font = `${o.peso ?? 500} ${o.px ?? 32}px ${FUENTE}`;
  ctx.fillStyle = o.color ?? PALETA.tinta;
  ctx.textAlign = o.alinear ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, x, y);
}

function caja(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// --- superficies ---------------------------------------------------------------------------------

/**
 * Ladrillo encalado: aparejo a soga de 24 × 7,5 cm con junta de 1,2 cm, la cal más gruesa en unos
 * ladrillos y más delgada en otros (asoma el rojo). El lienzo cubre `PANO_LADRILLO` (1,2 m) y se repite.
 */
export function dibujarLadrillo(ctx: Ctx, w: number, h: number) {
  const rnd = aleatorio(31);
  ctx.fillStyle = '#cfc5b6';
  ctx.fillRect(0, 0, w, h);
  const hiladas = 16;
  const porHilada = 5;
  const alto = h / hiladas;
  const largo = w / porHilada;
  const junta = Math.max(2, alto * 0.16);
  for (let f = 0; f < hiladas; f++) {
    const desfase = f % 2 ? largo / 2 : 0;
    for (let i = -1; i <= porHilada; i++) {
      const x = i * largo + desfase;
      const y = f * alto;
      const cal = 0.82 + rnd() * 0.18;
      const r = Math.round(239 * cal + 217 * (1 - cal));
      const g = Math.round(233 * cal + 178 * (1 - cal));
      const b = Math.round(223 * cal + 158 * (1 - cal));
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x + junta / 2, y + junta / 2, largo - junta, alto - junta);
      // Grano de la cal sobre el ladrillo.
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,252,246' : '190,160,140'}, ${0.12 + rnd() * 0.18})`;
        ctx.fillRect(
          x + junta / 2 + rnd() * (largo - junta - 4),
          y + junta / 2 + rnd() * (alto - junta - 3),
          2 + rnd() * 6,
          1 + rnd() * 3,
        );
      }
    }
  }
}

/** Cemento pulido claro: paño de 4 m con nubes suaves, grano fino y la junta de dilatación en el borde. */
export function dibujarCemento(ctx: Ctx, w: number, h: number) {
  const rnd = aleatorio(13);
  ctx.fillStyle = '#cfc8bd';
  ctx.fillRect(0, 0, w, h);
  for (let n = 0; n < 40; n++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 180 + rnd() * 320;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const claro = rnd() < 0.5;
    g.addColorStop(0, claro ? 'rgba(236, 230, 220, 0.1)' : 'rgba(170, 160, 146, 0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let n = 0; n < 14000; n++) {
    const k = 150 + rnd() * 80;
    ctx.fillStyle = `rgba(${k + 8}, ${k + 2}, ${k - 8}, ${0.08 + rnd() * 0.14})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1.3, 1.3);
  }
  ctx.fillStyle = 'rgba(120, 110, 98, 0.55)';
  ctx.fillRect(0, 0, w, 2);
  ctx.fillRect(0, 0, 2, h);
}

/**
 * El barrio tras los ventanales a media mañana: cielo claro que se entibia en el horizonte, nubes
 * altas, naves vecinas con su propio diente de sierra, un depósito de agua, una chimenea y árboles.
 * Se repite a lo ancho sin costura.
 */
export function dibujarBarrio(ctx: Ctx, w: number, h: number) {
  const rnd = aleatorio(17);
  const cielo = ctx.createLinearGradient(0, 0, 0, h);
  cielo.addColorStop(0, '#8fbbe3');
  cielo.addColorStop(0.5, '#c4dcef');
  cielo.addColorStop(0.82, '#f1ead9');
  cielo.addColorStop(1, '#f6e6c8');
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, w, h);
  for (let n = 0; n < 16; n++) {
    const x = rnd() * w;
    const y = h * (0.08 + rnd() * 0.35);
    for (let k = 0; k < 6; k++) {
      const r = 26 + rnd() * 50;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + rnd() * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(x + k * r * 0.8 - 100, y + rnd() * 12, r * 1.8, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Naves vecinas, de la más lejana (azulada) a la más cercana (ladrillo cálido).
  const capas = [
    { base: 0.84, alto: [0.1, 0.18], color: '#b8c3c9', techo: '#a7b2b8' },
    { base: 0.92, alto: [0.14, 0.24], color: '#d9c3ad', techo: '#8d8f8f' },
  ] as const;
  for (const capa of capas) {
    let x = -40;
    while (x < w + 40) {
      const ancho = 160 + rnd() * 260;
      const alto = h * (capa.alto[0] + rnd() * (capa.alto[1] - capa.alto[0]));
      const y0 = h * capa.base - alto;
      ctx.fillStyle = capa.color;
      ctx.fillRect(x, y0, ancho, alto + 2);
      // Diente de sierra del techo.
      const dientes = Math.max(2, Math.round(ancho / 60));
      const paso = ancho / dientes;
      ctx.fillStyle = capa.techo;
      for (let d = 0; d < dientes; d++) {
        ctx.beginPath();
        ctx.moveTo(x + d * paso, y0);
        ctx.lineTo(x + d * paso, y0 - 22);
        ctx.lineTo(x + (d + 1) * paso, y0);
        ctx.closePath();
        ctx.fill();
      }
      // Ventanas en banda.
      ctx.fillStyle = 'rgba(70, 90, 105, 0.35)';
      for (let vx = x + 14; vx < x + ancho - 20; vx += 26)
        ctx.fillRect(vx, y0 + alto * 0.35, 14, alto * 0.25);
      if (rnd() < 0.25) {
        ctx.fillStyle = '#9b7b66';
        ctx.fillRect(x + ancho * 0.7, y0 - alto * 0.9, 16, alto * 0.9);
      }
      x += ancho + rnd() * 40;
    }
  }
  // Depósito de agua.
  const dx = w * 0.62;
  const dy = h * 0.62;
  ctx.strokeStyle = '#6d6a66';
  ctx.lineWidth = 4;
  for (const sx of [-34, 34]) {
    ctx.beginPath();
    ctx.moveTo(dx + sx * 0.5, dy);
    ctx.lineTo(dx + sx, dy + 110);
    ctx.stroke();
  }
  caja(ctx, dx - 40, dy - 50, 80, 56, 10, '#8a8580');
  ctx.fillStyle = '#7a756f';
  ctx.beginPath();
  ctx.moveTo(dx - 44, dy - 50);
  ctx.lineTo(dx, dy - 80);
  ctx.lineTo(dx + 44, dy - 50);
  ctx.fill();
  // Árboles delante.
  for (let x = 0; x < w; x += 30 + rnd() * 60) {
    const r = 26 + rnd() * 38;
    const y = h * 0.97 - r * 0.6;
    for (let k = 0; k < 4; k++) {
      const verde = rnd() < 0.5 ? '#6f8f52' : '#58784a';
      ctx.fillStyle = verde;
      ctx.beginPath();
      ctx.arc(x + (rnd() - 0.5) * r, y - rnd() * r * 0.6, r * (0.6 + rnd() * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#5f7448';
  ctx.fillRect(0, h * 0.97, w, h * 0.03);
}

/** Alfombra tipo kilim: campo terracota, bandas crema y salvia, flecos implícitos en el borde. */
export function dibujarAlfombra(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = '#b5704f';
  ctx.fillRect(0, 0, w, h);
  const borde = w * 0.06;
  ctx.fillStyle = '#efe0c8';
  ctx.fillRect(borde, borde, w - borde * 2, h - borde * 2);
  ctx.fillStyle = '#a9684a';
  ctx.fillRect(borde * 1.5, borde * 1.5, w - borde * 3, h - borde * 3);
  ctx.fillStyle = '#efe0c8';
  for (let i = 0; i < 6; i++) {
    const y = borde * 2 + (i * (h - borde * 4)) / 5;
    for (let x = borde * 2; x < w - borde * 2; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14, y - 10);
      ctx.lineTo(x + 28, y);
      ctx.lineTo(x + 14, y + 10);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(127, 155, 124, 0.9)';
  ctx.fillRect(w * 0.42, borde * 1.5, w * 0.16, h - borde * 3);
}

/** Franjas de sol: polígonos blancos en las coordenadas del piso, con el borde suave de la penumbra. */
export function dibujarFranjas(ctx: Ctx, w: number, h: number, polis: readonly PuntoPiso[][]) {
  const c = CAJA_FRANJAS;
  const px = (x: number) => ((x - c.x0) / (c.x1 - c.x0)) * w;
  const py = (z: number) => ((z - c.z0) / (c.z1 - c.z0)) * h;
  ctx.clearRect(0, 0, w, h);
  const trazar = () => {
    ctx.beginPath();
    for (const p of polis) {
      p.forEach((q, i) => (i === 0 ? ctx.moveTo(px(q.x), py(q.z)) : ctx.lineTo(px(q.x), py(q.z))));
      ctx.closePath();
    }
  };
  // Halo ancho y tenue, luego el paño con la penumbra corta.
  ctx.filter = `blur(${Math.round(w / 90)}px)`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  trazar();
  ctx.fill();
  ctx.filter = `blur(${Math.max(1, Math.round(w / 700))}px)`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  trazar();
  ctx.fill();
  ctx.filter = 'none';
}

// --- pantallas ---------------------------------------------------------------------------------

const COLUMNAS_TABLERO: readonly { titulo: string; tarjetas: [string, string][] }[] = [
  {
    titulo: 'Por hacer',
    tarjetas: [
      ['Encuesta de clima', PALETA.salvia],
      ['Guía de estilo', PALETA.terracota],
      ['Ordenar el archivo', PALETA.mostaza],
    ],
  },
  {
    titulo: 'En curso',
    tarjetas: [
      ['Nueva portada', PALETA.terracota],
      ['Taller del jueves', PALETA.petroleo],
    ],
  },
  {
    titulo: 'En revisión',
    tarjetas: [
      ['Informe mensual', PALETA.mostaza],
      ['Propuesta de mobiliario', PALETA.salvia],
    ],
  },
  {
    titulo: 'Hecho',
    tarjetas: [
      ['Mudanza del servidor', PALETA.petroleo],
      ['Bienvenida al equipo', PALETA.salvia],
      ['Inventario de equipos', PALETA.terracota],
    ],
  },
];

/** El tablero del equipo: cuatro columnas de tarjetas de ejemplo, en claro (pantalla de día). */
export function dibujarTablero(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = PALETA.papel;
  ctx.fillRect(0, 0, w, h);
  const pad = w * 0.035;
  texto(ctx, 'Tablero del equipo', pad, h * 0.13, { peso: 800, px: Math.round(h * 0.085) });
  texto(ctx, 'Esta semana', w - pad, h * 0.125, {
    px: Math.round(h * 0.05),
    color: PALETA.suave,
    alinear: 'right',
    peso: 600,
  });
  const top = h * 0.2;
  const gap = w * 0.018;
  const cw = (w - pad * 2 - gap * 3) / 4;
  const th = h * 0.15;
  COLUMNAS_TABLERO.forEach((col, i) => {
    const x = pad + i * (cw + gap);
    caja(ctx, x, top, cw, h - top - pad, 18, '#ebe3d6');
    texto(ctx, col.titulo, x + 22, top + h * 0.07, { peso: 700, px: Math.round(h * 0.052) });
    texto(ctx, String(col.tarjetas.length), x + cw - 22, top + h * 0.07, {
      peso: 700,
      px: Math.round(h * 0.045),
      color: PALETA.suave,
      alinear: 'right',
    });
    col.tarjetas.forEach(([t, color], k) => {
      const y = top + h * 0.1 + k * (th + h * 0.025);
      caja(ctx, x + 14, y, cw - 28, th, 12, '#ffffff');
      caja(ctx, x + 14, y, 12, th, 6, color);
      ctx.font = `600 ${Math.round(h * 0.042)}px ${FUENTE}`;
      let s = t;
      while (s.length > 1 && ctx.measureText(s).width > cw - 80) s = s.slice(0, -1);
      texto(ctx, s === t ? t : `${s.trimEnd()}…`, x + 40, y + th * 0.48, {
        peso: 600,
        px: Math.round(h * 0.042),
      });
      // Avatares de quien la tiene.
      for (let a = 0; a < 1 + ((i + k) % 2); a++) {
        ctx.fillStyle = [PALETA.terracota, PALETA.salvia, PALETA.mostaza][(i + k + a) % 3]!;
        ctx.beginPath();
        ctx.arc(x + 52 + a * 30, y + th * 0.76, h * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });
}

/** La presentación de la sala de reunión: una lámina de ejemplo con un gráfico de barras. */
export function dibujarPresentacion(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = '#fbf8f2';
  ctx.fillRect(0, 0, w, h);
  const pad = w * 0.06;
  texto(ctx, 'Revisión del trimestre', pad, h * 0.2, { peso: 800, px: Math.round(h * 0.11) });
  texto(ctx, 'Lo que avanzamos y lo que sigue', pad, h * 0.3, {
    px: Math.round(h * 0.055),
    color: PALETA.suave,
  });
  const barras = [0.45, 0.62, 0.55, 0.78, 0.9];
  const base = h * 0.88;
  const bw = (w * 0.45) / barras.length;
  barras.forEach((v, i) => {
    const bh = v * h * 0.45;
    caja(
      ctx,
      pad + i * bw * 1.15,
      base - bh,
      bw * 0.8,
      bh,
      8,
      i === barras.length - 1 ? PALETA.terracota : PALETA.salvia,
    );
  });
  const puntos = ['Más equipo en terreno', 'Tiempos de respuesta', 'Próximo taller'];
  puntos.forEach((p, i) => {
    const y = h * 0.5 + i * h * 0.13;
    ctx.fillStyle = PALETA.terracota;
    ctx.beginPath();
    ctx.arc(w * 0.6, y - h * 0.018, h * 0.016, 0, Math.PI * 2);
    ctx.fill();
    texto(ctx, p, w * 0.63, y, { px: Math.round(h * 0.052), peso: 600 });
  });
}

export const ATLAS_MONITOR = { columnas: 4, filas: 2, celda: { w: 320, h: 190 } } as const;

/** Ocho pantallas de trabajo de ejemplo (código, documento, planilla, tablero, diseño, chat, panel, agenda). */
export function dibujarAtlasMonitores(ctx: Ctx) {
  const { celda, columnas } = ATLAS_MONITOR;
  const rnd = aleatorio(5);
  for (let i = 0; i < 8; i++) {
    const x0 = (i % columnas) * celda.w;
    const y0 = Math.floor(i / columnas) * celda.h;
    ctx.save();
    ctx.translate(x0, y0);
    const oscuro = i === 0 || i === 6;
    ctx.fillStyle = oscuro ? '#1f2328' : '#fbfaf7';
    ctx.fillRect(0, 0, celda.w, celda.h);
    ctx.fillStyle = oscuro ? '#2c3238' : '#ece6dc';
    ctx.fillRect(0, 0, celda.w, 18);
    const lineas = (color: string, x: number, y: number, n: number, ancho: number) => {
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y + k * 14, ancho * (0.4 + rnd() * 0.6), 6);
      }
    };
    switch (i) {
      case 0:
        for (let k = 0; k < 11; k++) {
          ctx.fillStyle = ['#e5a96b', '#8fc2a0', '#9fb6d8', '#d8d2c8'][k % 4]!;
          ctx.fillRect(16 + (k % 3) * 14, 28 + k * 14, 60 + rnd() * 150, 6);
        }
        break;
      case 1:
        ctx.fillStyle = PALETA.tinta;
        ctx.fillRect(40, 32, 160, 12);
        lineas('#b5aea4', 40, 56, 9, 240);
        break;
      case 2:
        ctx.strokeStyle = '#d9d2c7';
        for (let x = 10; x < celda.w; x += 50) ctx.strokeRect(x, 24, 50, celda.h - 30);
        for (let y = 24; y < celda.h; y += 16) ctx.strokeRect(10, y, celda.w - 20, 16);
        ctx.fillStyle = 'rgba(127,155,124,0.35)';
        ctx.fillRect(60, 56, 50, 64);
        break;
      case 3:
        for (let c = 0; c < 3; c++) {
          caja(ctx, 12 + c * 102, 26, 94, celda.h - 34, 6, '#efe9df');
          for (let k = 0; k < 3 - (c % 2); k++)
            caja(
              ctx,
              18 + c * 102,
              34 + k * 42,
              82,
              34,
              4,
              [PALETA.salvia, PALETA.terracota, PALETA.mostaza][(c + k) % 3]!,
            );
        }
        break;
      case 4:
        ctx.fillStyle = '#e9e4dc';
        ctx.fillRect(60, 24, 200, celda.h - 30);
        ctx.fillStyle = PALETA.terracota;
        ctx.beginPath();
        ctx.arc(130, 90, 34, 0, Math.PI * 2);
        ctx.fill();
        caja(ctx, 160, 60, 80, 60, 8, PALETA.salvia);
        break;
      case 5:
        for (let k = 0; k < 5; k++) {
          const mio = k % 2 === 1;
          caja(ctx, mio ? 120 : 16, 28 + k * 31, 170, 24, 10, mio ? PALETA.salvia : '#ebe5da');
        }
        break;
      case 6:
        for (let k = 0; k < 4; k++) caja(ctx, 12 + k * 76, 28, 68, 50, 6, '#2c3238');
        ctx.strokeStyle = '#e5a96b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let k = 0; k < 20; k++) {
          const x = 14 + k * 15;
          const y = 160 - k * 3 - rnd() * 20;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;
      default:
        for (let d = 0; d < 5; d++)
          for (let s = 0; s < 4; s++)
            if (rnd() < 0.45)
              caja(
                ctx,
                14 + d * 60,
                28 + s * 38,
                54,
                30,
                4,
                [PALETA.petroleo, PALETA.salvia, PALETA.mostaza][(d + s) % 3]!,
              );
    }
    ctx.restore();
  }
}
