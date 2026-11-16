import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace, LinearFilter } from 'three';
export interface PizarraMundoProps {
  lienzo: HTMLCanvasElement;
  posicion: { x: number; y: number; z: number; giro: number };
  alAbrir?: () => void;
}
/** Tablero independiente. Una textura por montaje, actualizada solo cuando cambia el lienzo. */
export function PizarraMundo({ lienzo, posicion, alAbrir }: PizarraMundoProps) {
  const invalidate = useThree((s) => s.invalidate);
  const textura = useMemo(() => {
    const t = new CanvasTexture(lienzo);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [lienzo]);
  useEffect(() => {
    const actualizar = () => {
      textura.needsUpdate = true;
      invalidate();
    };
    lienzo.addEventListener('d8:dibujo', actualizar);
    actualizar();
    return () => {
      lienzo.removeEventListener('d8:dibujo', actualizar);
      textura.dispose();
    };
  }, [lienzo, textura, invalidate]);
  return (
    <group position={[posicion.x, posicion.y, posicion.z]} rotation={[0, posicion.giro, 0]}>
      <mesh position={[0, 2.0375, 0]}>
        <boxGeometry args={[6.16, 3.535, 0.16]} />
        <meshStandardMaterial color="#292d34" roughness={0.6} />
      </mesh>
      <mesh
        position={[0, 2.0375, 0.085]}
        onClick={(e) => {
          e.stopPropagation();
          alAbrir?.();
        }}
      >
        <planeGeometry args={[6, 3.375]} />
        <meshBasicMaterial map={textura} toneMapped={false} />
      </mesh>
      {[-2.5, 2.5].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.2, 0]}>
            <boxGeometry args={[0.12, 0.4, 0.12]} />
            <meshStandardMaterial color="#292d34" />
          </mesh>
          <mesh position={[x, 0.045, 0]}>
            <boxGeometry args={[0.65, 0.09, 0.7]} />
            <meshStandardMaterial color="#292d34" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
