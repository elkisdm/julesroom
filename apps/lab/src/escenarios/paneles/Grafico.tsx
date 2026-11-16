import { useEffect, useRef } from 'react';
import { analizar, buscarActivo, formatoPrecio, serieVelas } from './analisis';
import type { ActivoId, Temporalidad } from './analisis';

/** Gráfico de velas de EJEMPLO dibujado en un lienzo propio, con los soportes y resistencias de la serie. */
export function Grafico({ activo, tf }: { activo: ActivoId; tf: Temporalidad }) {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = lienzo.current;
    if (!el) return;
    const dibujar = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width: ancho, height: alto } = el.getBoundingClientRect();
      el.width = Math.round(ancho * dpr);
      el.height = Math.round(alto * dpr);
      const g = el.getContext('2d');
      if (!g) return;
      g.scale(dpr, dpr);
      const css = getComputedStyle(el);
      const color = (v: string) => css.getPropertyValue(v).trim();
      const velas = serieVelas(activo, tf);
      const a = analizar(activo, tf);
      const decimales = buscarActivo(activo).decimales;
      const margenDer = 62;
      const alturaUtil = alto - 8;
      const lo = Math.min(...velas.map((v) => v.min), a.soportes[0]!.precio);
      const hi = Math.max(...velas.map((v) => v.max), a.resistencias[0]!.precio);
      const y = (p: number) => 4 + ((hi - p) / (hi - lo)) * alturaUtil;
      const paso = (ancho - margenDer) / velas.length;
      g.font = '11px system-ui, sans-serif';
      g.textBaseline = 'middle';
      for (const [nivel, tono] of [
        ...a.soportes.slice(0, 2).map((n) => [n, color('--sube')] as const),
        ...a.resistencias.slice(0, 2).map((n) => [n, color('--baja')] as const),
      ]) {
        g.strokeStyle = tono;
        g.globalAlpha = 0.55;
        g.setLineDash([4, 4]);
        g.beginPath();
        g.moveTo(0, y(nivel.precio));
        g.lineTo(ancho - margenDer, y(nivel.precio));
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
        g.fillStyle = tono;
        g.fillText(`${nivel.id} ${formatoPrecio(nivel.precio, decimales)}`, ancho - margenDer + 6, y(nivel.precio));
      }
      velas.forEach((v, i) => {
        const x = i * paso + paso / 2;
        g.strokeStyle = g.fillStyle = v.cierre >= v.apertura ? color('--sube') : color('--baja');
        g.beginPath();
        g.moveTo(x, y(v.max));
        g.lineTo(x, y(v.min));
        g.stroke();
        const top = y(Math.max(v.apertura, v.cierre));
        g.fillRect(x - paso * 0.32, top, paso * 0.64, Math.max(1, y(Math.min(v.apertura, v.cierre)) - top));
      });
    };
    dibujar();
    const obs = new ResizeObserver(dibujar);
    obs.observe(el);
    return () => obs.disconnect();
  }, [activo, tf]);

  return (
    <canvas
      ref={lienzo}
      className="pn-grafico"
      role="img"
      aria-label={`Gráfico de ejemplo de ${buscarActivo(activo).simbolo}`}
    />
  );
}
