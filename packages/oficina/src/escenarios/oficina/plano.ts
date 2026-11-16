/**
 * Planta de la oficina «Nave de la mañana»: una nave industrial reconvertida, de un nivel, con techo en
 * diente de sierra. Al centro, cuatro mesas largas compartidas (una por equipo) en dos filas; al fondo, el
 * muro-tablero del equipo; a la izquierda, la caja de vidrio de reunión y el lounge con la biblioteca; a la
 * derecha, la cocina con su isla y el descanso con las bicicletas; al frente, mesas altas para trabajar de pie.
 *
 * Mismas convenciones que `mansion/plano.ts`: metros, x de oeste a este, z hacia la cámara (el borde +z
 * es el corte abierto; −z es el norte), yaw según `atan2(x, z)` (0 mira a la cámara, π al fondo). Un lugar
 * sentado está dentro de su silla; uno de pie, a más de 0,3 m de todo mueble. Desde cada salida hay un
 * carril recto hasta el pasillo de su ambiente, y desde cada pasillo uno recto hacia el este hasta el
 * carril del café (x = `CAFE_X`), que baja libre hasta la isla de la cocina.
 */
import type { Ambiente, Lugar, Mueble, Muro, PuntoXZ } from '../../mansion/plano';
import type { Planta } from '../tipos';

const PI = Math.PI;

/** La nave: muros en x = ±17 y z = −12; hacia la cámara (z = 8) el piso queda abierto. */
export const SALA = { x0: -17, x1: 17, z0: -12, z1: 8, alto: 4.6, cumbrera: 6.4 } as const;

/**
 * Diente de sierra: cada diente tiene su vidriera vertical en `z` (mira al norte, −z) desde el alero hasta
 * la cumbrera, y su faldón baja hacia la cámara hasta el diente siguiente. El primero es la banda de vidrio
 * alta del muro del fondo.
 */
export const DIENTES = [-12, -7, -2, 3] as const;
export const PROFUNDIDAD_DIENTE = 5;

/**
 * Dirección HACIA el sol que dibuja las franjas (sol de las 10 que entra por las vidrieras del diente de
 * sierra, desde el noreste). Es una dirección de estilo para las proyecciones baratas sobre piso y mesas.
 */
export const SOL_FRANJAS = { x: 0.55, y: 0.62, z: -0.56 } as const;

/** Mesas largas compartidas: 4,6 × 1,2 m, 4 sillas por lado. */
export const MESA = { largo: 4.6, fondo: 1.2, alto: 0.75 } as const;
export const SILLA = { ancho: 0.5, fondo: 0.5, alto: 0.9 } as const;
/** Desplazamiento en x de las 4 sillas de cada lado respecto del centro de la mesa. */
export const SILLAS_DX = [-1.65, -0.55, 0.55, 1.65] as const;
/** Distancia del centro de la mesa a la silla y a la salida (detrás del respaldo). */
const SILLA_DZ = 1.0;
const SALIDA_DZ = 1.6;

/** Las cuatro mesas, una por equipo: fila del fondo (1 y 2) y fila del frente (3 y 4). */
export const MESAS: readonly { equipo: number; x: number; z: number }[] = [
  { equipo: 1, x: -4.6, z: -6 },
  { equipo: 2, x: 4.6, z: -6 },
  { equipo: 3, x: -4.6, z: -0.6 },
  { equipo: 4, x: 4.6, z: -0.6 },
];
export const EQUIPOS = MESAS.length;

/** Pasillos (z) de cada franja: tras la fila del fondo, entre filas (dos carriles) y tras la del frente. */
export const PASILLOS = { norteA: -7.75, surA: -3.6, norteB: -3.0, surB: 1.3, paso: 5.0 } as const;

/** Caja de vidrio de reunión, con la puerta al frente. */
export const REUNION = {
  zona: { x0: SALA.x0, x1: -9.5, z0: SALA.z0, z1: -5 },
  puerta: { x0: -13.9, x1: -12.5 },
  mesa: { x: -13.25, z: -8.4, ancho: 3.4, fondo: 1.3 },
  sillasX: [-14.4, -13.25, -12.1],
  pantalla: { x: -13.25, y: 1.95, z: -11.86, ancho: 3.2, alto: 1.8 },
} as const;

/** Muro-tablero del equipo, al fondo al centro, con su credenza debajo. */
export const TABLERO = {
  pantalla: { x: 0, y: 2.3, z: -11.86, ancho: 7.2, alto: 2.7 },
  credenza: { x: 0, z: -11.75, ancho: 6, fondo: 0.5, alto: 0.6 },
} as const;

