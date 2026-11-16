import type { CSSProperties } from 'react';

// Geometría propia, caja común de 24; el núcleo relleno distingue la selección sin usar color.
const trazos = {
  moverse: 'm12 3 7 18-7-4-7 4 7-18Z M12 3v14',
  construir: 'm4 8 8-5 8 5v9l-8 5-8-5V8Z m0 0 8 5 8-5 M12 13v9',
  personas:
    'M16 21v-3a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v3 M17 4a4 4 0 0 1 0 8 M20 21v-3a4 4 0 0 0-3-4 M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  conversacion: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z M7 9h10 M7 13h6',
  presentar: 'M3 4h18v12H3V4Z M12 16v5 M8 21h8 M8 8h8 M8 12h5',
  ajustes:
    'M4 7h7 M15 7h5 M4 17h3 M11 17h9 M15 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z M11 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  cerrar: 'm6 6 12 12 M18 6 6 18',
  abajo: 'm7 10 5 5 5-5',
  derecha: 'm10 6 6 6-6 6',
  atras: 'm14 5-7 7 7 7 M7 12h14',
  mas: 'M12 5v14 M5 12h14',
  menos: 'M5 12h14',
  buscar: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z m-2 5 6 6',
  microfono: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8',
  silencio: 'm3 3 18 18 M9 5a3 3 0 0 1 6 0v6 M5 10v2a7 7 0 0 0 11 5 M12 19v3 M8 22h8',
  reaccion: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M8 9h.01 M16 9h.01 M8 14q4 5 8 0',
  saltar: 'M12 18V3 m-5 5 5-5 5 5 M4 19v3h16v-3',
  sentarse: 'M6 4v11h13 M6 9h10v6 M6 15v6 M18 15v6 M3 15h3',
  vista: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  sol: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M12 2v2 M12 20v2 M2 12h2 M20 12h2 m-3-9-2 2 M7 17l-2 2 m0-14 2 2 m10 10 2 2',
  luna: 'M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z',
  contraste: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 3v18 M12 7h6 M12 10h8 M12 13h8 M12 16h7',
  telefono: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z M10 18h4',
  listo: 'm5 12 4 4L19 6',
  guardar: 'M5 3h12l4 4v14H3V3h2Z M7 3v6h10V3 M7 21v-8h10v8',
  enlace: 'm9 15 6-6 M8 10l-3 3a4 4 0 0 0 6 6l3-3 M10 8l3-3a4 4 0 0 1 6 6l-3 3',
  planta: 'M12 21v-9 M12 15C3 15 3 9 3 9c9 0 9 6 9 6Z M12 11s0-8 9-8c0 0 0 8-9 8Z M8 21h8',
  mesa: 'M3 8h18v4H3V8Z M5 12v9 M19 12v9',
  lampara: 'm8 3-4 10h16L16 3H8Z M12 13v8 M8 21h8',
  deshacer: 'M4 10h10a6 6 0 0 1 0 12 M4 10l5-5 M4 10l5 5',
  enviar: 'm3 3 19 9-19 9 4-9-4-9Z M7 12h15',
  ayuda: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M9 8a3 3 0 1 1 4 3c-1 0-1 1-1 3 M12 17h.01',
  salir: 'M9 3H3v18h6 M8 12h13 m-5-5 5 5-5 5',
  grabar: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
} as const;
export type NombreIcono = keyof typeof trazos;
const rellenos: Partial<Record<NombreIcono, string>> = {
  personas: 'M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M4 21v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3Z',
  conversacion: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z',
  presentar: 'M3 4h18v12H3Z',
  ajustes: 'M15 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z M11 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  microfono: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0Z',
  vista: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
};
export const ICONOS = Object.keys(trazos) as NombreIcono[];
export function Icono({
  nombre,
  activo = false,
  tamano,
}: {
  nombre: NombreIcono;
  activo?: boolean;
  tamano?: number;
}) {
  return (
    <svg
      className="jr-icono"
      style={tamano ? ({ width: tamano, height: tamano } as CSSProperties) : undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {activo && rellenos[nombre] && (
        <path d={rellenos[nombre]} fill="currentColor" stroke="none" />
      )}
      <path
        d={trazos[nombre]}
        fill={
          activo && ['moverse', 'construir', 'grabar'].includes(nombre) ? 'currentColor' : 'none'
        }
      />
    </svg>
  );
}
