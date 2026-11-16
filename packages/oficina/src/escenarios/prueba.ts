/**
 * Escenario mínimo de UN nivel para las pruebas (no se registra solo): dos equipos y un ambiente
 * común, sin vanos, con los lugares dentro de su silla y la barra de café en el común.
 */
import { cajaDe } from '../mansion/plano';
import type { Ambiente, Caja, Lugar, Mueble } from '../mansion/plano';
import { crearRutasPlanta } from './rutasPlanta';
import type { Escenario, Planta } from './tipos';

const ambiente = (
  id: string,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  departamento: string | null,
  pasilloZ: number,
): Ambiente => ({
  id,
  nombre: id,
  nivel: 'piso1',
  y: 0,
  alto: 3,
  x0,
  x1,
  z0,
  z1,
  departamento,
  pasilloZ,
});

const lugar = (
  id: string,
  amb: string,
  departamento: string | null,
  x: number,
  z: number,
): Lugar => ({
  id,
  ambiente: amb,
  departamento,
  x,
  z,
  y: 0,
  yaw: 0,
  asiento: true,
  mira: { x, z: z - 1 },
  salida: { x, z: z + 0.8 },
  silla: `silla-${id}`,
  extra: false,
});

const escritorio = (id: string, amb: string, x: number, z: number): Mueble => ({
  id,
  tipo: 'escritorio',
  ambiente: amb,
  x,
  z,
  y: 0,
  ancho: 1.4,
  fondo: 0.7,
  alto: 0.74,
  giro: 0,
  conjunto: id,
});

const planta: Planta = {
  ambientes: [
    ambiente('a', 0, 8, 0, 6, 'equipo-1', 4.5),
    ambiente('b', 8, 16, 0, 6, 'equipo-2', 4.5),
    ambiente('comun', 0, 16, 6, 10, null, 8),
  ],
  muebles: [escritorio('esc-a1', 'a', 2, 2), escritorio('esc-b1', 'b', 10, 2)],
  lugares: [
    lugar('a-1', 'a', 'equipo-1', 2, 2.8),
    lugar('a-2', 'a', 'equipo-1', 5, 2.8),
    lugar('b-1', 'b', 'equipo-2', 10, 2.8),
    lugar('b-2', 'b', 'equipo-2', 13, 2.8),
    lugar('comun-1', 'comun', null, 4, 7),
    lugar('comun-2', 'comun', null, 6, 7),
  ],
  muros: [],
  vanos: [],
  escaleras: [],
  huecos: [],
  cafe: Array.from({ length: 12 }, (_, i) => ({ x: 8 + (i % 4) * 0.5, z: 9 })),
  luz: null,
  asistente: { x: 8, y: 3, z: 8 },
  niveles: [0],
};

const limites: Caja = { x0: 0, x1: 16, z0: 0, z1: 10 };

/** Escenario de prueba de un nivel; registra con otro `id` si el test lo necesita. */
export function crearEscenarioPrueba(id = 'prueba'): Escenario {
  return {
    id,
    nombre: 'Prueba',
    descripcion: 'Escenario mínimo para pruebas.',
    planta,
    zonas: [],
    pantallas: [],
    entradas: [{ x: 8, y: 0, z: 9, yaw: 0 }],
    intereses: [],
    paseo: { x0: 1, x1: 15, z0: 7, z1: 9.5 },
    reuniones: [],
    colision: () => ({ cajas: planta.muebles.map(cajaDe), limites }),
    rutas: crearRutasPlanta(planta),
    ambiente: {
      hora: null,
      tipo: 'interior',
      paleta: { fondo: '#000', acento: '#fff', texto: '#fff' },
    },
    variantes: [{ id: 'base', nombre: 'Base', paleta: { hora: 12 } }],
    vistas: {
      general: { x0: 0, x1: 16, y0: 0, y1: 4, z0: 0, z1: 10 },
      elevacionGeneral: 20,
      seguir: { distancia: 8, elevacion: 30 },
      zonas: [],
    },
    ambienteComun: 'comun',
    asignacion: 'por-orden',
  };
}
