import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useThree } from '@react-three/fiber';
import { PantallaPresentacion, suspenderControlesCamara, useEscenario } from '@oficina/motor';
import type { Proyector } from '@oficina/motor';
import type { FuenteLiveKit } from '@oficina/presencia';
import type { MutableRefObject } from 'react';
import type { PerspectiveCamera, Vector3 } from 'three';
import type { SesionViva } from '../useEnVivo';
import { colocarPantalla, ajustarPantalla, encuadrarPantalla } from './colocacion';
import { crearPresentacion } from './sincronizacion';
import { crearLienzo } from './lienzo';
import { PanelPresentacion } from './PanelPresentacion';
import { PARAMETROS_PRESENTACION as P } from './protocolo';
import './presentacion.css';

declare global {
  interface Window {
    __d3?: {
      ver: ReturnType<typeof crearPresentacion>['ver'];
      lienzo: HTMLCanvasElement | null;
      texturas: () => number;
      camara: () => number[];
    };
  }
}

interface Props {
  fuente: FuenteLiveKit | null;
  sesion: SesionViva;
  proyector: MutableRefObject<Proyector | null>;
  avatar: { x: number; y: number; z: number };
  activo?: boolean;
}
/** Único punto de montaje dentro del Canvas. La interfaz comparte los tokens del contenedor .cr. */
export function Presentacion({ fuente, sesion, proyector, avatar, activo = true }: Props) {
  const escenario = useEscenario();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as { target: Vector3 } | null;
  const control = useMemo(
    () =>
      crearPresentacion({
        yo: sesion.yo,
        dueno: sesion.dueno,
        invitado: sesion.invitado,
        presentes: () => fuente?.personas().map((p) => p.id) ?? [],
        enviar: (s) => fuente?.enviarDatos(s) ?? Promise.resolve(),
      }),
    [fuente, sesion.yo, sesion.dueno, sesion.invitado],
  );
  const foto = useSyncExternalStore(control.suscribir, control.ver);
  const [lienzo, setLienzo] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState('');
  const [viendo, setViendo] = useState(false);
  const interfaz = useRef<Root | null>(null);
  const pPulsada = useRef(false);
  const anfitrion = !sesion.invitado && sesion.yo === sesion.dueno;
  const lamina = foto.estado.laminas[foto.estado.actual];
  const imagen = lamina ? foto.imagenes.get(lamina.id) : undefined;
  useEffect(() => {
    const desuscribir = fuente?.suscribirDatos(control.recibir);
    const timer = window.setInterval(control.tick, P.envioCadaMs);
    control.tick();
    return () => {
      desuscribir?.();
      clearInterval(timer);
    };
  }, [fuente, control]);
  useEffect(() => {
    let viva = true;
    void crearLienzo(lamina, imagen, foto.estado.actual, foto.estado.laminas.length)
      .then((c) => {
        if (viva) setLienzo(c);
      })
      .catch((e: unknown) => {
        console.warn('[presentacion] no se pudo dibujar la lámina', e);
        if (viva) setError('No se pudo dibujar esta lámina. Prueba con otra imagen.');
      });
    return () => {
      viva = false;
    };
  }, [lamina, imagen, foto.estado.actual, foto.estado.laminas.length]);
  useEffect(() => {
    const contenedor = document.createElement('div');
    contenedor.className = 'd3-raiz';
    gl.domElement.closest('.cr')?.appendChild(contenedor);
    const raiz = createRoot(contenedor);
    interfaz.current = raiz;
    return () => {
      interfaz.current = null;
      queueMicrotask(() => {
        raiz.unmount();
        contenedor.remove();
      });
    };
  }, [gl]);
  const volver = useCallback(() => setViendo(false), []);
  useEffect(() => {
    if (!activo || !foto.estado.pantalla) setViendo(false);
  }, [activo, foto.estado.pantalla]);
  useEffect(() => {
    if (!viendo || !foto.estado.pantalla) return;
    const posicion = camera.position.clone();
    const quaternion = camera.quaternion.clone();
    const objetivo = controls?.target.clone();
    const soltar = suspenderControlesCamara();
    const encuadre = encuadrarPantalla(foto.estado.pantalla, camera.fov, size.width / size.height);
    camera.position.set(encuadre.posicion.x, encuadre.posicion.y, encuadre.posicion.z);
    camera.lookAt(encuadre.objetivo.x, encuadre.objetivo.y, encuadre.objetivo.z);
    controls?.target.set(encuadre.objetivo.x, encuadre.objetivo.y, encuadre.objetivo.z);
    camera.updateMatrixWorld();
    return () => {
      camera.position.copy(posicion);
      camera.quaternion.copy(quaternion);
      if (objetivo) controls?.target.copy(objetivo);
      soltar();
    };
  }, [viendo, foto.estado.pantalla, camera, controls, size.width, size.height]);
  useEffect(() => {
    const bajar = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' && !(e.target as HTMLElement)?.closest('input,textarea'))
        pPulsada.current = true;
    };
    const soltar = () => {
      pPulsada.current = false;
      control.apuntar(0.5, 0.5, false);
    };
    const subir = (e: KeyboardEvent) => {
      if (e.code === 'KeyP') soltar();
    };
    window.addEventListener('keydown', bajar);
    window.addEventListener('keyup', subir);
    window.addEventListener('blur', soltar);
    return () => {
      window.removeEventListener('keydown', bajar);
      window.removeEventListener('keyup', subir);
      window.removeEventListener('blur', soltar);
    };
  }, [control]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__d3 = {
      ver: control.ver,
      lienzo,
      texturas: () => gl.info.memory.textures,
      camara: () => camera.position.toArray(),
    };
    return () => {
      delete window.__d3;
    };
  }, [control, lienzo, gl, camera]);
  const poner = () => {
    const yo = proyector.current?.mundo(sesion.yo) ?? {
      ...avatar,
      rumbo: escenario.entradas[0]?.yaw ?? 0,
    };
    const pantalla = colocarPantalla(escenario, yo);
    if (!pantalla) {
      setError('Aquí no cabe la pantalla. Busca un espacio abierto e inténtalo de nuevo.');
      return;
    }
    control.publicar({ pantalla });
    setError('');
  };
  const mover = (dx: number, dz: number, giro: number) => {
    const previa = foto.estado.pantalla;
    if (!previa) return;
    const pantalla = ajustarPantalla(escenario, {
      ...previa,
      x: previa.x + dx,
      z: previa.z + dz,
      giro: Math.atan2(Math.sin(previa.giro + giro), Math.cos(previa.giro + giro)),
    });
    if (!pantalla) {
      setError('La pantalla no cabe en esa posición.');
      return;
    }
    control.publicar({ pantalla });
    setError('');
  };
  useEffect(() => {
    interfaz.current?.render(
      activo ? (
        <PanelPresentacion
          control={control}
          anfitrion={anfitrion}
          poner={poner}
          mover={mover}
          ver={() => setViendo(true)}
          volver={volver}
          viendo={viendo}
          lienzo={lienzo}
          errorEscena={error}
        />
      ) : null,
    );
  });
  return foto.estado.pantalla ? (
    <PantallaPresentacion
      posicion={foto.estado.pantalla}
      enfocada={viendo}
      lienzo={lienzo}
      laser={foto.laser}
      alVer={() => setViendo(true)}
      alApuntar={(x, y, presionado) => control.apuntar(x, y, presionado || pPulsada.current)}
    />
  ) : null;
}
