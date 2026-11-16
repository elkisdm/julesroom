import type { ReactElement } from 'react';
/** Miniatura de un objeto del catálogo, dibujada de frente desde sus propias piezas (misma fuente que el 3D). */
import { tipoObjeto } from '@oficina/motor';
import { piezaDe } from './piezas';

const cache = new Map<string, ReactElement>();

export function Miniatura({ tipo }: { tipo: string }) {
  const previa = cache.get(tipo);
  if (previa) return previa;
  const t = tipoObjeto(tipo);
  if (!t) return null;
  const plano = t.alto < 0.1;
  // De frente se ven ancho × alto; lo plano (alfombra) se ve desde arriba: ancho × fondo.
  const w = t.ancho;
  const h = plano ? t.fondo : t.alto;
  const escala = 52 / Math.max(w, h);
  const W = w * escala;
  const H = h * escala;
  const ox = (64 - W) / 2;
  const oy = 58 - (plano ? (64 + H) / 2 - 6 : 0);
  const partes = piezaDe(tipo)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.c[2] - b.p.c[2]);
  const dibujo = (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      {partes.map(({ p, i }) => {
        const pw = p.s[0] * W;
        const ph = (plano ? p.s[2] : p.s[1]) * H;
        const cx = ox + (p.c[0] + 0.5) * W;
        const cy = plano ? oy - (p.c[2] + 0.5) * H : oy - p.c[1] * H;
        if (p.f === 'esfera')
          return (
            <ellipse
              key={i}
              cx={cx}
              cy={cy}
              rx={pw / 2}
              ry={ph / 2}
              fill={p.color}
              opacity={p.opacidad}
            />
          );
        return (
          <rect
            key={i}
            x={cx - pw / 2}
            y={cy - ph / 2}
            width={Math.max(pw, 1.2)}
            height={Math.max(ph, 1.2)}
            rx={p.f === 'cil' ? Math.min(pw, ph) * 0.18 : 1}
            fill={p.color}
            opacity={p.opacidad}
          />
        );
      })}
    </svg>
  );
  cache.set(tipo, dibujo);
  return dibujo;
}
