import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, InstancedMesh, Light, Object3D, SpotLight, Vector3 } from 'three';
import type { Punto3 } from './camara';
import { useReduceMotion } from './preferencias';
const EFECTOS = {
  piezas: 96,
  radio: 18,
  altura: 10,
  intensidad: 90,
  ambiente: 0.35,
  colores: ['#e9b949', '#f4efe6', '#7fd88f'],
};

/** Un único draw call para confeti; el foco sigue al anfitrión sin renders de React. */
export function EfectosMomento({
  celebrar,
  atencion,
  anfitrion,
}: {
  celebrar: { inicio: number; fin: number } | null;
  atencion: boolean;
  anfitrion: () => Punto3 | null;
}) {
  const scene = useThree((s) => s.scene);
  const reducir = useReduceMotion();
  const malla = useRef<InstancedMesh>(null);
  const foco = useRef<SpotLight>(null);
  const temporal = useMemo(() => new Object3D(), []);
  const objetivo = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  const posicion = useMemo(() => new Vector3(), []);
  useEffect(() => {
    if (!atencion) return;
    const luces = new Map<Light, number>();
    scene.traverse((o) => {
      if (o instanceof Light && o !== foco.current) {
        luces.set(o, o.intensity);
        o.intensity *= EFECTOS.ambiente;
      }
    });
    const entorno = scene.environmentIntensity;
    scene.environmentIntensity *= EFECTOS.ambiente;
    scene.add(objetivo);
    return () => {
      for (const [luz, intensidad] of luces) luz.intensity = intensidad;
      scene.environmentIntensity = entorno;
      scene.remove(objetivo);
    };
  }, [scene, atencion, objetivo]);
  useEffect(() => {
    const mesh = malla.current;
    if (!mesh) return;
    for (let i = 0; i < EFECTOS.piezas; i++)
      mesh.setColorAt(i, color.set(EFECTOS.colores[i % EFECTOS.colores.length]!));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [celebrar, color]);
  useFrame(() => {
    if (foco.current && atencion) {
      const p = anfitrion();
      foco.current.visible = Boolean(p);
      if (p) {
        posicion.set(p.x, p.y + 1, p.z);
        objetivo.position.copy(posicion);
        objetivo.updateMatrixWorld();
        foco.current.position.set(p.x, p.y + EFECTOS.altura, p.z + 2);
      }
    }
    const mesh = malla.current;
    if (!mesh || !celebrar) return;
    const progreso = (Date.now() - celebrar.inicio) / (celebrar.fin - celebrar.inicio);
    mesh.visible = progreso >= 0 && progreso < 1;
    if (!mesh.visible) return;
    for (let i = 0; i < EFECTOS.piezas; i++) {
      const angulo = i * 2.399;
      const radio = Math.sqrt((i + 1) / EFECTOS.piezas) * EFECTOS.radio;
      temporal.position.set(
        Math.cos(angulo) * radio,
        EFECTOS.altura - (reducir ? 0 : progreso * 5 + (i % 7) / 4),
        Math.sin(angulo) * radio,
      );
      temporal.rotation.set(reducir ? 0 : progreso * 4 + i, angulo, 0);
      temporal.scale.setScalar(1);
      temporal.updateMatrix();
      mesh.setMatrixAt(i, temporal.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      {celebrar && (
        <instancedMesh
          ref={malla}
          args={[undefined, undefined, EFECTOS.piezas]}
          frustumCulled={false}
        >
          <planeGeometry args={[0.12, 0.24]} />
          <meshBasicMaterial toneMapped={false} side={2} />
        </instancedMesh>
      )}
      {atencion && (
        <spotLight
          ref={foco}
          target={objetivo}
          color="#f6d27a"
          intensity={EFECTOS.intensidad}
          angle={0.36}
          penumbra={0.8}
          distance={24}
          decay={1}
        />
      )}
    </>
  );
}
