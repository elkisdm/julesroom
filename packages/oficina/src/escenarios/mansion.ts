/**
 * La mansión como escenario: envuelve `mansion/plano` y `mansion/rutas` sin copiar datos (las listas
 * de la planta son las mismas del plano). Es el escenario por defecto del motor.
 */
import { cajasDeNivel } from '../animacion/colision';
import { NIVEL_Y, plano } from '../mansion/plano';
import type { Ambiente, Nivel } from '../mansion/plano';
import { crearRuta, escribirVisita, quitarVisita } from '../mansion/rutas';
import { ELEVACION_GRADOS } from '../render/orbita';
import { sueloMansion } from './sueloMansion';
import type { Caja3, Escenario, Pantalla, Planta, TipoZona, ZonaEscenario } from './tipos';

/** Alto (m) con que se encuadra un ambiente sin techo (la terraza). */
const ALTO_SIN_TECHO = 2.5;

/** Reposo del orbe asistente: a media altura del atrio (el plano trae 3,2; en la casa se usa 3,7). */
const ASISTENTE_REPOSO = { x: plano.asistente.x, y: 3.7, z: plano.asistente.z };

const planta: Planta = {
  ambientes: plano.ambientes,
  muebles: plano.muebles,
  lugares: plano.lugares,
  muros: plano.muros,
  vanos: plano.vanos,
  escaleras: plano.escaleras,
  huecos: plano.huecos,
  cafe: plano.cafe,
  luz: plano.luz,
  asistente: ASISTENTE_REPOSO,
  niveles: Object.values(NIVEL_Y),
};

const tipoDeZona = (a: Ambiente): TipoZona => {
  if (a.id === 'atrio') return 'paso';
  return a.departamento === 'personal' || a.id === 'cocina' ? 'descanso' : 'trabajo';
};

const zonas: ZonaEscenario[] = plano.ambientes
  .filter((a) => a.departamento !== null || a.id === 'atrio' || a.id === 'cocina')
  .map((a) => ({
    id: a.id,
    nombre: a.nombre,
    tipo: tipoDeZona(a),
    x0: a.x0,
    x1: a.x1,
    z0: a.z0,
    z1: a.z1,
    y: a.y,
    alto: a.alto,
    ...(a.departamento !== null && tipoDeZona(a) === 'trabajo'
      ? { departamento: a.departamento }
      : {}),
  }));

const pantallas: Pantalla[] = plano.muebles
  .filter((m) => m.tipo === 'videowall' || m.tipo === 'pantalla-pipeline')
  .map((m) => ({
    id: m.id,
    x: m.x,
    y: (plano.ambientes.find((a) => a.id === m.ambiente)?.y ?? 0) + m.y + m.alto / 2,
    z: m.z,
    ancho: m.ancho,
    alto: m.alto,
    giro: m.giro,
    radio: 0,
    contenido: m.tipo === 'videowall' ? 'video' : 'tablero',
    zona: m.ambiente,
  }));

const vistaZona = (a: Ambiente) => ({
  id: a.id,
  nombre: a.nombre,
  caja: {
    x0: a.x0,
    x1: a.x1,
    y0: a.y,
    y1: a.y + (a.alto > 0 ? a.alto : ALTO_SIN_TECHO),
    z0: a.z0,
    z1: a.z1,
  } satisfies Caja3,
});

/** El nivel de la mansión cuya altura está más cerca de `y`. */
function nivelMasCercano(y: number): Nivel {
  const niveles = Object.entries(NIVEL_Y) as [Nivel, number][];
  return niveles.reduce((mejor, n) => (Math.abs(n[1] - y) < Math.abs(mejor[1] - y) ? n : mejor))[0];
}

export const escenarioMansion: Escenario = {
  id: 'mansion',
  nombre: 'Mansión',
  descripcion: 'Casa de cuatro niveles con atrio de doble altura, terraza y piscina.',
  planta,
  zonas,
  pantallas,
  // En la cocina, fuera del atrio donde pasean las personas simuladas; punto libre de muebles.
  entradas: [{ x: 12, y: NIVEL_Y.piso1, z: 0, yaw: -Math.PI / 2 }],
  intereses: [],
  paseo: { x0: -3.6, x1: 3.6, z0: -3.6, z1: 3.6 },
  // Unos pocos corros: el atrio, la cocina y el living.
  reuniones: [
    { x: -1.5, z: 2.2, radio: 0.8, cupo: 3 },
    { x: 12, z: 1.5, radio: 0.9, cupo: 3 },
    { x: -5.6, z: 2.5, radio: 0.8, cupo: 2 },
  ],
  colision: (y) => cajasDeNivel(nivelMasCercano(y)),
  suelo: sueloMansion,
  rutas: { crearRuta, escribirVisita, quitarVisita },
  ambiente: {
    hora: null,
    tipo: 'exterior',
    paleta: { fondo: '#101820', acento: '#d8b56a', texto: '#f3efe6' },
  },
  // La luz de la casa sale entera de la hora (`paletaLuz`): cielo, sol, luna, agua e interior encendido.
  variantes: [
    { id: 'dia', nombre: 'Día', paleta: { hora: 13 } },
    { id: 'noche', nombre: 'Noche', paleta: { hora: 22 } },
  ],
  vistas: {
    // La casa entera: del terreno cortado a la cima de la torre, y la piscina al frente
    // (la misma caja que encuadra `render/camara.ts` en la vista general).
    general: { x0: -16, x1: 16, y0: -4, y1: 15.5, z0: -4, z1: 10 },
    // En vertical: la planta baja a lo ancho del atrio, con la base de la casa al frente en pantalla.
    generalVertical: { x0: -8, x1: 8, y0: 0, y1: 9, z0: -4, z1: 10 },
    baseVertical: { y: -2, z: 9 },
    elevacionGeneral: ELEVACION_GRADOS,
    // Al seguir al avatar la cámara sube a 35° (a 14° los demás lo tapaban en el grupo) y se aleja a
    // 10,5 m (a 8 m el avatar llenaba el cuadro y no se veía el entorno).
    seguir: { distancia: 10.5, elevacion: 35 },
    zonas: plano.ambientes.map(vistaZona),
  },
  ambienteComun: 'atrio',
  asignacion: 'por-id',
};
