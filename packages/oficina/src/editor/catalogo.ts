import { OBJETOS_NUEVOS } from './ampliacion';
export type CategoriaObjeto =
  | 'plantas'
  | 'asientos'
  | 'mesas'
  | 'pantallas'
  | 'luz'
  | 'decoracion'
  | 'trabajo'
  | 'juego'
  | 'cocina'
  | 'arte'
  | 'exterior'
  | 'eventos'
  | 'construccion';

/** Un tipo de objeto que se puede colocar. Medidas en metros: `ancho` (x) y `fondo` (z) con giro 0. */
export interface TipoObjeto {
  tipo: string;
  nombre: string;
  categoria: CategoriaObjeto;
  ancho: number;
  fondo: number;
  alto: number;
  sentable?: boolean;
  /** Asientos locales en metros; y corresponde a la pelvis. */
  asientos?: { x: number; z: number; y: number; yaw: number }[];
  /** Base de piezas de pared o colgantes, respecto del piso. */
  elevacion?: number;
  /** Volúmenes locales para aberturas y escalones, en metros. */
  colisiones?: { x: number; z: number; y: number; ancho: number; fondo: number; alto: number }[];
  /** Se camina por encima; una pieza elevada genera superficie, una alfombra queda al ras. */
  pisable?: boolean;
  /** No impide caminar; conserva las restricciones de colocación (cuadro de pared). */
  noBloqueaPaso?: boolean;
}

export const CATEGORIAS: { id: CategoriaObjeto; nombre: string }[] = [
  { id: 'plantas', nombre: 'Plantas' },
  { id: 'asientos', nombre: 'Asientos' },
  { id: 'mesas', nombre: 'Mesas' },
  { id: 'pantallas', nombre: 'Pizarras y pantallas' },
  { id: 'luz', nombre: 'Luz' },
  { id: 'decoracion', nombre: 'Decoración' },
  ...(['trabajo', 'juego', 'cocina', 'arte', 'exterior', 'eventos', 'construccion'] as const).map(
    (id, i) => ({
      id,
      nombre: [
        'Trabajo',
        'Juego',
        'Cocina y café',
        'Arte y pared',
        'Exterior',
        'Eventos',
        'Construcción',
      ][i]!,
    }),
  ),
];

export const CATALOGO_OBJETOS: TipoObjeto[] = [
  ...OBJETOS_NUEVOS,
  {
    tipo: 'planta-grande',
    nombre: 'Planta grande',
    categoria: 'plantas',
    ancho: 0.6,
    fondo: 0.6,
    alto: 1.6,
  },
  {
    tipo: 'maceta-baja',
    nombre: 'Maceta baja',
    categoria: 'plantas',
    ancho: 0.5,
    fondo: 0.5,
    alto: 0.6,
  },
  { tipo: 'palmera', nombre: 'Palmera', categoria: 'plantas', ancho: 0.9, fondo: 0.9, alto: 2.2 },
  {
    tipo: 'sofa-tres',
    nombre: 'Sofá de tres cuerpos',
    categoria: 'asientos',
    ancho: 2.2,
    fondo: 0.95,
    alto: 0.85,
    sentable: true,
    asientos: [-0.65, 0, 0.65].map((x) => ({ x, z: 0.05, y: 0.35, yaw: 0 })),
  },
  {
    tipo: 'sillon',
    nombre: 'Sillón',
    categoria: 'asientos',
    ancho: 0.9,
    fondo: 0.9,
    alto: 0.85,
    sentable: true,
    asientos: [{ x: 0, z: 0.05, y: 0.35, yaw: 0 }],
  },
  {
    tipo: 'puff',
    nombre: 'Puff',
    categoria: 'asientos',
    ancho: 0.6,
    fondo: 0.6,
    alto: 0.4,
    sentable: true,
    asientos: [{ x: 0, z: 0, y: 0.41, yaw: 0 }],
  },
  {
    tipo: 'banco',
    nombre: 'Banco',
    categoria: 'asientos',
    ancho: 1.2,
    fondo: 0.4,
    alto: 0.45,
    sentable: true,
    asientos: [-0.3, 0.3].map((x) => ({ x, z: 0, y: 0.42625, yaw: 0 })),
  },
  {
    tipo: 'mesa-redonda',
    nombre: 'Mesa redonda',
    categoria: 'mesas',
    ancho: 1.2,
    fondo: 1.2,
    alto: 0.75,
  },
  { tipo: 'mesa-alta', nombre: 'Mesa alta', categoria: 'mesas', ancho: 0.8, fondo: 0.8, alto: 1.1 },
  {
    tipo: 'escritorio',
    nombre: 'Escritorio',
    categoria: 'mesas',
    ancho: 1.4,
    fondo: 0.7,
    alto: 0.75,
  },
  {
    tipo: 'barra-cafe',
    nombre: 'Barra de café',
    categoria: 'mesas',
    ancho: 2.4,
    fondo: 0.7,
    alto: 1.05,
  },
  {
    tipo: 'pantalla-pie',
    nombre: 'Pantalla con pie',
    categoria: 'pantallas',
    ancho: 1.2,
    fondo: 0.4,
    alto: 1.7,
  },
  { tipo: 'pizarra', nombre: 'Pizarra', categoria: 'pantallas', ancho: 1.5, fondo: 0.1, alto: 1.2 },
  {
    tipo: 'lampara-pie',
    nombre: 'Lámpara de pie',
    categoria: 'luz',
    ancho: 0.4,
    fondo: 0.4,
    alto: 1.7,
  },
  {
    tipo: 'lampara-mesa',
    nombre: 'Lámpara de mesa',
    categoria: 'luz',
    ancho: 0.3,
    fondo: 0.3,
    alto: 0.5,
  },
  {
    tipo: 'alfombra',
    nombre: 'Alfombra',
    categoria: 'decoracion',
    ancho: 2,
    fondo: 1.4,
    alto: 0.02,
    pisable: true,
  },
  {
    tipo: 'estante',
    nombre: 'Estante',
    categoria: 'decoracion',
    ancho: 1.2,
    fondo: 0.35,
    alto: 1.9,
  },
  {
    tipo: 'cuadro',
    nombre: 'Cuadro',
    categoria: 'decoracion',
    ancho: 0.8,
    fondo: 0.05,
    alto: 0.6,
    noBloqueaPaso: true,
  },
];

const POR_TIPO = new Map(CATALOGO_OBJETOS.map((t) => [t.tipo, t]));

export function tipoObjeto(tipo: string): TipoObjeto | undefined {
  return POR_TIPO.get(tipo);
}
