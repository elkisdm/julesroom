import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  VideoTexture,
} from 'three';
import type { Texture } from 'three';

export type Dibujo = (ctx: CanvasRenderingContext2D, ancho: number, alto: number) => void;

/** Lienzo 2D con su textura (sRGB, con mipmaps). Quien la crea la libera. */
export function nuevaTextura(ancho: number, alto: number, repetir = false) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el lienzo 2D de la sala de trading');
  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = SRGBColorSpace;
  textura.anisotropy = 8;
  textura.minFilter = LinearMipmapLinearFilter;
  textura.magFilter = LinearFilter;
  if (repetir) textura.wrapS = textura.wrapT = RepeatWrapping;
  return { ctx, textura };
}

/**
 * Textura dibujada una vez (y otra si cambia `clave`). Se libera al desmontar: cambiar de escenario
 * no deja texturas vivas.
 */
export function useLienzo(
  ancho: number,
  alto: number,
  dibujar: Dibujo,
  clave: unknown = 0,
): CanvasTexture {
  const { ctx, textura } = useMemo(() => nuevaTextura(ancho, alto), [ancho, alto]);
  useEffect(() => {
    dibujar(ctx, ancho, alto);
    textura.needsUpdate = true;
    // `dibujar` cambia de identidad en cada render; lo que manda volver a dibujar es `clave`.
  }, [ctx, textura, ancho, alto, clave]);
  useEffect(() => () => textura.dispose(), [textura]);
  return textura;
}

/**
 * Textura que se vuelve a dibujar cada `cada` segundos (datos que se mueven): el dibujo recibe el
 * tiempo de la escena. Con `animar` en falso queda quieta en su primer cuadro.
 */
export function useLienzoVivo(
  ancho: number,
  alto: number,
  dibujar: (ctx: CanvasRenderingContext2D, ancho: number, alto: number, t: number) => void,
  cada: number,
  animar: boolean,
): CanvasTexture {
  const { ctx, textura } = useMemo(() => nuevaTextura(ancho, alto), [ancho, alto]);
  const estado = useMemo(() => ({ ultimo: -Infinity }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t - estado.ultimo < cada || (!animar && estado.ultimo > -Infinity)) return;
    estado.ultimo = t;
    dibujar(ctx, ancho, alto, t);
    textura.needsUpdate = true;
  });
  useEffect(() => () => textura.dispose(), [textura]);
  return textura;
}

/** Contenido que llega de fuera para una pantalla: un lienzo (se resube cada cuadro) o un video. */
export type ContenidoExterno = HTMLCanvasElement | HTMLVideoElement;

const esVideo = (c: ContenidoExterno): c is HTMLVideoElement => 'videoWidth' in c;

/**
 * La textura de una superficie: la del contenido externo si llega (`contenidoPantallas[id]`) o la
 * propia de ejemplo. La del externo se crea al llegar, se libera al cambiar o al desmontar, y un lienzo
 * se marca para subir en cada cuadro (el video lo hace solo).
 */
export function useSuperficie(externo: ContenidoExterno | undefined, propia: Texture): Texture {
  const ajena = useMemo(() => {
    if (!externo) return null;
    const t = esVideo(externo) ? new VideoTexture(externo) : new CanvasTexture(externo);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [externo]);
  useEffect(() => () => ajena?.dispose(), [ajena]);
  useFrame(() => {
    if (ajena && !(ajena instanceof VideoTexture)) ajena.needsUpdate = true;
  });
  return ajena ?? propia;
}
