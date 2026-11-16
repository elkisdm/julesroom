/**
 * Planta de la sala de trading: un piso de un nivel con el muro de datos curvo al fondo, dos bancos de
 * puestos mirándose espalda con espalda (la fila de agentes frente al muro y la del frente mirando a la
 * cámara), el aula-cine a la izquierda, la sala privada a la derecha, las mesas por mercado al frente,
 * la videoteca y el descanso con la barra de café a los costados.
 *
 * Se porta de la sala de trading del prototipo anterior (mismas piezas y la misma disposición), más
 * compacta (36 × 21 m en vez de 48 × 26) para que las personas se vean grandes en la vista general.
 *
 * Mismas convenciones que `mansion/plano.ts`: metros, x de oeste a este, z hacia la cámara (el borde
 * +z es el corte abierto), yaw según `atan2(x, z)` (0 mira a la cámara, π al muro de datos), `giro` es
 * la `rotation.y` del mueble (múltiplos de 90°). Un lugar sentado está dentro de su silla; uno de pie, a
 * más de 0,3 m de todo mueble; desde la salida hay un carril recto hasta el pasillo del ambiente. Todo
 * lo que se dibuja (`render/escenarios/trading`) y lo que calcula la colisión sale de aquí.
 */
import type { Ambiente, Lugar, Mueble, Muro, PuntoXZ } from '../../mansion/plano';
import type { Planta } from '../tipos';

const PI = Math.PI;

/** La caja de la sala: muros en x = ±18 y z = −13; hacia la cámara (z = 8) el piso queda abierto. */
export const SALA = { x0: -18, x1: 18, z0: -13, z1: 8, alto: 5.4 } as const;

/** Muro de datos: un arco de radio `radio` con centro en (0, `centroZ`), de −ancho/2 a ancho/2 en x. */
export const MURO_LED = { radio: 14, centroZ: 1.4, ancho: 16, base: 1.0, alto: 3.9 } as const;

/** z de la superficie del muro de datos a la altura `x` (|x| ≤ ancho/2). */
export const zMuroLed = (x: number): number =>
  MURO_LED.centroZ - Math.sqrt(MURO_LED.radio ** 2 - x ** 2);

/** Puestos de los bancos: 6 por fila, de 3 m, con 2 sillas cada uno. */
export const PUESTOS_X = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5] as const;
export const MESA_PUESTO = { ancho: 2.9, fondo: 0.9, alto: 0.76 } as const;
/** Desplazamiento en x de las dos sillas de un puesto respecto de su centro. */
export const SILLAS_DX = [-0.72, 0.72] as const;
export const SILLA = { ancho: 0.5, fondo: 0.5, alto: 0.95 } as const;

/** Fila de agentes: frente al muro de datos (de espaldas a la cámara, como en una mesa de operaciones). */
export const FILA_AGENTES = { mesaZ: -8.2, sillaZ: -7.35, yaw: PI, salidaZ: -6.6 } as const;
/** Fila del frente: espalda con espalda con la de agentes, mirando a la cámara (se ven las caras). */
export const FILA_FRENTE = { mesaZ: -4.75, sillaZ: -5.6, yaw: 0, salidaZ: -6.35 } as const;
/** Pasillo compartido entre las dos filas (los respaldos se dan la espalda). */
export const PASILLO_BANCOS = -6.48;

/** Equipos: cada uno ocupa dos puestos contiguos de cada fila (8 sillas). */
export const EQUIPOS = 3;
/** Centro en x del equipo `k` (1..EQUIPOS). */
export const centroEquipo = (k: number): number =>
  (PUESTOS_X[(k - 1) * 2]! + PUESTOS_X[(k - 1) * 2 + 1]!) / 2;

/** Aula-cine: tarima y pantalla al fondo, tres filas de butacas en graderío, tabique de vidrio. */
export const AULA = {
  zona: { x0: SALA.x0, x1: -10, z0: SALA.z0, z1: -3.5 },
  pantalla: { x: -14, y: 3.05, z: -12.82, ancho: 5.6, alto: 3.15 },
  tarima: { x0: -17.2, x1: -10.8, z0: -12.9, z1: -11.6, alto: 0.25 },
  filas: [
    { z: -9.7, y: 0 },
    { z: -8.1, y: 0.3 },
    { z: -6.5, y: 0.6 },
  ],
  butacasX: [-16, -14.67, -13.33, -12],
  /** Huella del graderío con sus butacas. */
  gradas: { x0: -16.6, x1: -11.4, z0: -10.15, z1: -5.9 },
  /** Tabique de vidrio en x = −10, desde el fondo hasta `hastaZ`; el resto queda abierto. */
  tabiqueX: -10,
  tabiqueHastaZ: -7,
  atril: { x: -11.6, z: -12.2 },
} as const;

