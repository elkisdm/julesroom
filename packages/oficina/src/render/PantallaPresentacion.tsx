import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace, LinearFilter, type Mesh } from 'three';
import type { ThreeEvent } from '@react-three/fiber';

export interface PantallaPresentacionProps {
  posicion: { x: number; y: number; z: number; giro: number; ancho: number };
  lienzo: HTMLCanvasElement | null;
  enfocada?: boolean;
  laser?: { x: number; y: number; visible: boolean } | null;
  alVer?: () => void;
  alApuntar?: (x: number, y: number, presionado: boolean) => void;
}
const PARAMETROS = { pie: 0.45, marco: 0.12, grosor: 0.16, radioLaser: 0.025, suavizado: 24 };
/** Pantalla 16:9 sobre pies. Una textura por lienzo y liberación al cambiar o desmontar. */
export function PantallaPresentacion({
  posicion: p,
  lienzo,
  laser,
  alVer,
  alApuntar,
  enfocada = false,
}: PantallaPresentacionProps) {
  const [textura, setTextura] = useState<CanvasTexture | null>(null);
  const punto = useRef<Mesh>(null);
  useEffect(() => {
    if (!lienzo) {
      setTextura(null);
      return;
    }
    const t = new CanvasTexture(lienzo);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = false;
    setTextura(t);
    return () => {
      t.dispose();
    };
  }, [lienzo]);
  const alto = (p.ancho * 9) / 16;
  const centro = PARAMETROS.pie + alto / 2;
  useFrame((_, delta) => {
    const mesh = punto.current;
    if (!mesh) return;
    mesh.visible = !!laser?.visible;
    if (!laser) return;
    const k = 1 - Math.exp(-PARAMETROS.suavizado * delta);
    mesh.position.x += ((laser.x - 0.5) * p.ancho - mesh.position.x) * k;
    mesh.position.y += ((0.5 - laser.y) * alto + centro - mesh.position.y) * k;
  });
  const apuntar = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.uv) alApuntar?.(e.uv.x, 1 - e.uv.y, e.buttons > 0 || e.pointerType === 'touch');
  };
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.giro, 0]} name="pantalla-presentacion">
      <mesh position={[0, centro, -0.06]}>
        <boxGeometry
          args={[p.ancho + PARAMETROS.marco * 2, alto + PARAMETROS.marco * 2, PARAMETROS.grosor]}
        />
        <meshStandardMaterial
          color="#11151d"
          roughness={0.4}
          metalness={0.6}
          emissive="#dcc594"
          emissiveIntensity={0.05}
        />
      </mesh>
      <mesh
        renderOrder={enfocada ? 1000 : 0}
        position={[0, centro, 0.03]}
        onClick={(e) => {
          e.stopPropagation();
          alVer?.();
        }}
        onPointerMove={apuntar}
        onPointerDown={apuntar}
        onPointerLeave={() => alApuntar?.(0.5, 0.5, false)}
      >
        <planeGeometry args={[p.ancho, alto]} />
        {/* Con o sin textura son programas distintos: three.js no recompila al pasar map de null a
            una textura, y la pantalla quedaba blanca para el anfitrión que la pone antes de la lámina. */}
        <meshBasicMaterial
          key={textura ? 'con-lamina' : 'sin-lamina'}
          transparent={enfocada}
          depthTest={!enfocada}
          depthWrite={!enfocada}
          map={textura}
          color={textura ? '#ffffff' : '#101722'}
          toneMapped={false}
        />
      </mesh>
      {[-1, 1].map((lado) => (
        <group key={lado} position={[lado * p.ancho * 0.36, 0, -0.02]}>
          <mesh position={[0, PARAMETROS.pie / 2, 0]}>
            <boxGeometry args={[0.08, PARAMETROS.pie, 0.12]} />
            <meshStandardMaterial color="#202631" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.4, 0.08, 0.6]} />
            <meshStandardMaterial color="#202631" metalness={0.7} roughness={0.35} />
          </mesh>
        </group>
      ))}
      <mesh ref={punto} renderOrder={1001} position={[0, centro, 0.05]} raycast={() => null}>
        <circleGeometry args={[(PARAMETROS.radioLaser * p.ancho) / 6, 16]} />
        <meshBasicMaterial
          color="#ff514b"
          transparent
          toneMapped={false}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
