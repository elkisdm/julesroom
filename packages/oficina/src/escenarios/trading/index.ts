/**
 * La sala de trading como escenario (piloto de plantillas). Se registra al importarse; el motor lo
 * importa desde `src/index.ts`, así que `escenarioPorId('trading')` funciona con solo importar
 * `@oficina/motor`. No se registra desde `registro.ts` porque este módulo importa el registro y se
 * formaría un ciclo.
 */
import { ALTO_PLANO, ALTURA_AVATAR, GROSOR_MURO } from '../../animacion/colision';
import { cajaDe } from '../../mansion/plano';
import type { Caja } from '../../mansion/plano';
import { registrarEscenario } from '../registro';
import { crearRutasPlanta } from '../rutasPlanta';
import { accionesAula } from './acciones';
import { sueloTrading } from './suelo';
import type { Caja3, Escenario, Interes, Pantalla, VistaZona, ZonaEscenario } from '../tipos';
import {
  AULA,
  EQUIPOS,
  MESA_RADIO,
  MESAS,
  MURO_LED,
  NOMBRE_MERCADO,
  PASILLO_BANCOS,
  planta,
  PRIVADO,
  PUESTOS_X,
  QUIOSCO,
  SALA,
  zMuroLed,
} from './plano';

const LIMITES: Caja = { x0: SALA.x0, x1: SALA.x1, z0: SALA.z0, z1: SALA.z1 };

/** Muros (con su grosor) y muebles que bloquean; lo planos y lo colgado sobre la cabeza no. */
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
  ...c,
  y: 0,
  alto: SALA.alto,
  ...(departamento ? { departamento } : {}),
});

const zonas: ZonaEscenario[] = [
  zona('muro', 'Muro de datos', 'pantallas', { x0: -10, x1: 10, z0: SALA.z0, z1: -9.6 }),
  zona('agentes', 'Puestos de los agentes', 'agentes', { x0: -10, x1: 10, z0: -9.6, z1: -4 }),
  ...Array.from({ length: EQUIPOS }, (_, i) => {
    const a = planta.ambientes.find((u) => u.id === `equipo-${i + 1}`)!;
    return zona(a.id, a.nombre, 'trabajo', a, a.id);
  }),
  ...MESAS.map((m) =>
    zona(`mesa:${m.mercado}`, `Mesa ${NOMBRE_MERCADO[m.mercado]}`, 'trabajo', {
      x0: m.x - 2.6,
      x1: m.x + 2.6,
      z0: -0.6,
      z1: m.z + 2.4,
    }),
  ),
  zona('aula', 'Aula', 'aula', AULA.zona),
  zona('privado', 'Sala privada', 'reunion', PRIVADO.zona),
  zona('videoteca', 'Videoteca', 'descanso', { x0: SALA.x0, x1: -10, z0: -3.5, z1: SALA.z1 }),
  zona('descanso', 'Descanso y café', 'descanso', { x0: 10, x1: SALA.x1, z0: -8, z1: SALA.z1 }),
  zona('paso', 'Paso', 'paso', { x0: -10, x1: 10, z0: -4, z1: SALA.z1 }),
];

const pantallas: Pantalla[] = [
  {
    id: 'muro',
    x: 0,
    y: MURO_LED.base + MURO_LED.alto / 2,
    z: zMuroLed(0),
    ancho: MURO_LED.ancho,
    alto: MURO_LED.alto,
    giro: 0,
    radio: MURO_LED.radio,
    contenido: 'mercado',
    zona: 'muro',
  },
  { id: 'aula', ...AULA.pantalla, giro: 0, radio: 0, contenido: 'presentacion', zona: 'aula' },
  { id: 'privado', ...PRIVADO.pantalla, giro: 0, radio: 0, contenido: 'tablero', zona: 'privado' },
  ...MESAS.map((m): Pantalla => ({
    id: `mesa:${m.mercado}`,
    x: m.x,
    y: 1.42,
    z: m.z - 0.3,
    ancho: 1.4,
    alto: 0.79,
    giro: 0,
    radio: 0,
    contenido: 'mercado',
    zona: `mesa:${m.mercado}`,
  })),
  {
    id: 'videos',
    x: QUIOSCO.x,
    y: 1.55,
    z: QUIOSCO.z + QUIOSCO.fondo / 2 + 0.02,
    ancho: QUIOSCO.ancho - 0.5,
    alto: (QUIOSCO.ancho - 0.5) * 0.5625,
    giro: 0,
    radio: 0,
    contenido: 'video',
    zona: 'videoteca',
  },
];

const intereses: Interes[] = [
  {
    id: 'muro',
    nombre: 'Muro de datos',
    x: 0,
    z: -10.9,
    radio: 2.6,
    panel: 'mercado',
    zona: 'muro',
  },
  { id: 'aula', nombre: 'Aula', x: -14, z: -4.7, radio: 2.2, panel: 'aula', zona: 'aula' },
  {
    id: 'videos',
    nombre: 'Videoteca',
    x: QUIOSCO.x,
    z: -0.8,
    radio: 1.6,
    panel: 'videos',
    zona: 'videoteca',
    mueble: 'quiosco',
  },
  ...MESAS.map((m): Interes => ({
    id: `mesa:${m.mercado}`,
    nombre: `Mesa ${NOMBRE_MERCADO[m.mercado]}`,
    x: m.x,
    z: m.z + MESA_RADIO + 1.15,
    radio: 1.3,
    panel: 'mercado',
    zona: `mesa:${m.mercado}`,
    mueble: `mesa-${m.mercado}`,
  })),
  ...PUESTOS_X.map((x, n): Interes => ({
    id: `agente:${n}`,
    nombre: `Puesto ${n + 1}`,
    x,
    z: PASILLO_BANCOS,
    radio: 1.2,
    panel: 'agente',
    zona: `equipo-${Math.floor(n / 2) + 1}`,
  })),
  {
    id: 'privado',
    nombre: 'Sala privada',
    x: 14.5,
    z: -9,
    radio: 1.6,
    panel: 'chat',
    zona: 'privado',
  },
];

