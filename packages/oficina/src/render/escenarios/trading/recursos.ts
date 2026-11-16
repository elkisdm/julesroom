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
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import type { PaletaVariante } from '../../../escenarios/tipos';
import { colorDe, emisivoDe } from '../../../escenarios/variantes';
import { dibujarMancha } from './texturas';
import { nuevaTextura } from './lienzo';

/** Brillo que no pasa por el tono fílmico: luminarias y pantallas. */
export const emisivo = (hex: string, fuerza: number) =>
  new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(fuerza), toneMapped: false });

/** Brillo propio de la variante: `clave` con los valores de la plantilla de respaldo. */
const brillo = (p: PaletaVariante, clave: string, color: string, fuerza: number) => {
  const e = emisivoDe(p, clave, { color, fuerza });
  return emisivo(e.color, e.fuerza);
};

const URLS = {
  nogal: new URL('../../casa/texturas/nogal.webp', import.meta.url).href,
  nogalRugosidad: new URL('../../casa/texturas/nogal-rugosidad.webp', import.meta.url).href,
  hormigon: new URL('../../casa/texturas/hormigon.webp', import.meta.url).href,
  cuero: new URL('../../casa/texturas/cuero.webp', import.meta.url).href,
};

/**
 * Materiales y geometrías de la sala de trading, creados al montar el escenario y liberados al
 * desmontarlo (cambiar de escenario no deja nada vivo en la GPU). Paleta «hora azul en el piso»:
 * pizarra cálida, nogal, latón en cantos y lámparas, tinta en los muros; la variante de luz (`paleta`)
 * reemplaza los colores y brillos que declara.
 */
export function crearRecursos(paleta: PaletaVariante = { hora: 21 }) {
  const c = (clave: string, base: string) => colorDe(paleta, clave, base);
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

  const mat = {
    nogal: new MeshStandardMaterial({
      color: c('nogal', '#c08a63'),
      roughness: 0.5,
      map: cargar(URLS.nogal, [2, 0.6], true),
      roughnessMap: cargar(URLS.nogalRugosidad, [2, 0.6], false),
    }),
    nogalPanel: new MeshStandardMaterial({
      color: c('nogalPanel', '#a8714f'),
      roughness: 0.6,
      map: cargar(URLS.nogal, [4, 1.2], true),
    }),
    hormigon: new MeshStandardMaterial({
      color: c('hormigon', '#8f8a84'),
      roughness: 0.9,
      map: cargar(URLS.hormigon, [1, 3], true),
    }),
    laton: new MeshStandardMaterial({ color: '#c9a15a', roughness: 0.28, metalness: 1 }),
    metal: new MeshStandardMaterial({
      color: c('metal', '#2a2e36'),
      roughness: 0.4,
      metalness: 0.7,
    }),
    metalClaro: new MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.3, metalness: 0.9 }),
    bisel: new MeshStandardMaterial({ color: '#0d0f13', roughness: 0.35, metalness: 0.5 }),
    tela: new MeshStandardMaterial({ color: c('tela', '#3a4352'), roughness: 0.92 }),
    butaca: new MeshStandardMaterial({ color: '#7a3330', roughness: 0.85 }),
    cuero: new MeshStandardMaterial({
      color: '#a2704f',
      roughness: 0.55,
      map: cargar(URLS.cuero, [1, 1], true),
    }),
    piedra: new MeshStandardMaterial({
      color: c('piedra', '#b3aa9b'),
      roughness: 0.38,
      metalness: 0.05,
    }),
    tinta: new MeshStandardMaterial({
      color: c('tinta', '#1c2638'),
      roughness: 0.8,
      metalness: 0.05,
    }),
    alfombraAula: new MeshStandardMaterial({ color: c('alfombraAula', '#4a2a2c'), roughness: 1 }),
    alfombra: new MeshStandardMaterial({ color: c('alfombra', '#2c3446'), roughness: 1 }),
    hoja: new MeshStandardMaterial({ color: '#2f6142', roughness: 0.8, flatShading: true }),
    hojaClara: new MeshStandardMaterial({ color: '#4f8a4c', roughness: 0.8, flatShading: true }),
    maceta: new MeshStandardMaterial({ color: '#2a2724', roughness: 0.7 }),
    vidrio: new MeshStandardMaterial({
      color: '#a9cbe0',
      roughness: 0.05,
      metalness: 0.2,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: DoubleSide,
    }),
    luzCalida: brillo(paleta, 'luzCalida', '#ffcf9a', 3),
    luzTenue: brillo(paleta, 'luzTenue', '#ffb978', 1.6),
    botellas: brillo(paleta, 'botellas', '#ffb36b', 1.4),
    /** Sombra de contacto: mancha negra semitransparente bajo los muebles. */
    sombra: new MeshBasicMaterial({
      color: '#000000',
      alphaMap: mancha.textura,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
    /** Charco de luz en el piso (suma). */
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
    cilindroBajo: new CylinderGeometry(0.5, 0.5, 1, 12),
    hojas: new IcosahedronGeometry(0.5, 0),
    plano: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  };
  aplicarPaletaCatalogo(mat, paleta);
  const extras: (Material | BufferGeometry)[] = [];
  return {
    mat,
    geo,
    /** La variante con que se creó (los dibujos leen de ella luces y charcos). */
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

/** Los recursos de la sala montada. */
export function useRecursos(): Recursos {
  const r = useContext(ContextoRecursos);
  if (!r) throw new Error('useRecursos fuera de la sala de trading');
  return r;
}
