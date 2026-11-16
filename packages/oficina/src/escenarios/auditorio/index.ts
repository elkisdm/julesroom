import { cajaDe } from '../../mansion/plano';
import { registrarEscenario } from '../registro';
import { crearRutasPlanta } from '../rutasPlanta';
import { superficiesDeMuebles } from '../suelo';
import type { AccionSentarse, Escenario, Superficie } from '../tipos';
import { BUTACA, BUTACAS, ESCALON, FONDO_Z, planta, SALA, TARIMA } from './plano';

const limites = { x0: SALA.x0, x1: SALA.x1, z0: SALA.z0, z1: SALA.z1 };
const derivados = superficiesDeMuebles(planta.muebles, () => 0);
const superficies: Superficie[] = [
  { id: 'piso', tipo: 'losa', forma: 'caja', ...limites, y: 0, grosor: 0.3 },
  { id: 'escenario', tipo: 'tarima', forma: 'caja', ...TARIMA, grosor: TARIMA.y },
  { id: 'escalon', tipo: 'peldano', forma: 'caja', ...ESCALON, grosor: ESCALON.y },
];
const solidos = [
  ...derivados.solidos,
  {
    id: 'fondo',
    tipo: 'muro' as const,
    x0: SALA.x0,
    x1: SALA.x1,
    z0: FONDO_Z - 0.2,
    z1: FONDO_Z,
    y0: 0,
    y1: SALA.alto,
  },
];
const acciones: AccionSentarse[] = BUTACAS.map((b) => ({
  id: `sentarse:${b.id}`,
  tipo: 'sentarse',
  nombre: 'Butaca',
  x: b.x,
  z: b.z,
  y: 0,
  radio: 1.3,
  asiento: {
    x: b.x,
    z: b.z,
    y: BUTACA.pelvis,
    yaw: b.giro,
    aproximacion: { x: b.x + Math.sin(b.giro), y: 0, z: b.z + Math.cos(b.giro) },
  },
}));
const zonas = [
  { id: 'escenario', nombre: 'Escenario', tipo: 'aula' as const, ...TARIMA, alto: SALA.alto },
  {
    id: 'centro',
    nombre: 'Punto de encuentro',
    tipo: 'reunion' as const,
    x0: -8,
    x1: 8,
    z0: -8,
    z1: 4,
    y: 0,
    alto: 3,
  },
  {
    id: 'publico',
    nombre: 'Público',
    tipo: 'reunion' as const,
    x0: -14,
    x1: 14,
    z0: 4,
    z1: 14,
    y: 0,
    alto: 3,
  },
  {
    id: 'equipo-1',
    nombre: 'Producción',
    tipo: 'agentes' as const,
    x0: -19,
    x1: -13,
    z0: -15,
    z1: -7,
    y: 0,
    alto: 3,
    departamento: 'equipo-1',
  },
];

/** Patio de eventos abierto, con tarima accesible y butacas independientes del equipo. */
export const escenarioAuditorio: Escenario = {
  id: 'auditorio',
  nombre: 'Auditorio',
  descripcion:
    'Sala Encuentro: un escenario abierto para presentar, conversar y reunir a 25 personas.',
  planta,
  suelo: { limites, superficies, solidos },
  zonas,
  pantallas: [-14, 14].map((x, i) => ({
    id: `sala-${i}`,
    x,
    y: 3.6,
    z: FONDO_Z + 0.14,
    ancho: 3,
    alto: 1.7,
    giro: 0,
    radio: 0,
    contenido: 'presentacion',
    zona: 'escenario',
  })),
  entradas: Array.from({ length: 25 }, (_, i) => ({
    x: i === 0 ? 0 : Math.ceil(i / 2) * 1.6 * (i % 2 ? -1 : 1),
    z: 15,
    y: 0,
    yaw: Math.PI,
  })),
  intereses: [],
  acciones,
  paseo: { x0: -7, x1: 7, z0: -7, z1: 3 },
  reuniones: [
    { x: -3.5, z: -2, radio: 2.4, cupo: 10 },
    { x: 3.5, z: -2, radio: 2.4, cupo: 10 },
  ],
  colision: () => ({
    limites,
    cajas: [...planta.muebles.map(cajaDe), ...solidos.filter((s) => s.tipo === 'muro')],
  }),
  rutas: crearRutasPlanta(planta),
  ambiente: {
    hora: 21,
    tipo: 'interior',
    paleta: { fondo: '#101a2a', acento: '#c9a15a', texto: '#fff0da' },
  },
  variantes: [
    { id: 'evento', nombre: 'Noche de evento', paleta: { hora: 21, fondo: '#101a2a' } },
    {
      id: 'ensayo',
      nombre: 'Ensayo',
      paleta: { hora: 17, fondo: '#343d4a', materiales: { hormigon: '#b3aa9b' } },
    },
  ],
  vistas: {
    general: { ...limites, y0: 0, y1: SALA.alto },
    elevacionGeneral: 40,
    margenGeneral: 0.94,
    seguir: { distancia: 10, elevacion: 40, frente: SALA.z1 },
    zonas: zonas.map((z) => ({
      id: z.id,
      nombre: z.nombre,
      caja: { ...z, y0: z.y, y1: z.y + z.alto },
    })),
  },
  ambienteComun: 'publico',
  asignacion: 'por-orden',
  personalizable: true,
};
registrarEscenario(escenarioAuditorio);