/** Ventanales de acero del muro del fondo (x) y del muro este (z), de `y0` a `y1`. */
export const VENTANAS_FONDO: readonly { x0: number; x1: number }[] = [
  { x0: -8.6, x1: -4.6 },
  { x0: 4.6, x1: 8.6 },
];
export const VENTANAS_ESTE: readonly { z0: number; z1: number }[] = [
  { z0: -2.6, z1: 2.4 },
  { z0: 3.2, z1: 7.6 },
];
export const VENTANAS_OESTE: readonly { z0: number; z1: number }[] = [{ z0: 2.6, z1: 7.6 }];
export const VENTANA_Y = { y0: 0.55, y1: 4.1 } as const;

/** Cocina: encimera contra el fondo, nevera, isla larga en z con taburetes al este. */
export const COCINA = {
  zona: { x0: 9.5, x1: SALA.x1, z0: SALA.z0, z1: -3.3 },
  encimera: { x0: 9.8, x1: 16.1, z0: SALA.z0, z1: -11.35, alto: 0.92 },
  nevera: { x0: 16.1, x1: 17, z0: SALA.z0, z1: -11.3, alto: 2.2 },
  isla: { x0: 13.2, x1: 14.4, z0: -10.2, z1: -4.6, alto: 0.95 },
  taburetesZ: [-9.4, -8.2, -7, -5.8],
  taburetesX: 14.95,
} as const;
/** Carril del café: los puntos de pausa están al oeste de la isla, todos en esta x. */
export const CAFE_X = 12.5;

/** Lounge y biblioteca (izquierda, al frente de la sala de reunión). */
export const LOUNGE = {
  zona: { x0: SALA.x0, x1: -9.5, z0: -5, z1: SALA.z1 },
  estanteria: { x0: -17, x1: -16.55, z0: -3.6, z1: 1.9, alto: 2.4 },
  alfombra: { x: -13.1, z: 1.9, ancho: 5.6, fondo: 4.8 },
  sofa: { x: -15.5, z: 1.9, largo: 2.4, fondo: 0.95 },
  sillones: [
    { x: -11.0, z: 1.1 },
    { x: -11.0, z: 2.7 },
  ],
  mesa: { x: -13.2, z: 1.9 },
} as const;

/** Descanso (derecha, al frente de la cocina): sofá contra el muro este, sillones y bicicletas. */
export const DESCANSO = {
  zona: { x0: 9.5, x1: SALA.x1, z0: -3.3, z1: SALA.z1 },
  alfombra: { x: 14.9, z: -0.6, ancho: 3.6, fondo: 3.4 },
  sofa: { x: 16.4, z: -0.6, largo: 2.4, fondo: 0.95 },
  sillones: [
    { x: 13.65, z: -1.4 },
    { x: 13.65, z: 0.2 },
  ],
  mesa: { x: 15.0, z: -0.6 },
  bicicletas: [5.0, 5.75, 6.5],
} as const;
/** Largo de una bicicleta (en x, contra el muro este). */
export const BICI = { x0: 15.2, x1: 16.9 } as const;

/** Mesas altas para trabajar de pie, al frente. */
export const MESAS_ALTAS: readonly PuntoXZ[] = [
  { x: -6.2, z: 3.7 },
  { x: 0, z: 3.7 },
  { x: 6.2, z: 3.7 },
];
export const MESA_ALTA = { radio: 0.55, alto: 1.05 } as const;

/** Columnas de acero de la nave (al fondo, en la esquina de la sala de reunión y junto a la cocina). */
export const COLUMNAS: readonly PuntoXZ[] = [
  { x: -9.5, z: -10.5 },
  { x: 9.5, z: -10.5 },
];

/** Macetas grandes (higueras, monsteras): todas lejos de los pasillos y del carril del café. */
export const PLANTAS: readonly PuntoXZ[] = [
  { x: -8.9, z: -11.4 },
  { x: 8.9, z: -11.4 },
  { x: -16.3, z: -4.35 },
  { x: -16.3, z: 7.2 },
  { x: -10.2, z: 7.2 },
  { x: 11.0, z: -0.8 },
  { x: 16.3, z: -2.8 },
  { x: 16.3, z: 7.3 },
  { x: -16.2, z: -11.3 },
];

// --- ambientes -------------------------------------------------------------------------------

