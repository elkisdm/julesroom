import type { Atuendo } from '../tipos';
export const COLECCIONES = [
  { id: 'oficina', nombre: 'Oficina' },
  { id: 'creativa', nombre: 'Creativa' },
  { id: 'deportiva', nombre: 'Deportiva' },
  { id: 'noche', nombre: 'Noche' },
  { id: 'tecnica', nombre: 'Técnica' },
  { id: 'abrigo', nombre: 'Abrigo' },
];
export const TOPS_NUEVOS = [
  { id: 'chaleco', nombre: 'Chaleco' },
  { id: 'cardigan', nombre: 'Cárdigan' },
  { id: 'peto', nombre: 'Peto de taller' },
  { id: 'kimono', nombre: 'Chaqueta cruzada' },
  { id: 'bomber', nombre: 'Bomber' },
  { id: 'cortaviento', nombre: 'Cortaviento' },
  { id: 'polar', nombre: 'Polar' },
  { id: 'cuello-alto', nombre: 'Cuello alto' },
  { id: 'gabardina', nombre: 'Gabardina' },
  { id: 'parka', nombre: 'Parka' },
];
export interface Conjunto {
  id: string;
  nombre: string;
  coleccion: string;
  atuendo: Pick<Atuendo, 'top' | 'topColor' | 'bottom' | 'bottomColor' | 'shoes' | 'acc' | 'print'>;
}
const conjunto = (
  id: string,
  nombre: string,
  coleccion: string,
  top: string,
  topColor: string,
  bottom: string,
  bottomColor: string,
  shoes: string,
  acc: string[] = [],
): Conjunto => ({
  id,
  nombre,
  coleccion,
  atuendo: { top, topColor, bottom, bottomColor, shoes, acc, print: '' },
});
export const CONJUNTOS: Conjunto[] = [
  conjunto('grafito', 'Grafito', 'oficina', 'blazer', '#4b5363', 'pantalon', '#293241', '#151719', [
    'reloj',
  ]),
  conjunto('lino', 'Lino', 'oficina', 'camisa', '#e9e2d2', 'pantalon', '#9d8669', '#6b4b3a'),
  conjunto('salvia', 'Salvia', 'oficina', 'chaleco', '#758b79', 'pantalon', '#2f3a4f', '#6b4b3a'),
  conjunto('archivo', 'Archivo', 'oficina', 'cardigan', '#83524e', 'falda', '#39363e', '#151719', [
    'lentes',
  ]),
  conjunto('taller', 'Taller', 'creativa', 'peto', '#bd8748', 'pantalon', '#345572', '#e9ecef'),
  conjunto('tinta', 'Tinta', 'creativa', 'kimono', '#796488', 'short', '#44364b', '#e9ecef'),
  conjunto(
    'estudio',
    'Estudio',
    'creativa',
    'bomber',
    '#c77958',
    'pantalon',
    '#544b63',
    '#e9ecef',
    ['audifonos-estudio'],
  ),
  conjunto('cobalto', 'Cobalto', 'creativa', 'chaleco', '#527bac', 'falda', '#26374c', '#6b4b3a'),
  conjunto('pista', 'Pista', 'deportiva', 'cortaviento', '#bd514f', 'short', '#293241', '#e9ecef', [
    'gorra',
  ]),
  conjunto('cancha', 'Cancha', 'deportiva', 'deportiva', '#64957c', 'short', '#ddd8c9', '#e9ecef'),
  conjunto('ruta', 'Ruta', 'deportiva', 'polar', '#6aa7b0', 'pantalon', '#30495d', '#151719', [
    'mochila',
  ]),
  conjunto('entreno', 'Entreno', 'deportiva', 'poleron', '#a994c0', 'short', '#52465e', '#e9ecef'),
  conjunto('granate', 'Granate', 'noche', 'blazer', '#853e50', 'pantalon', '#242733', '#151719', [
    'reloj',
  ]),
  conjunto(
    'petroleo',
    'Petróleo',
    'noche',
    'cuello-alto',
    '#315f65',
    'falda',
    '#282c38',
    '#151719',
  ),
  conjunto('violeta', 'Violeta', 'noche', 'kimono', '#695476', 'pantalon', '#303443', '#151719', [
    'lentes-oscuros',
  ]),
  conjunto('perla', 'Perla', 'noche', 'camisa', '#c0c7ce', 'falda', '#5a3d6b', '#151719'),
  conjunto('campo', 'Campo', 'tecnica', 'chaleco', '#8a9161', 'pantalon', '#665640', '#6b4b3a', [
    'gorra',
  ]),
  conjunto('soporte', 'Soporte', 'tecnica', 'peto', '#3e5e79', 'pantalon', '#3d4650', '#151719'),
  conjunto(
    'terminal',
    'Terminal',
    'tecnica',
    'bomber',
    '#647780',
    'pantalon',
    '#293241',
    '#e9ecef',
    ['audifonos-estudio'],
  ),
  conjunto(
    'expedicion',
    'Expedición',
    'tecnica',
    'cortaviento',
    '#c69a4b',
    'pantalon',
    '#48605b',
    '#6b4b3a',
    ['mochila-urbana'],
  ),
  conjunto('bruma', 'Bruma', 'abrigo', 'gabardina', '#b4a793', 'pantalon', '#4d5261', '#6b4b3a', [
    'bufanda-lana',
  ]),
  conjunto('musgo', 'Musgo', 'abrigo', 'parka', '#607566', 'pantalon', '#3a424b', '#6b4b3a', [
    'gorro',
  ]),
  conjunto('canela', 'Canela', 'abrigo', 'cardigan', '#b56f4b', 'falda', '#56404b', '#6b4b3a'),
  conjunto('nieve', 'Nieve', 'abrigo', 'polar', '#d9ddcf', 'pantalon', '#627283', '#151719', [
    'bufanda-lana',
  ]),
];
/** Equipa el conjunto completo sin cambiar la identidad del personaje. */
export function aplicarConjunto(a: Atuendo, id: string): Atuendo {
  const c = CONJUNTOS.find((c) => c.id === id);
  return c ? { ...a, ...c.atuendo, acc: [...c.atuendo.acc] } : a;
}
