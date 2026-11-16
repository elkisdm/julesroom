import type { Lugar, Mueble } from '../../mansion/plano';
import type { Planta } from '../tipos';

/** 44 × 32 m: tarima de 20 m, centro libre de 16 × 12 m y pasillos amplios para 20–25 personas. */
export const SALA = { x0: -22, x1: 22, z0: -16, z1: 16, alto: 6.4 } as const;
export const TARIMA = { x0: -10, x1: 10, z0: -15, z1: -9.5, y: 0.4 } as const;
export const ESCALON = { x0: -10, x1: 10, z0: -9.5, z1: -8.8, y: 0.2 } as const;
/** Muro de fondo (cara interior) y punto al que miran las butacas. */
export const FONDO_Z = -15;
export const MIRA_PUBLICO = { x: 0, z: -12 } as const;
export const BUTACA = { ancho: 0.72, fondo: 0.72, alto: 0.95, pelvis: 0.46 } as const;
export const PLANTAS = [
  { x: -20, z: -13 },
  { x: 20, z: -13 },
  { x: -20, z: 13 },
  { x: 20, z: 13 },
];

/** Tres filas curvas; pasillo central de 4,4 m, 2 m entre butacas y 2,2 m entre filas. */
export const BUTACAS = [9, 8, 8].flatMap((cantidad, fila) =>
  Array.from({ length: cantidad }, (_, i) => {
    const lado = i < Math.ceil(cantidad / 2) ? -1 : 1;
    const j = lado < 0 ? Math.ceil(cantidad / 2) - 1 - i : i - Math.ceil(cantidad / 2);
    const x = lado * (2.2 + j * 2);
    const z = 7 + fila * 2.2 - 0.012 * x * x;
    return {
      id: `butaca-${fila + 1}-${i + 1}`,
      x,
      z,
      giro: Math.atan2(MIRA_PUBLICO.x - x, MIRA_PUBLICO.z - z),
    };
  }),
);

const muebles: Mueble[] = [
  ...BUTACAS.map((b): Mueble => ({
    ...b,
    tipo: 'silla',
    ambiente: 'publico',
    y: 0,
    ancho: BUTACA.ancho,
    fondo: BUTACA.fondo,
    alto: BUTACA.alto,
    conjunto: b.id,
    pisable: false,
  })),
  ...PLANTAS.map((p, i): Mueble => ({
    ...p,
    id: `planta-${i}`,
    tipo: 'maceta',
    ambiente: 'publico',
    y: 0,
    ancho: 1,
    fondo: 1,
    alto: 2.2,
    giro: 0,
    conjunto: `planta-${i}`,
    pisable: false,
  })),
];
const lugares: Lugar[] = [
  ...BUTACAS.map((b): Lugar => ({
    id: b.id,
    ambiente: 'publico',
    departamento: null,
    x: b.x,
    z: b.z,
    y: 0,
    yaw: b.giro,
    asiento: true,
    mira: MIRA_PUBLICO,
    salida: { x: b.x + Math.sin(b.giro), z: b.z + Math.cos(b.giro) },
    silla: b.id,
    extra: false,
  })),
  ...[-13, -11.2, -9.4].map((z, i): Lugar => ({
    id: `produccion-${i}`,
    ambiente: 'produccion',
    departamento: 'equipo-1',
    x: -16,
    z,
    y: 0,
    yaw: Math.PI / 2,
    asiento: false,
    mira: MIRA_PUBLICO,
    salida: { x: -15, z },
    silla: null,
    extra: false,
  })),
];

export const planta: Planta = {
  ambientes: [
    {
      id: 'publico',
      nombre: 'Sala Encuentro',
      ...SALA,
      nivel: 'piso1',
      y: 0,
      departamento: null,
      pasilloZ: 4.5,
    },
    {
      id: 'produccion',
      nombre: 'Producción',
      x0: -19,
      x1: -13,
      z0: -15,
      z1: -7,
      nivel: 'piso1',
      y: 0,
      alto: 0,
      departamento: 'equipo-1',
      pasilloZ: -6.5,
    },
  ],
  muebles,
  lugares,
  muros: [
    {
      id: 'fondo',
      nivel: 'piso1',
      eje: 'z',
      pos: FONDO_Z - 0.1,
      desde: SALA.x0,
      hasta: SALA.x1,
      tipo: 'borde',
      vano: null,
    },
  ],
  vanos: [],
  escaleras: [],
  huecos: [],
  cafe: [
    { x: -18, z: -5 },
    { x: -17, z: -5 },
    { x: -16, z: -5 },
    { x: -15, z: -5 },
  ],
  luz: null,
  asistente: { x: -15, y: 1.5, z: -12 },
  niveles: [0],
};
