import { aplicarPaletaCatalogo } from '../../aplicarPaletaCatalogo';
import { createContext, useContext } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import type { PaletaVariante } from '../../../escenarios/tipos';
import { colorDe, emisivoDe } from '../../../escenarios/variantes';
import { nuevaTextura } from '../trading/lienzo';
import { dibujarMancha } from '../trading/texturas';
import { dibujarLadrillo } from './texturas';

/** Brillo que no pasa por el tono fílmico: bombillas y pantallas. */
export const emisivo = (hex: string, fuerza: number) =>
  new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(fuerza), toneMapped: false });

const URLS = {
  madera: new URL('../../casa/texturas/nogal.webp', import.meta.url).href,
  maderaRugosidad: new URL('../../casa/texturas/nogal-rugosidad.webp', import.meta.url).href,
  cuero: new URL('../../casa/texturas/cuero.webp', import.meta.url).href,
};

/** Lado (m) del paño de ladrillo que cubre la textura (se repite). */
export const PANO_LADRILLO = 1.2;

/**
 * Materiales y geometrías de la oficina «Nave de la mañana», creados al montar el escenario y liberados al
 * desmontarlo. Paleta: ladrillo encalado, cemento claro, roble claro, acero negro, terracota y salvia; la
 * variante de luz (`paleta`) reemplaza los colores y brillos que declara.
 */
export function crearRecursos(paleta: PaletaVariante = { hora: 10 }) {
  const c = (clave: string, base: string) => colorDe(paleta, clave, base);
  const brillo = (clave: string, color: string, fuerza: number) => {
    const e = emisivoDe(paleta, clave, { color, fuerza });
    return emisivo(e.color, e.fuerza);
  };
  const texturas: Texture[] = [];
  const cargador = new TextureLoader();
  const cargar = (url: string, repetir: [number, number], color: boolean) => {
    const t = cargador.load(url);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(...repetir);
    t.anisotropy = 8;
    if (color) t.colorSpace = SRGBColorSpace;
    texturas.push(t);
    return t;
  };
  const mancha = nuevaTextura(256, 256);
  dibujarMancha(mancha.ctx, 256, 256);
  mancha.textura.needsUpdate = true;
  texturas.push(mancha.textura);

  const ladrillo = nuevaTextura(512, 512, true);
  dibujarLadrillo(ladrillo.ctx, 512, 512);
  ladrillo.textura.needsUpdate = true;
  ladrillo.textura.repeat.set(1 / PANO_LADRILLO, 1 / PANO_LADRILLO);
  texturas.push(ladrillo.textura);

  const mat = {
    /** Ladrillo encalado con su junta (las UV de los muros van en metros). */
    ladrillo: new MeshStandardMaterial({
      color: '#ffffff',
      map: ladrillo.textura,
      bumpMap: ladrillo.textura,
      bumpScale: 2.2,
      roughness: 0.92,
      side: DoubleSide,
    }),
    roble: new MeshStandardMaterial({
      color: '#e2b47c',
      roughness: 0.55,
      map: cargar(URLS.madera, [1.6, 0.5], true),
      roughnessMap: cargar(URLS.maderaRugosidad, [1.6, 0.5], false),
    }),
    robleClaro: new MeshStandardMaterial({
      color: '#efc995',
      roughness: 0.6,
      map: cargar(URLS.madera, [0.6, 0.6], true),
    }),
    acero: new MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.45, metalness: 0.6 }),
    aceroMate: new MeshStandardMaterial({ color: '#262626', roughness: 0.75, metalness: 0.3 }),
    inox: new MeshStandardMaterial({ color: '#c9cbcc', roughness: 0.3, metalness: 0.85 }),
    terracota: new MeshStandardMaterial({ color: '#c4673f', roughness: 0.85 }),
    terracotaCuero: new MeshStandardMaterial({
      color: '#ffc7a2',
      roughness: 0.55,
      map: cargar(URLS.cuero, [1, 1], true),
    }),
    salvia: new MeshStandardMaterial({ color: '#8fa98a', roughness: 0.9 }),
    salviaLaca: new MeshStandardMaterial({ color: '#7f9b7c', roughness: 0.5 }),
    crema: new MeshStandardMaterial({ color: '#e8dccb', roughness: 0.95 }),
    piedra: new MeshStandardMaterial({ color: '#ece7df', roughness: 0.32 }),
    cemento: new MeshStandardMaterial({ color: '#b9b2a7', roughness: 0.85 }),
    plastico: new MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.5 }),
    teclado: new MeshStandardMaterial({ color: '#d9d6d0', roughness: 0.6 }),
    hoja: new MeshStandardMaterial({
      color: c('hoja', '#3f6b3a'),
      roughness: 0.8,
      flatShading: true,
    }),
    hojaClara: new MeshStandardMaterial({
      color: c('hojaClara', '#6c9a55'),
      roughness: 0.8,
      flatShading: true,
    }),
    pasto: new MeshStandardMaterial({ color: c('pasto', '#7f9a5c'), roughness: 1 }),
    vidrio: new MeshStandardMaterial({
      color: '#dbe9f0',
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: DoubleSide,
    }),
    esmerilado: new MeshStandardMaterial({
      color: '#f4f1ea',
      roughness: 0.9,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: DoubleSide,
    }),
    luzCalida: brillo('luzCalida', '#ffd9a6', 2.4),
    /** Sombra de contacto: mancha negra semitransparente bajo los muebles. */
    sombra: new MeshBasicMaterial({
      color: '#2a1c10',
      alphaMap: mancha.textura,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    }),
    /** Charco de luz (suma). */
    charco: new MeshBasicMaterial({
      map: mancha.textura,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  };
  const geo = {
    caja: new BoxGeometry(1, 1, 1),
    cilindro: new CylinderGeometry(0.5, 0.5, 1, 28),
    cilindroBajo: new CylinderGeometry(0.5, 0.5, 1, 10),
    /** Pantalla de lámpara: cono abierto por abajo. */
    campana: new CylinderGeometry(0.12, 0.5, 1, 24, 1, true),
    /** Maceta: más ancha arriba. */
    maceta: new CylinderGeometry(0.5, 0.38, 1, 20),
    hojas: new IcosahedronGeometry(0.5, 1),
    rueda: new TorusGeometry(0.33, 0.025, 6, 28),
    plano: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  };
  aplicarPaletaCatalogo(mat, paleta);
  const extras: (Material | BufferGeometry)[] = [];
  return {
    mat,
    geo,
    /** La variante con que se creó (los dibujos leen de ella luces, franjas y patio). */
    paleta,
    /** Material o geometría creada aparte que también se libera al desmontar. */
    guardar<T extends Material | BufferGeometry>(x: T): T {
      extras.push(x);
      return x;
    },
    /** Libera todo lo creado (al desmontar el escenario). */
    liberar() {
      for (const m of Object.values(mat)) m.dispose();
      for (const g of Object.values(geo)) g.dispose();
      for (const t of texturas) t.dispose();
      for (const x of extras) x.dispose();
    },
  };
}

export type Recursos = ReturnType<typeof crearRecursos>;

export const ContextoRecursos = createContext<Recursos | null>(null);

/** Los recursos de la oficina montada. */
export function useRecursos(): Recursos {
  const r = useContext(ContextoRecursos);
  if (!r) throw new Error('useRecursos fuera de la oficina');
  return r;
}