/** Sala privada de vidrio, con la puerta al frente. */
export const PRIVADO = {
  zona: { x0: 10, x1: SALA.x1, z0: SALA.z0, z1: -8 },
  puerta: { x0: 13.7, x1: 15.3 },
  pantalla: { x: 14.5, y: 2.1, z: -12.82, ancho: 3.2, alto: 1.8 },
  sillones: [
    { x: 12.3, z: -10.7, giro: PI / 2 },
    { x: 16.7, z: -10.7, giro: -PI / 2 },
  ],
  mesa: { x: 14.5, z: -10.7 },
} as const;

export type Mercado = 'cripto' | 'forex' | 'materias';
export type ActivoId = 'btc' | 'eth' | 'eur' | 'xau';
export const NOMBRE_MERCADO: Record<Mercado, string> = {
  cripto: 'Cripto',
  forex: 'Forex',
  materias: 'Materias primas',
};

/** Mesas altas por mercado, al frente, con su pantalla inclinada y su cartel colgante. */
export const MESAS: readonly { mercado: Mercado; x: number; z: number; activo: ActivoId }[] = [
  { mercado: 'cripto', x: -6, z: 1.4, activo: 'btc' },
  { mercado: 'forex', x: 0, z: 1.4, activo: 'eur' },
  { mercado: 'materias', x: 6, z: 1.4, activo: 'xau' },
];
export const MESA_RADIO = 1.05;
export const MESA_ALTO = 1.05;
/** Distancia del centro de la mesa a quien está de pie a su alrededor. */
const RONDA = MESA_RADIO + 0.6;

/** Quiosco de la videoteca: un tótem con pantalla que mira a la cámara. */
export const QUIOSCO = { x: -14, z: -2.2, ancho: 4, fondo: 0.5, alto: 2.8 } as const;

/** Barra de café a lo largo del costado derecho; se toma de pie mirando a la barra. */
export const BARRA = { x0: 15.3, x1: 16.1, z0: -0.2, z1: 7, alto: 1.08 } as const;
/** Estantería de la barra, contra el muro. */
export const REPISA = { x0: 17.35, x1: 17.85, z0: 0.2, z1: 6.6, alto: 2.4 } as const;
const CAFE_X = 14.75;

/** Columnas de la estructura, alineadas con los tabiques del aula y de la sala privada. */
export const COLUMNAS: readonly PuntoXZ[] = [
  { x: -10, z: -1.2 },
  { x: 10, z: -1.2 },
];
export const JARDINERAS: readonly PuntoXZ[] = [
  { x: -9.25, z: -12.3 },
  { x: 9.25, z: -12.3 },
  { x: -17.35, z: 7.35 },
  { x: -17.35, z: 2.6 },
  { x: 17.35, z: 7.4 },
  { x: 17.35, z: -7.4 },
  { x: 17.35, z: -1.5 },
  { x: 17.3, z: -12.3 },
];

/** Descanso: sofá contra el muro, mesa baja, mesa alta con taburetes. */
export const DESCANSO = {
  sofa: { x: 17.25, z: -4.6, ancho: 2.6, fondo: 0.9 },
  mesaBaja: { x: 15.95, z: -4.6, ancho: 1.2, fondo: 0.6 },
  mesaAlta: { x: 12.4, z: -4.6 },
  taburetes: [
    { x: 11.65, z: -4.6 },
    { x: 13.15, z: -4.6 },
  ],
} as const;

/** Rincón de espera junto al café: dos sillones frente a frente y una mesa baja. */
export const ESPERA = {
  sillones: [
    { x: 9.5, z: 6, giro: PI / 2 },
    { x: 12.1, z: 6, giro: -PI / 2 },
  ],
  mesa: { x: 10.8, z: 6 },
} as const;

/** Banco de pufs frente al quiosco. */
export const PUFS = { x: -14, z: 0.7, ancho: 2.4, fondo: 0.5 } as const;

// --- ambientes -------------------------------------------------------------------------------

function ambiente(
  id: string,
  nombre: string,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  departamento: string | null,
  pasilloZ: number,
): Ambiente {
  return {
    id,
    nombre,
    nivel: 'piso1',
    y: 0,
    alto: SALA.alto,
    x0,
    x1,
    z0,
    z1,
    departamento,
    pasilloZ,
  };
}