function ambiente(
  id: string,
  nombre: string,
  c: { x0: number; x1: number; z0: number; z1: number },
  departamento: string | null,
  pasilloZ: number,
): Ambiente {
  return {
    id,
    nombre,
    nivel: 'piso1',
    y: 0,
    alto: SALA.alto,
    ...c,
    departamento,
    pasilloZ,
  };
}

/** Las cuatro franjas de las mesas (de cada mesa se sale por su lado: no se cruza la cubierta). */
const FRANJAS = [
  { lado: 'norte', z0: -8.4, z1: -6, fila: 0, pasillo: PASILLOS.norteA },
  { lado: 'sur', z0: -6, z1: -3.3, fila: 0, pasillo: PASILLOS.surA },
  { lado: 'norte', z0: -3.3, z1: -0.6, fila: 1, pasillo: PASILLOS.norteB },
  { lado: 'sur', z0: -0.6, z1: 2.4, fila: 1, pasillo: PASILLOS.surB },
] as const;

/** Ambiente de la mitad `lado` de la mesa del equipo `k`. */
export const ambienteMesa = (k: number, lado: 'norte' | 'sur'): string => `equipo-${k}-${lado}`;

const ambientes: Ambiente[] = [
  ambiente('reunion', 'Sala de reunión', REUNION.zona, null, -6),
  ambiente('lounge', 'Lounge', LOUNGE.zona, null, 5.6),
  ambiente('tablero', 'Tablero', { x0: -9.5, x1: 9.5, z0: SALA.z0, z1: -8.4 }, null, -9.6),
  ...FRANJAS.flatMap((f) =>
    MESAS.filter((m) => (f.fila === 0 ? m.z < -3 : m.z > -3)).map((m) =>
      ambiente(
        ambienteMesa(m.equipo, f.lado),
        `Equipo ${m.equipo}`,
        { x0: m.x < 0 ? -9.5 : 0, x1: m.x < 0 ? 0 : 9.5, z0: f.z0, z1: f.z1 },
        `equipo-${m.equipo}`,
        f.pasillo,
      ),
    ),
  ),
  ambiente(
    'paso',
    'Mesas de pie',
    { x0: -9.5, x1: 9.5, z0: 2.4, z1: SALA.z1 },
    null,
    PASILLOS.paso,
  ),
  ambiente('cocina', 'Cocina', COCINA.zona, null, -5),
  ambiente('descanso', 'Descanso', DESCANSO.zona, null, 2),
];

// --- muebles y lugares ------------------------------------------------------------------------

const muebles: Mueble[] = [];
const lugares: Lugar[] = [];

function ambienteEn(p: PuntoXZ): Ambiente {
  const a = ambientes.find((u) => p.x >= u.x0 && p.x <= u.x1 && p.z >= u.z0 && p.z <= u.z1);
  if (!a) throw new Error(`Punto fuera de la nave: ${p.x}, ${p.z}`);
  return a;
}

function mueble(
  id: string,
  tipo: string,
  x: number,
  z: number,
  medidas: { ancho: number; fondo: number; alto: number },
  extra: { giro?: number; y?: number; conjunto?: string } = {},
): Mueble {
  const m: Mueble = {
    id,
    tipo,
    ambiente: ambienteEn({ x, z }).id,
    x,
    z,
    y: extra.y ?? 0,
    ancho: medidas.ancho,
    fondo: medidas.fondo,
    alto: medidas.alto,
    giro: extra.giro ?? 0,
    conjunto: extra.conjunto ?? id,
  };
  muebles.push(m);
  return m;
}

/** Un mueble dado por su caja (sin giro). */
function muebleCaja(
  id: string,
  tipo: string,
  c: { x0: number; x1: number; z0: number; z1: number; alto: number },
  conjunto?: string,
): Mueble {
  return mueble(
    id,
    tipo,
    (c.x0 + c.x1) / 2,
    (c.z0 + c.z1) / 2,
    { ancho: c.x1 - c.x0, fondo: c.z1 - c.z0, alto: c.alto },
    { conjunto: conjunto ?? id },
  );
}

function lugar(
  departamento: string | null,
  x: number,
  z: number,
  yaw: number,
  mira: PuntoXZ,
  salida: PuntoXZ,
  silla: string | null,
  extra: boolean,
): void {
  const amb = ambienteEn({ x, z }).id;
  lugares.push({
    id: `${amb}-${lugares.filter((l) => l.ambiente === amb).length + 1}`,
    ambiente: amb,
    departamento,
    x,
    z,
    y: 0,
    yaw,
    asiento: silla !== null,
    mira,
    salida,
    silla,
    extra,
  });
}

