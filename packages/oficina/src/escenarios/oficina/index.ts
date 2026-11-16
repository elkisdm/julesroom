/**
 * La oficina «Nave de la mañana» como escenario. Se registra al importarse; el motor lo importa desde
 * `src/index.ts` (como la sala de trading), así que `escenarioPorId('oficina')` funciona con solo
 * importar `@oficina/motor`.
 */
import { ALTO_PLANO, ALTURA_AVATAR, GROSOR_MURO } from '../../animacion/colision';
import { cajaDe } from '../../mansion/plano';
import type { Caja } from '../../mansion/plano';
import { registrarEscenario } from '../registro';
import { crearRutasPlanta } from '../rutasPlanta';
import type { Caja3, Escenario, Interes, Pantalla, VistaZona, ZonaEscenario } from '../tipos';
import { COCINA, DESCANSO, LOUNGE, MESAS, planta, REUNION, SALA, TABLERO } from './plano';

const LIMITES: Caja = { x0: SALA.x0, x1: SALA.x1, z0: SALA.z0, z1: SALA.z1 };

/** Muros (con su grosor) y muebles que bloquean; lo plano y lo colgado sobre la cabeza no. */
function colision(): { cajas: Caja[]; limites: Caja } {
  const h = GROSOR_MURO / 2;
  const cajas: Caja[] = planta.muros.map((m) =>
    m.eje === 'x'
      ? { x0: m.pos - h, x1: m.pos + h, z0: m.desde, z1: m.hasta }
      : { x0: m.desde, x1: m.hasta, z0: m.pos - h, z1: m.pos + h },
  );
  for (const m of planta.muebles) {
    if (m.alto <= ALTO_PLANO || m.y >= ALTURA_AVATAR) continue;
    cajas.push(cajaDe(m));
  }
  return { cajas, limites: LIMITES };
}
const CAJAS = colision();

/** Alto que se encuadra: la nave hasta un poco sobre el alero (el diente de sierra asoma por encima). */
const ALTO_VISTA = 5.4;

const zona = (
  id: string,
  nombre: string,
  tipo: ZonaEscenario['tipo'],
  c: Caja,
  departamento?: string,
): ZonaEscenario => ({
  id,
  nombre,
  tipo,
  x0: c.x0,
  x1: c.x1,
  z0: c.z0,
  z1: c.z1,
  y: 0,
  alto: ALTO_VISTA,
  ...(departamento ? { departamento } : {}),
});

const zonas: ZonaEscenario[] = [
  zona('tablero', 'Tablero', 'pantallas', { x0: -9.5, x1: 9.5, z0: SALA.z0, z1: -8.4 }),
  ...MESAS.map((m) =>
    zona(
      `equipo-${m.equipo}`,
      `Equipo ${m.equipo}`,
      'trabajo',
      {
        x0: m.x < 0 ? -9.5 : 0,
        x1: m.x < 0 ? 0 : 9.5,
        z0: m.z < -3 ? -8.4 : -3.3,
        z1: m.z < -3 ? -3.3 : 2.4,
      },
      `equipo-${m.equipo}`,
    ),
  ),
  zona('reunion', 'Sala de reunión', 'reunion', REUNION.zona),
  zona('lounge', 'Lounge y biblioteca', 'descanso', LOUNGE.zona),
  zona('cocina', 'Cocina', 'descanso', COCINA.zona),
  zona('descanso', 'Descanso', 'descanso', DESCANSO.zona),
  zona('paso', 'Mesas de pie', 'paso', { x0: -9.5, x1: 9.5, z0: 2.4, z1: SALA.z1 }),
];

/** Monitor bajo de cada mesa que recibe contenido de fuera (el segundo del lado sur, de cara a la cámara). */
export const MONITOR = { ancho: 0.56, alto: 0.33, y: 1.0, dz: 0.12, dx: -0.55 } as const;

const pantallas: Pantalla[] = [
  {
    id: 'reunion',
    ...REUNION.pantalla,
    giro: 0,
    radio: 0,
    contenido: 'presentacion',
    zona: 'reunion',
  },
  { id: 'tablero', ...TABLERO.pantalla, giro: 0, radio: 0, contenido: 'tablero', zona: 'tablero' },
  ...MESAS.map((m): Pantalla => ({
    id: `monitor:${m.equipo}`,
    x: m.x + MONITOR.dx,
    y: MONITOR.y,
    z: m.z + MONITOR.dz,
    ancho: MONITOR.ancho,
    alto: MONITOR.alto,
    giro: 0,
    radio: 0,
    contenido: 'agente',
    zona: `equipo-${m.equipo}`,
  })),
];

