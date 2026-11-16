import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OBJETOS_NUEVOS, tipoObjeto } from '@oficina/motor';
import type { ObjetoColocado } from '@oficina/motor';
import { Objetos3D } from '../creacion/construir/Objetos3D';
const q = new URLSearchParams(location.search);
const medir = q.has('rendimiento');
const tipo = q.get('objeto') ?? 'sofa-modulo';
const t = tipoObjeto(tipo)!;
const PARAMETROS_MUESTRAS = {
  cantidad: 150,
  columnas: 15,
  separacion: 3.3,
  calentamiento: 120,
  muestras: 300,
};
declare global {
  interface Window {
    __catalogoMedicion?: {
      fps: number;
      p95: number;
      llamadas: number;
      triangulos: number;
      objetos: number;
      gpu: string;
      cuadros: number;
    };
  }
}
function Escena() {
  const { camera, gl } = useThree();
  const datos = useRef({ cuadros: 0, tiempos: [] as number[], llamadas: 0, triangulos: 0 });
  const objetos = useMemo<ObjetoColocado[]>(
    () =>
      medir
        ? Array.from({ length: PARAMETROS_MUESTRAS.cantidad }, (_, i) => ({
            id: `prueba-${i}`,
            tipo: OBJETOS_NUEVOS[i % OBJETOS_NUEVOS.length]!.tipo,
            x: ((i % PARAMETROS_MUESTRAS.columnas) - 7) * PARAMETROS_MUESTRAS.separacion,
            z:
              (Math.floor(i / PARAMETROS_MUESTRAS.columnas) - 4.5) * PARAMETROS_MUESTRAS.separacion,
            giro: 0,
          }))
        : [{ id: 'muestra', tipo, x: 0, z: 0, giro: 0 }],
    [],
  );
  useEffect(() => {
    if (medir) {
      camera.position.set(29, 38, 42);
      camera.lookAt(0, 0, 0);
    } else {
      const d = Math.max(t.ancho, t.fondo, t.alto) * 2.05;
      const centro = (t.elevacion ?? 0) + t.alto / 2;
      camera.position.set(d * 0.85, centro + d * 0.7, d * 1.2);
      camera.lookAt(0, centro, 0);
    }
    camera.updateMatrixWorld();
  }, [camera]);
  useFrame((_, dt) => {
    if (!medir) return;
    const d = datos.current;
    d.cuadros++;
    if (
      d.cuadros <= PARAMETROS_MUESTRAS.calentamiento ||
      d.tiempos.length >= PARAMETROS_MUESTRAS.muestras
    )
      return;
    d.tiempos.push(dt * 1000);
    d.llamadas = Math.max(d.llamadas, gl.info.render.calls);
    d.triangulos = Math.max(d.triangulos, gl.info.render.triangles);
    if (d.tiempos.length === PARAMETROS_MUESTRAS.muestras) {
      const orden = [...d.tiempos].sort((a, b) => a - b);
      const ctx = gl.getContext();
      const debug = ctx.getExtension('WEBGL_debug_renderer_info');
      window.__catalogoMedicion = {
        fps: 1000 / (d.tiempos.reduce((s, n) => s + n, 0) / d.tiempos.length),
        p95: orden[Math.floor(orden.length * 0.95)]!,
        llamadas: d.llamadas,
        triangulos: d.triangulos,
        objetos: objetos.length,
        gpu: debug ? String(ctx.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'sin dato',
        cuadros: d.tiempos.length,
      };
    }
  });
  return (
    <>
      <color attach="background" args={['#d4d8dc']} />
      <ambientLight intensity={1.8} />
      <directionalLight position={[5, 12, 8]} intensity={3} />
      <directionalLight position={[-5, 5, -3]} intensity={1} />
      <Objetos3D
        objetos={objetos}
        y={0}
        limites={{ x0: -30, x1: 30, z0: -22, z1: 22 }}
        paso={0.5}
        construyendo={false}
        fantasma={null}
        seleccion={null}
        arrastrando={null}
      />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.015, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#d4d8dc" roughness={1} />
      </mesh>
    </>
  );
}
export function Muestras() {
  return (
    <Canvas
      dpr={1}
      camera={{ fov: 35, near: 0.03, far: 200 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <Escena />
    </Canvas>
  );
}
