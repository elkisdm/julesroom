import type { Tema } from './contenido';

const TONO: Record<Tema, number> = { velas: 210, niveles: 165, riesgo: 20, indicadores: 275, calendario: 45 };

/** Portada de ejemplo de una lección o video: una línea de precio generada con la semilla. */
export function Portada({ tema, semilla, className }: { tema: Tema; semilla: number; className?: string }) {
  const tono = TONO[tema];
  let a = semilla * 9301 + 49297;
  const siguiente = () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
  let y = 50;
  const puntos = Array.from({ length: 24 }, (_, i) => {
    y = Math.min(80, Math.max(20, y + (siguiente() - 0.5) * 22));
    return `${(i * 100) / 23},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg
      className={className}
      viewBox="0 0 100 56"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Portada de ${tema}`}
      style={{ background: `linear-gradient(135deg, hsl(${tono} 38% 24%), hsl(${tono + 30} 42% 12%))` }}
    >
      <polyline
        points={puntos}
        transform="scale(1 0.7) translate(0 8)"
        fill="none"
        stroke={`hsl(${tono} 80% 72%)`}
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