/** Bordes en x de los equipos dentro de la banda central (x −10..10). */
const CORTES_EQUIPO = [-10, -3, 3, 10] as const;

const ambientes: Ambiente[] = [
  ambiente('aula', 'Aula', AULA.zona.x0, AULA.zona.x1, AULA.zona.z0, AULA.zona.z1, null, -4.6),
  ambiente('videoteca', 'Videoteca', SALA.x0, -10, -3.5, SALA.z1, null, -0.8),
  ambiente('muro', 'Muro de datos', -10, 10, SALA.z0, -9.6, null, -10.9),
  ...[1, 2, 3].map((k) =>
    ambiente(
      `equipo-${k}`,
      `Equipo ${k}`,
      CORTES_EQUIPO[k - 1]!,
      CORTES_EQUIPO[k]!,
      -9.6,
      -4,
      `equipo-${k}`,
      PASILLO_BANCOS,
    ),
  ),
  ambiente('piso', 'Frente de los equipos', -10, 10, -4, -0.6, null, -3),
  ambiente('paso', 'Paso', -10, 10, -0.6, SALA.z1, null, 3.6),
  ambiente(
    'privado',
    'Sala privada',
    PRIVADO.zona.x0,
    PRIVADO.zona.x1,
    PRIVADO.zona.z0,
    PRIVADO.zona.z1,
    null,
    -9,
  ),
  ambiente('descanso', 'Descanso', 10, SALA.x1, -8, -0.8, null, -3),
  ambiente('cafe', 'Café', 10, SALA.x1, -0.8, SALA.z1, null, 3.5),
];

// --- muebles y lugares ------------------------------------------------------------------------

const muebles: Mueble[] = [];
const lugares: Lugar[] = [];

