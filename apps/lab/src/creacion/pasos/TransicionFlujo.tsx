import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3 } from 'three';
import type { Paso } from '../Crear';
import { useReduceMotion } from '@oficina/motor';
import { progresoTransicion } from './estadoFlujo';

/** Mezcla la última presentación con la cámara de seguimiento sin reiniciar el motor. */
export function TransicionFlujo({ paso }: { paso: Paso }) {
  const camera = useThree((s) => s.camera);
  const reducido = useReduceMotion();
  const anterior = useRef(paso);
  const [s] = useState(() => ({
    ultima: new Vector3(),
    ultimaQ: new Quaternion(),
    origen: new Vector3(),
    origenQ: new Quaternion(),
    destino: new Vector3(),
    destinoQ: new Quaternion(),
    tiempo: Infinity,
    activa: false,
    tienePose: false,
  }));
  // El motor siempre recibe su pose sin mezclar: evita realimentar la interpolación.
  useFrame(() => {
    if (s.activa) {
      camera.position.copy(s.destino);
      camera.quaternion.copy(s.destinoQ);
    }
  }, -2);
  useFrame((_, dt) => {
    if (anterior.current !== paso) {
      s.activa = paso === 'dentro' && s.tienePose;
      s.tiempo = 0;
      s.origen.copy(s.ultima);
      s.origenQ.copy(s.ultimaQ);
      anterior.current = paso;
    }
    if (s.activa) {
      s.destino.copy(camera.position);
      s.destinoQ.copy(camera.quaternion);
      const t = progresoTransicion(s.tiempo, reducido);
      camera.position.lerpVectors(s.origen, s.destino, t);
      camera.quaternion.slerpQuaternions(s.origenQ, s.destinoQ, t);
      camera.updateMatrixWorld();
      s.tiempo += dt;
      if (t === 1) s.activa = false;
    }
    s.ultima.copy(camera.position);
    s.ultimaQ.copy(camera.quaternion);
    s.tienePose = true;
  });
  return null;
}