const intereses: Interes[] = [
  {
    id: 'reunion',
    nombre: 'Sala de reunión',
    x: -13.2,
    z: -6.2,
    radio: 1.4,
    panel: 'aula',
    zona: 'reunion',
  },
  { id: 'tablero', nombre: 'Tablero', x: 0, z: -9.4, radio: 2, panel: 'agente', zona: 'tablero' },
  {
    id: 'cocina',
    nombre: 'Cocina',
    x: 11.4,
    z: -7.2,
    radio: 1.6,
    panel: 'chat',
    zona: 'cocina',
    mueble: 'isla',
  },
];

const caja3 = (c: Caja, y1 = ALTO_VISTA): Caja3 => ({
  x0: c.x0,
  x1: c.x1,
  y0: 0,
  y1,
  z0: c.z0,
  z1: c.z1,
});
const vistasZona: VistaZona[] = zonas.map((z) => ({ id: z.id, nombre: z.nombre, caja: caja3(z) }));

export const escenarioOficina: Escenario = {
  id: 'oficina',
  nombre: 'Oficina',
  descripcion:
    'Nave de la mañana: planta abierta de un nivel con techo en diente de sierra, mesas largas por equipo, tablero, sala de reunión de vidrio, cocina, lounge y descanso.',
  planta,
  zonas,
  pantallas,
  // Por el frente a la derecha, junto a las bicicletas, mirando al fondo.
  entradas: [{ x: 10.6, y: 0, z: 6.6, yaw: Math.PI }],
  intereses,
  // El frente abierto delante de las mesas de pie: sin muebles (se pasea en línea recta).
  paseo: { x0: -9, x1: 8, z0: 4.95, z1: 7.6 },
  // Corros de pie: frente al tablero, entre las mesas, en la cocina, en la sala de reunión, el lounge y el descanso.
  reuniones: [
    { x: 0, z: -9.9, radio: 1.3, cupo: 4 },
    { x: 0, z: -3.3, radio: 0.9, cupo: 3 },
    { x: 11, z: -10.2, radio: 0.8, cupo: 3 },
    { x: -10.7, z: -10.6, radio: 0.55, cupo: 2 },
    { x: -13.2, z: 5.8, radio: 1, cupo: 3 },
    { x: 14.6, z: 2.6, radio: 0.8, cupo: 3 },
  ],
  colision: () => CAJAS,
  rutas: crearRutasPlanta(planta),
  ambiente: {
    hora: 10,
    tipo: 'interior',
    paleta: { fondo: '#efe9df', acento: '#c4673f', texto: '#2b2b2b' },
  },
  variantes: [
    { id: 'manana', nombre: 'Mañana', paleta: { hora: 10 } },
    {
      // Sol bajo de las 18 h desde el noroeste: entra rasante por las vidrieras y deja franjas largas
      // y doradas; el cielo, el patio y los vecinos se encienden y las lámparas se notan más.
      id: 'tarde',
      nombre: 'Tarde',
      paleta: {
        hora: 18.4,
        fondo: '#f2cfa6',
        sol: { x: -0.3, y: 0.32, z: -0.9 },
        materiales: {
          pavimento: '#d8bf9c',
          ladrilloVecino: '#d98a5f',
          vidrioVecino: '#ffd29a',
          ventanaVecina: '#6a5a52',
          zinc: '#a89484',
          pasto: '#93984f',
          hoja: '#4d6a2e',
          hojaClara: '#8da147',
        },
        emisivos: {
          luzCalida: { color: '#ffc27a', fuerza: 3 },
          franjas: { color: '#ff9f4a', fuerza: 0.36 },
        },
        luces: {
          relleno: { color: '#ffd7b4', intensidad: 0.5 },
          lamparas: { color: '#ffb870', intensidad: 1.6 },
        },
      },
    },
  ],
  vistas: {
    general: caja3(LIMITES),
    // En vertical: el tablero entero y las cuatro mesas; la caja corre 1 m al fondo para que la nave quede
    // centrada con su diente de sierra y sobre menos plaza al frente.
    generalVertical: {
      x0: -7.4,
      x1: 7.4,
      y0: 0,
      y1: ALTO_VISTA,
      z0: SALA.z0 - 1,
      z1: SALA.z1 - 1,
    },
    elevacionGeneral: 44,
    // Más alta en vertical: la planta se ve más profunda y llena el alto.
    elevacionVertical: 64,
    margenGeneral: 0.97,
    seguir: { distancia: 13.5, elevacion: 40, frente: SALA.z1 },
    zonas: vistasZona,
  },
  ambienteComun: 'paso',
  asignacion: 'por-orden',
  personalizable: true,
};

registrarEscenario(escenarioOficina);
