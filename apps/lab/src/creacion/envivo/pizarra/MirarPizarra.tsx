import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { suspenderControlesCamara } from '@oficina/motor';
import type { PerspectiveCamera, Vector3 } from 'three';
import type { PosicionPizarra } from './mensajes';
import { encuadrarPizarra } from './encuadre';
/** Encuadre optativo local; al salir devuelve exactamente la cámara que tenía el visitante. */
export function MirarPizarra({ posicion }: { posicion: PosicionPizarra }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controles = useThree((s) => s.controls) as unknown as { target: Vector3 } | null;
  const size = useThree((s) => s.size),
    invalidate = useThree((s) => s.invalidate);
  const pose = useRef({
    posicion: camera.position.clone(),
    giro: camera.quaternion.clone(),
    objetivo: controles?.target.clone(),
  });
  useEffect(() => {
    const soltar = suspenderControlesCamara();
    return () => {
      camera.position.copy(pose.current.posicion);
      camera.quaternion.copy(pose.current.giro);
      if (pose.current.objetivo) controles?.target.copy(pose.current.objetivo);
      camera.updateMatrixWorld();
      soltar();
      invalidate();
    };
  }, [camera, controles, invalidate]);
  useEffect(() => {
    const e = encuadrarPizarra(posicion, size.width, size.height, camera.fov);
    camera.position.set(e.posicion.x, e.posicion.y, e.posicion.z);
    camera.lookAt(e.objetivo.x, e.objetivo.y, e.objetivo.z);
    controles?.target.set(e.objetivo.x, e.objetivo.y, e.objetivo.z);
    camera.updateMatrixWorld();
    invalidate();
  }, [posicion, size.width, size.height, camera, controles, invalidate]);
  return null;
}