// Mesas largas: 4 sillas por lado. Las del norte miran a la cámara (yaw 0); las del sur, al fondo.
for (const m of MESAS) {
  const equipo = `equipo-${m.equipo}`;
  const conjunto = `mesa-${m.equipo}`;
  mueble(conjunto, 'mesa-larga', m.x, m.z, {
    ancho: MESA.largo,
    fondo: MESA.fondo,
    alto: MESA.alto,
  });
  for (const [s, yaw] of [
    [-1, 0],
    [1, PI],
  ] as const) {
    for (const [k, dx] of SILLAS_DX.entries()) {
      const x = m.x + dx;
      const z = m.z + s * SILLA_DZ;
      const silla = mueble(`${conjunto}-silla-${s < 0 ? 'n' : 's'}${k + 1}`, 'silla', x, z, SILLA, {
        giro: yaw,
        conjunto,
      });
      lugar(equipo, x, z, yaw, { x, z: m.z }, { x, z: m.z + s * SALIDA_DZ }, silla.id, false);
    }
  }
  // De pie que rebosan: dos parejas conversando en la cabecera este de la mesa (al rebosar se corren
  // hacia el este, donde hay sitio libre).
  const e = m.x + MESA.largo / 2;
  for (const s of [-1, 1] as const) {
    const z = m.z + s * 0.55;
    const salidaZ = m.z + s * SALIDA_DZ;
    lugar(equipo, e + 0.6, z, PI / 2, { x: e + 1.4, z }, { x: e + 0.6, z: salidaZ }, null, true);
    lugar(equipo, e + 1.4, z, -PI / 2, { x: e + 0.6, z }, { x: e + 1.4, z: salidaZ }, null, true);
  }
}

// Mesas altas del frente y quien trabaja de pie a su alrededor (lugares del paso, el ambiente común).
MESAS_ALTAS.forEach((t, i) => {
  mueble(`mesa-alta-${i + 1}`, 'mesa-alta', t.x, t.z, {
    ancho: MESA_ALTA.radio * 2,
    fondo: MESA_ALTA.radio * 2,
    alto: MESA_ALTA.alto,
  });
  const r = MESA_ALTA.radio + 0.6;
  const centro = { x: t.x, z: t.z };
  // Detrás (de cara a la cámara), a los costados (de perfil) y delante (de espaldas).
  lugar(
    null,
    t.x - 0.4,
    t.z - r + 0.04,
    0,
    centro,
    { x: t.x - 1.5, z: t.z - r + 0.04 },
    null,
    true,
  );
  lugar(null, t.x - r, t.z, PI / 2, centro, { x: t.x - r - 0.5, z: t.z }, null, true);
  lugar(null, t.x + r, t.z, -PI / 2, centro, { x: t.x + r + 0.5, z: t.z }, null, true);
  lugar(null, t.x, t.z + r, PI, centro, { x: t.x, z: t.z + r + 0.5 }, null, true);
});

// Sala de reunión: mesa grande con tres sillas por lado.
mueble('reunion-mesa', 'mesa-reunion', REUNION.mesa.x, REUNION.mesa.z, {
  ancho: REUNION.mesa.ancho,
  fondo: REUNION.mesa.fondo,
  alto: 0.75,
});
for (const [s, giro] of [
  [-1, 0],
  [1, PI],
] as const)
  for (const [k, x] of REUNION.sillasX.entries())
    mueble(
      `reunion-silla-${s < 0 ? 'n' : 's'}${k + 1}`,
      'silla',
      x,
      REUNION.mesa.z + s * 1.2,
      SILLA,
      {
        giro,
        conjunto: 'reunion-mesa',
      },
    );

// Tablero: la credenza bajo la pantalla.
mueble('credenza', 'credenza', TABLERO.credenza.x, TABLERO.credenza.z, TABLERO.credenza);

// Cocina: encimera, nevera, isla y taburetes.
muebleCaja('encimera', 'encimera', COCINA.encimera);
muebleCaja('nevera', 'nevera', COCINA.nevera);
muebleCaja('isla', 'isla', COCINA.isla);
COCINA.taburetesZ.forEach((z, i) =>
  mueble(
    `taburete-${i + 1}`,
    'taburete',
    COCINA.taburetesX,
    z,
    { ancho: 0.4, fondo: 0.4, alto: 0.75 },
    {
      conjunto: 'isla',
    },
  ),
);