function mueble(
  id: string,
  tipo: string,
  amb: string,
  x: number,
  z: number,
  medidas: { ancho: number; fondo: number; alto: number },
  extra: { giro?: number; y?: number; conjunto?: string } = {},
): Mueble {
  const m: Mueble = {
    id,
    tipo,
    ambiente: amb,
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

function lugar(
  amb: string,
  departamento: string | null,
  x: number,
  z: number,
  yaw: number,
  mira: PuntoXZ,
  salida: PuntoXZ,
  silla: string | null,
  extra: boolean,
): void {
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

// Muro de datos: su huella sigue el arco por tramos de 2 m (la pantalla y su marco por detrás).
{
  const bordes = [-8, -6, -4, -2, 2, 4, 6, 8];
  for (let i = 0; i + 1 < bordes.length; i++) {
    const a = bordes[i]!;
    const b = bordes[i + 1]!;
    const z0 = SALA.z0 + 0.1;
    const z1 = zMuroLed(Math.max(Math.abs(a), Math.abs(b))) + 0.15;
    mueble(
      `muro-led-${i + 1}`,
      'muro-led',
      'muro',
      (a + b) / 2,
      (z0 + z1) / 2,
      { ancho: b - a, fondo: z1 - z0, alto: MURO_LED.base + MURO_LED.alto },
      { conjunto: 'muro-led' },
    );
  }
}

// Bancos: por cada puesto una mesa y dos sillas; cada equipo toma dos puestos de cada fila.
for (const [fila, f] of [
  ['a', FILA_AGENTES],
  ['b', FILA_FRENTE],
] as const) {
  PUESTOS_X.forEach((cx, i) => {
    const equipo = Math.floor(i / 2) + 1;
    const amb = `equipo-${equipo}`;
    const conjunto = `banco-${fila}`;
    const mesa = mueble(`banco-${fila}-${i + 1}`, 'mesa-puesto', amb, cx, f.mesaZ, MESA_PUESTO, {
      conjunto,
    });
    for (const dx of SILLAS_DX) {
      const x = cx + dx;
      const silla = mueble(
        `banco-${fila}-${i + 1}-silla-${dx < 0 ? 1 : 2}`,
        'silla-malla',
        amb,
        x,
        f.sillaZ,
        SILLA,
        { giro: f.yaw, conjunto },
      );
      lugar(amb, amb, x, f.sillaZ, f.yaw, { x, z: mesa.z }, { x, z: f.salidaZ }, silla.id, false);
    }
  });
}

// De pie sobrantes de cada equipo: dos parejas frente a su banco que conversan mirándose.
for (let k = 1; k <= EQUIPOS; k++) {
  const c = centroEquipo(k);
  const z = -1.9;
  for (const [x, yaw, otro] of [
    [c - 1.75, PI / 2, c - 0.95],
    [c - 0.95, -PI / 2, c - 1.75],
    [c + 0.95, PI / 2, c + 1.75],
    [c + 1.75, -PI / 2, c + 0.95],
  ] as const) {
    lugar('piso', `equipo-${k}`, x, z, yaw, { x: otro, z }, { x, z: z - 0.55 }, null, true);
  }
}

// Mesas por mercado y quien está de pie a su alrededor (lugares del paso, el ambiente común).
for (const m of MESAS) {
  mueble(`mesa-${m.mercado}`, 'mesa-mercado', 'paso', m.x, m.z, {
    ancho: MESA_RADIO * 2,
    fondo: MESA_RADIO * 2,
    alto: MESA_ALTO,
  });
  const centro = { x: m.x, z: m.z };
  // Al frente (de espaldas a la cámara), a los costados (de perfil) y detrás (de cara a la cámara).
  lugar('paso', null, m.x, m.z + RONDA, PI, centro, { x: m.x, z: m.z + RONDA + 0.5 }, null, true);
  lugar(
    'paso',
    null,
    m.x - RONDA,
    m.z,
    PI / 2,
    centro,
    { x: m.x - RONDA - 0.5, z: m.z },
    null,
    true,
  );
  lugar(
    'paso',
    null,
    m.x + RONDA,
    m.z,
    -PI / 2,
    centro,
    { x: m.x + RONDA + 0.5, z: m.z },
    null,
    true,
  );
  lugar(
    'paso',
    null,
    m.x - 0.4,
    m.z - RONDA,
    0,
    centro,
    { x: m.x - 1.5, z: m.z - RONDA },
    null,
    true,
  );
}

// Aula: tarima con atril, graderío con butacas.
mueble(
  'aula-tarima',
  'tarima',
  'aula',
  (AULA.tarima.x0 + AULA.tarima.x1) / 2,
  (AULA.tarima.z0 + AULA.tarima.z1) / 2,
  {
    ancho: AULA.tarima.x1 - AULA.tarima.x0,
    fondo: AULA.tarima.z1 - AULA.tarima.z0,
    alto: AULA.tarima.alto,
  },
);
mueble(
  'aula-atril',
  'atril',
  'aula',
  AULA.atril.x,
  AULA.atril.z,
  { ancho: 0.6, fondo: 0.45, alto: 1.1 },
  {
    y: AULA.tarima.alto,
    conjunto: 'aula-tarima',
  },
);
mueble(
  'aula-gradas',
  'gradas',
  'aula',
  (AULA.gradas.x0 + AULA.gradas.x1) / 2,
  (AULA.gradas.z0 + AULA.gradas.z1) / 2,
  {
    ancho: AULA.gradas.x1 - AULA.gradas.x0,
    fondo: AULA.gradas.z1 - AULA.gradas.z0,
    alto: 1.4,
  },
);

// Sala privada: dos sillones frente a frente y una mesa baja.
PRIVADO.sillones.forEach((s, i) =>
  mueble(
    `privado-sillon-${i + 1}`,
    'sillon',
    'privado',
    s.x,
    s.z,
    { ancho: 1, fondo: 1, alto: 0.8 },
    {
      giro: s.giro,
      conjunto: 'privado-estar',
    },
  ),
);
mueble(
  'privado-mesa',
  'mesa-baja',
  'privado',
  PRIVADO.mesa.x,
  PRIVADO.mesa.z,
  { ancho: 1.6, fondo: 0.8, alto: 0.42 },
  {
    conjunto: 'privado-estar',
  },
);

// Rincón de espera.
ESPERA.sillones.forEach((s, i) =>
  mueble(
    `espera-sillon-${i + 1}`,
    'sillon',
    ambienteEn(s)?.id ?? 'paso',
    s.x,
    s.z,
    { ancho: 1, fondo: 1, alto: 0.8 },
    {
      giro: s.giro,
      conjunto: 'espera',
    },
  ),
);
mueble(
  'espera-mesa',
  'mesa-baja',
  'cafe',
  ESPERA.mesa.x,
  ESPERA.mesa.z,
  { ancho: 0.6, fondo: 1, alto: 0.4 },
  {
    conjunto: 'espera',
  },
);

// Videoteca: el quiosco y los pufs.
mueble('quiosco', 'quiosco', 'videoteca', QUIOSCO.x, QUIOSCO.z, QUIOSCO);
mueble('pufs', 'pufs', 'videoteca', PUFS.x, PUFS.z, {
  ancho: PUFS.ancho,
  fondo: PUFS.fondo,
  alto: 0.45,
});

// Café: barra y repisa.
mueble('barra', 'barra', 'cafe', (BARRA.x0 + BARRA.x1) / 2, (BARRA.z0 + BARRA.z1) / 2, {
  ancho: BARRA.x1 - BARRA.x0,
  fondo: BARRA.z1 - BARRA.z0,
  alto: BARRA.alto,
});
mueble('repisa', 'repisa', 'cafe', (REPISA.x0 + REPISA.x1) / 2, (REPISA.z0 + REPISA.z1) / 2, {
  ancho: REPISA.x1 - REPISA.x0,
  fondo: REPISA.z1 - REPISA.z0,
  alto: REPISA.alto,
});

// Descanso.
mueble(
  'sofa',
  'sofa',
  'descanso',
  DESCANSO.sofa.x,
  DESCANSO.sofa.z,
  { ...DESCANSO.sofa, alto: 0.8 },
  {
    giro: -PI / 2,
    conjunto: 'descanso-estar',
  },
);
mueble(
  'mesa-baja',
  'mesa-baja',
  'descanso',
  DESCANSO.mesaBaja.x,
  DESCANSO.mesaBaja.z,
  {
    ancho: DESCANSO.mesaBaja.ancho,
    fondo: DESCANSO.mesaBaja.fondo,
    alto: 0.4,
  },
  { conjunto: 'descanso-estar' },
);
mueble(
  'mesa-alta',
  'mesa-alta',
  'descanso',
  DESCANSO.mesaAlta.x,
  DESCANSO.mesaAlta.z,
  { ancho: 0.9, fondo: 0.9, alto: 1.05 },
  {
    conjunto: 'descanso-alta',
  },
);
DESCANSO.taburetes.forEach((t, i) =>
  mueble(
    `taburete-${i + 1}`,
    'taburete',
    'descanso',
    t.x,
    t.z,
    { ancho: 0.4, fondo: 0.4, alto: 0.75 },
    {
      conjunto: 'descanso-alta',
    },
  ),
);

// Estructura y plantas.
COLUMNAS.forEach((c, i) =>
  mueble(`columna-${i + 1}`, 'columna', 'piso', c.x, c.z, {
    ancho: 0.7,
    fondo: 0.7,
    alto: SALA.alto,
  }),
);
JARDINERAS.forEach((j, i) =>
  mueble(`jardinera-${i + 1}`, 'jardinera', ambienteEn(j)?.id ?? 'paso', j.x, j.z, {
    ancho: 1.1,
    fondo: 1.1,
    alto: 1.8,
  }),
);

function ambienteEn(p: PuntoXZ): Ambiente | undefined {
  return ambientes.find((a) => p.x >= a.x0 && p.x <= a.x1 && p.z >= a.z0 && p.z <= a.z1);
}

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
  // Envolvente: ventanales al fondo y a los costados.
  muro('fondo', 'z', SALA.z0, SALA.x0, SALA.x1, 'borde'),
  muro('oeste', 'x', SALA.x0, SALA.z0, SALA.z1, 'borde'),
  muro('este', 'x', SALA.x1, SALA.z0, SALA.z1, 'borde'),
  // Tabiques de vidrio: el aula (abierta hacia el frente) y la sala privada (puerta al frente).
  muro('tabique-aula', 'x', AULA.tabiqueX, SALA.z0, AULA.tabiqueHastaZ, 'muro'),
  muro('tabique-privado', 'x', PRIVADO.zona.x0, SALA.z0, PRIVADO.zona.z1, 'muro'),
  muro('frente-privado-1', 'z', PRIVADO.zona.z1, PRIVADO.zona.x0, PRIVADO.puerta.x0, 'muro'),
  muro('frente-privado-2', 'z', PRIVADO.zona.z1, PRIVADO.puerta.x1, SALA.x1, 'muro'),
];

// --- café --------------------------------------------------------------------------------------

/** 12 puntos frente a la barra, en 3 grupos de 4 (uno por equipo). */
const cafe: PuntoXZ[] = [0, 1, 2].flatMap((g) =>
  [0, 1, 2, 3].map((i) => ({ x: CAFE_X, z: 0.3 + g * 2.4 + i * 0.52 })),
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
  asistente: { x: 3.2, y: 2.7, z: 4.4 },
  niveles: [0],
};