const caja3 = (c: Caja, y1 = SALA.alto): Caja3 => ({
  x0: c.x0,
  x1: c.x1,
  y0: 0,
  y1,
  z0: c.z0,
  z1: c.z1,
});
const vistasZona: VistaZona[] = zonas.map((z) => ({ id: z.id, nombre: z.nombre, caja: caja3(z) }));

export const escenarioTrading: Escenario = {
  id: 'trading',
  nombre: 'Sala de trading',
  descripcion:
    'Piso de un nivel al anochecer: muro de datos curvo, bancos por equipo, aula, sala privada, mesas por mercado y café.',
  planta,
  zonas,
  pantallas,
  // La del prototipo: por el frente, a la derecha del paseo, mirando al muro de datos.
  entradas: [{ x: 4.5, y: 0, z: 6.8, yaw: Math.PI }],
  intereses,
  acciones: accionesAula,
  // El frente abierto, de la videoteca a la izquierda de la entrada: sin muebles (se pasea en línea recta).
  paseo: { x0: -16.4, x1: 1.2, z0: 3.2, z1: 7.6 },
  // Corros de pie junto a las mesas redondas, en el aula, el descanso, la barra de café, la videoteca y el paso.
  reuniones: [
    ...MESAS.map((m) => ({ x: m.x, z: m.z, radio: 1.75, cupo: 3 })),
    { x: -14.2, z: -10.9, radio: 0.7, cupo: 3 },
    { x: 12.4, z: -4.6, radio: 1.5, cupo: 3 },
    { x: 15.2, z: 3.2, radio: 1.2, cupo: 3 },
    { x: -14, z: 3.4, radio: 0.8, cupo: 2 },
    { x: 10.8, z: 4, radio: 0.8, cupo: 2 },
  ],
  colision: () => CAJAS,
  suelo: sueloTrading,
  rutas: crearRutasPlanta(planta),
  ambiente: {
    hora: 21,
    tipo: 'interior',
    paleta: { fondo: '#0f1a2b', acento: '#c9a15a', texto: '#f3efe6' },
  },
  variantes: [
    { id: 'hora-azul', nombre: 'Hora azul', paleta: { hora: 21 } },
    {
      // Cierre de mercado: el muro de datos se vuelve ámbar, los muros y la alfombra se entibian y el
      // frío del relleno desaparece; el contraste lo da la sombra marrón, no el azul.
      id: 'ambar',
      nombre: 'Ámbar',
      paleta: {
        hora: 19.4,
        fondo: '#2a1810',
        materiales: {
          tinta: '#3d281c',
          alfombra: '#4d3326',
          alfombraAula: '#5c2b22',
          tela: '#6b5240',
          hormigon: '#b49a83',
          piedra: '#dcc5a2',
          nogal: '#d99c64',
          nogalPanel: '#b9784b',
          metal: '#3a2f29',
        },
        emisivos: {
          luzCalida: { color: '#ffb25e', fuerza: 3.4 },
          luzTenue: { color: '#ff9a52', fuerza: 1.9 },
          botellas: { color: '#ff9a40', fuerza: 1.9 },
          charcoMuro: { color: '#ff9a4d', fuerza: 0.3 },
          charcoMuroCalido: { color: '#ff7a3a', fuerza: 0.24 },
          charcoAmbar: { color: '#ff9a40', fuerza: 0.3 },
          ciudad: { color: '#ffb48a', fuerza: 0.8 },
          fachada: { color: '#ffc9a0', fuerza: 0.75 },
        },
        luces: {
          hemisferio: { color: '#ffcf9a', intensidad: 0.85 },
          frente: { color: '#ffb877', intensidad: 1.1 },
          contraluz: { color: '#d98a5a', intensidad: 0.8 },
          muro: { color: '#ffb070', intensidad: 1 },
          aula: { color: '#ffc890' },
          equipos: { intensidad: 1.1 },
          practicas: { intensidad: 1.25 },
          foco: { color: '#ffd8a8' },
        },
      },
    },
  ],
  vistas: {
    general: caja3(LIMITES),
    // En vertical solo cabe un tramo del ancho: el de las pantallas del muro de datos (16 m), enteras, hasta el piso del frente.
    generalVertical: { x0: -8.4, x1: 8.4, y0: 0, y1: SALA.alto, z0: SALA.z0, z1: SALA.z1 },
    // Altas, para que la planta se vea profunda y llene el cuadro (la sala es 36 × 21 m).
    elevacionGeneral: 46,
    elevacionVertical: 46,
    margenGeneral: 0.97,
    seguir: { distancia: 10.5, elevacion: 40, frente: SALA.z1 },
    zonas: vistasZona,
  },
  ambienteComun: 'paso',
  asignacion: 'por-orden',
  personalizable: true,
};

registrarEscenario(escenarioTrading);