// Lounge: estantería, sofá, sillones y mesa baja.
muebleCaja('estanteria', 'estanteria', LOUNGE.estanteria);
mueble(
  'lounge-sofa',
  'sofa',
  LOUNGE.sofa.x,
  LOUNGE.sofa.z,
  { ancho: LOUNGE.sofa.largo, fondo: LOUNGE.sofa.fondo, alto: 0.8 },
  { giro: PI / 2, conjunto: 'lounge' },
);
LOUNGE.sillones.forEach((s, i) =>
  mueble(
    `lounge-sillon-${i + 1}`,
    'sillon',
    s.x,
    s.z,
    { ancho: 0.9, fondo: 0.9, alto: 0.8 },
    {
      giro: -PI / 2,
      conjunto: 'lounge',
    },
  ),
);
mueble(
  'lounge-mesa',
  'mesa-baja',
  LOUNGE.mesa.x,
  LOUNGE.mesa.z,
  { ancho: 1.2, fondo: 1.2, alto: 0.4 },
  {
    conjunto: 'lounge',
  },
);

// Descanso: sofá contra el muro este, sillones, mesa baja y bicicletas.
mueble(
  'descanso-sofa',
  'sofa',
  DESCANSO.sofa.x,
  DESCANSO.sofa.z,
  { ancho: DESCANSO.sofa.largo, fondo: DESCANSO.sofa.fondo, alto: 0.8 },
  { giro: -PI / 2, conjunto: 'descanso' },
);
DESCANSO.sillones.forEach((s, i) =>
  mueble(
    `descanso-sillon-${i + 1}`,
    'sillon',
    s.x,
    s.z,
    { ancho: 0.9, fondo: 0.9, alto: 0.8 },
    {
      giro: PI / 2,
      conjunto: 'descanso',
    },
  ),
);
mueble(
  'descanso-mesa',
  'mesa-baja',
  DESCANSO.mesa.x,
  DESCANSO.mesa.z,
  { ancho: 0.9, fondo: 0.9, alto: 0.4 },
  {
    conjunto: 'descanso',
  },
);
DESCANSO.bicicletas.forEach((z, i) =>
  mueble(`bicicleta-${i + 1}`, 'bicicleta', (BICI.x0 + BICI.x1) / 2, z, {
    ancho: BICI.x1 - BICI.x0,
    fondo: 0.5,
    alto: 1.0,
  }),
);

// Estructura y plantas.
COLUMNAS.forEach((c, i) =>
  mueble(`columna-${i + 1}`, 'columna', c.x, c.z, { ancho: 0.4, fondo: 0.4, alto: SALA.alto }),
);
PLANTAS.forEach((p, i) =>
  mueble(`planta-${i + 1}`, 'planta', p.x, p.z, { ancho: 0.9, fondo: 0.9, alto: 2.2 }),
);

// --- muros -----------------------------------------------------------------------------------

function muro(
  id: string,
  eje: 'x' | 'z',
  pos: number,
  desde: number,
  hasta: number,
  tipo: Muro['tipo'],
): Muro {
  return { id, nivel: 'piso1', eje, pos, desde, hasta, tipo, vano: null };
}

const muros: Muro[] = [
  // Envolvente de ladrillo con ventanales.
  muro('fondo', 'z', SALA.z0, SALA.x0, SALA.x1, 'borde'),
  muro('oeste', 'x', SALA.x0, SALA.z0, SALA.z1, 'borde'),
  muro('este', 'x', SALA.x1, SALA.z0, SALA.z1, 'borde'),
  // Caja de vidrio de reunión, con la puerta al frente.
  muro('reunion-este', 'x', REUNION.zona.x1, SALA.z0, REUNION.zona.z1, 'muro'),
  muro('reunion-frente-1', 'z', REUNION.zona.z1, SALA.x0, REUNION.puerta.x0, 'muro'),
  muro('reunion-frente-2', 'z', REUNION.zona.z1, REUNION.puerta.x1, REUNION.zona.x1, 'muro'),
];

// --- café --------------------------------------------------------------------------------------

/** 12 puntos al oeste de la isla, en 3 grupos de 4 (uno por equipo). */
const cafe: PuntoXZ[] = [0, 1, 2].flatMap((g) =>
  [0, 1, 2, 3].map((i) => ({ x: CAFE_X, z: -9.9 + g * 1.9 + i * 0.5 })),
);

export const planta: Planta = {
  ambientes,
  muebles,
  lugares,
  muros,
  vanos: [],
  escaleras: [],
  huecos: [],
  cafe,
  luz: null,
  asistente: { x: 2.6, y: 2.6, z: 5.6 },
  niveles: [0],
};
