/**
 * Al entrar a construir en una pantalla alta, la cámara se acerca y se pone más cenital.
 * No toca el seguimiento del avatar: solo corre mientras este componente está montado.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { controlesSuspendidos, useEscenario } from '@oficina/motor';
import type { Vistas } from '@oficina/motor';
import { encuadreConstruir } from './interaccionMobiliario';
import { PARAMETROS_CONSTRUIR } from './parametrosConstruir';

interface Orbita {
  target: { set: (x: number, y: number, z: number) => void };
  update: () => void;
  touches: { ONE: number; TWO: number };
}

export function EncuadreConstruir() {
  const escenario = useEscenario();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as Orbita | null;
  const hasta = useRef(0);
  const vivo = useRef({ ancho: size.width, alto: size.height, vistas: escenario.vistas });
  vivo.current = { ancho: size.width, alto: size.height, vistas: escenario.vistas as Vistas };

  useEffect(() => {
    hasta.current = performance.now() + PARAMETROS_CONSTRUIR.sujetarEncuadreMs;
  }, []);

  useEffect(() => {
    if (!controls?.touches || size.width > PARAMETROS_CONSTRUIR.anchoTelefono) return;
    const antes = { ONE: controls.touches.ONE, TWO: controls.touches.TWO };
    controls.touches.ONE = PARAMETROS_CONSTRUIR.toque.unDedo;
    controls.touches.TWO = PARAMETROS_CONSTRUIR.toque.dosDedos;
    return () => {
      controls.touches.ONE = antes.ONE;
      controls.touches.TWO = antes.TWO;
    };
  }, [controls, size.width]);

  // Prioridad 0: una prioridad positiva apaga el render automático de la escena.
  useFrame(() => {
    if (controlesSuspendidos()) return;
    if (performance.now() > hasta.current || !controls?.target) return;
    const v = vivo.current;
    const enc = encuadreConstruir(v.vistas, v.ancho, v.alto);
    if (!enc) return;
    controls.target.set(enc.objetivo.x, enc.objetivo.y, enc.objetivo.z);
    camera.position.set(enc.posicion.x, enc.posicion.y, enc.posicion.z);
    controls.update();
  });

  return null;
}
