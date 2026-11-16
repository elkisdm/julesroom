import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Escenario } from '@oficina/motor';
import { Color, PerspectiveCamera, SRGBColorSpace, WebGLRenderTarget } from 'three';
import type { Scene } from 'three';
import { escenarioPorId, resolverVariante } from '@oficina/motor';
import { BancoMundo } from './BancoMundos';
import { paletaLuz } from '@oficina/motor';
import { encenderLed } from '@oficina/motor';
import { puedeDibujarBanco } from './bancosInactivos';
import { crearColaPrecarga } from './colaPrecarga';
import { cederAlNavegador, prepararBancoPorPartes } from './prepararBanco';
import { PLANTILLAS } from '../plantillas';
import { estadoElegido } from './precargaElegida';
import { varianteActiva } from '../construir/variantes';
import {
  cuadroExploracion,
  cuadroVuelo,
  direccionDeslizamiento,
  giroPorArrastre,
  PARAMETROS_MUNDOS,
} from './mundos';
import type { EstadoPrecarga } from './mundos';

interface Trabajo {
  signal: AbortSignal;
  fondo: boolean;
  id: string;
  variante: string;
  completar: (imagen: string) => void;
  fallar: (error: Error) => void;
}

/** La elegida habilita la llegada; después se anticipan vecinos sin modificar la selección. */
export function usePrecargaMundos(id: string, variante?: string, anticipar = true) {
  const estilo = varianteActiva(escenarioPorId(id), variante);
  const clave = `${id}:${estilo}`;
  const elegida = useRef(clave);
  const primeraPreparacion = useRef(true);
  elegida.current = clave;
  const [estados, setEstados] = useState<Record<string, EstadoPrecarga>>({});
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null);
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});
  const [cola] = useState(() =>
    crearColaPrecarga({
      programar: (tarea, fondo) => {
        // Conserva el camino de entrada: el primer banco no espera un turno adicional.
        if (primeraPreparacion.current) {
          primeraPreparacion.current = false;
          tarea();
          return () => {};
        }
        const control = new AbortController();
        const tiempo = window.setTimeout(
          () => {
            void cederAlNavegador(control.signal).then(tarea, () => {
              // Una nueva elección cancela deliberadamente el turno anterior.
            });
          },
          fondo ? PARAMETROS_MUNDOS.turnoMaximoMs : 0,
        );
        return () => {
          window.clearTimeout(tiempo);
          control.abort();
        };
      },
      preparar: (objetivo, signal) =>
        new Promise<string>((resolve, reject) => {
          const [mundo, estiloMundo] = objetivo.split(':');
          const limpiar = () => {
            window.clearTimeout(tiempo);
            signal.removeEventListener('abort', cancelar);
            setTrabajo((actual) => (actual?.signal === signal ? null : actual));
          };
          const cancelar = () => {
            limpiar();
            reject(signal.reason);
          };
          const fallar = (error: Error) => {
            limpiar();
            reject(error);
          };
          const tiempo = window.setTimeout(
            () => fallar(new Error('La sala tardó demasiado')),
            PARAMETROS_MUNDOS.esperaMaximaMs,
          );
          signal.addEventListener('abort', cancelar, { once: true });
          setTrabajo({
            id: mundo!,
            variante: estiloMundo!,
            signal,
            fondo: objetivo !== elegida.current,
            completar: (imagen) => {
              limpiar();
              resolve(imagen);
            },
            fallar,
          });
        }),
      cambiar: (objetivo, estado, imagen, error) => {
        if (error) console.error('No se pudo preparar la sala', objetivo, error);
        setEstados((x) => ({ ...x, [objetivo]: estado }));
        if (imagen) setMiniaturas((x) => ({ ...x, [objetivo.split(':')[0]!]: imagen }));
      },
    }),
  );
  useEffect(() => {
    const indice = PLANTILLAS.findIndex((p) => p.id === id);
    const vecinas: string[] = [];
    for (let distancia = 1; distancia < PLANTILLAS.length; distancia++) {
      for (const sentido of [1, -1]) {
        const p =
          PLANTILLAS[(indice + distancia * sentido + PLANTILLAS.length) % PLANTILLAS.length]!;
        if (p.id !== id) vecinas.push(`${p.id}:${varianteActiva(escenarioPorId(p.id), variante)}`);
      }
    }
    if (!anticipar) setEstados((x) => (x[clave] ? { [clave]: x[clave] } : {}));
    cola.elegir(clave, vecinas, anticipar);
  }, [clave, id, variante, anticipar, cola]);
  useEffect(() => cola.cancelar, [cola]);
  return { trabajo, estados, miniaturas, ...estadoElegido(estados, clave) };
}

/** Conserva los escenarios y toma el render durante la elección: cambiar no vuelve a montar el dibujo. */
export function EscenaMundos({
  escenario,
  trabajo,
  presentar,
  explorar = presentar,
  vestidor = false,
  variante,
  alNavegar,
  estados,
  alPresentar,
}: {
  escenario: Escenario;
  trabajo: Trabajo | null;
  presentar: boolean;
  explorar?: boolean;
  vestidor?: boolean;
  variante?: string;
  alNavegar: (direccion: number) => void;
  estados: Record<string, EstadoPrecarga>;
  alPresentar: (clave: string) => void;
}) {
  const { gl, scene, camera, size } = useThree();
  const controles = useThree((s) => s.controls) as { enabled: boolean } | null;
  const camara = useRef(
    new PerspectiveCamera(
      PARAMETROS_MUNDOS.fov,
      1,
      PARAMETROS_MUNDOS.cerca,
      PARAMETROS_MUNDOS.lejos,
    ),
  );
  const colorLed = useRef(new Color());
  const luzActiva = useMemo(() => {
    const v = resolverVariante(escenario.variantes, variante).variante;
    return paletaLuz(v?.paleta.hora ?? escenario.ambiente.hora ?? 12);
  }, [escenario, variante]);
  const vuelo = useRef(0);
  const giro = useRef(0);
  const bancos = useRef(new Map<string, Scene>());
  const [preparadas, setPreparadas] = useState<string[]>([]);
  const registrarBanco = useCallback((id: string, escena: Scene) => {
    bancos.current.set(id, escena);
  }, []);
  const [reducir, setReducir] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (trabajo) {
      const clave = `${trabajo.id}:${trabajo.variante}`;
      const montar = () => setPreparadas((ids) => (ids.includes(clave) ? ids : [...ids, clave]));
      if (trabajo.fondo) startTransition(montar);
      else montar();
    }
  }, [trabajo]);
  useEffect(() => {
    if (presentar) return;
    const clave = `${escenario.id}:${varianteActiva(escenario, variante)}`;
    setPreparadas((ids) => ids.filter((id) => id === clave));
    for (const id of bancos.current.keys()) if (id !== clave) bancos.current.delete(id);
  }, [presentar, escenario, variante]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cambiar = () => setReducir(media.matches);
    media.addEventListener('change', cambiar);
    return () => media.removeEventListener('change', cambiar);
  }, []);
  useEffect(() => {
    vuelo.current = 0;
    giro.current = 0;
  }, [escenario.id, presentar, size.width, size.height]);
  useEffect(() => {
    if (!controles || !presentar) return;
    const habilitados = controles.enabled;
    controles.enabled = false;
    return () => {
      controles.enabled = habilitados;
    };
  }, [controles, presentar]);
  useEffect(() => {
    if (!explorar) return;
    const canvas = gl.domElement;
    let inicio: { x: number; y: number; giro: number } | null = null;
    const empezar = (e: PointerEvent) => {
      inicio = { x: e.clientX, y: e.clientY, giro: giro.current };
      canvas.setPointerCapture(e.pointerId);
    };
    const mover = (e: PointerEvent) => {
      if (!inicio || e.pointerType === 'touch') return;
      giro.current = giroPorArrastre(inicio.giro, inicio.x, e.clientX);
    };
    const terminar = (e: PointerEvent) => {
      if (inicio && e.pointerType === 'touch') {
        const direccion = direccionDeslizamiento(inicio.x, e.clientX, e.clientY - inicio.y);
        if (direccion) alNavegar(direccion);
      }
      inicio = null;
    };
    const cancelar = () => {
      inicio = null;
    };
    canvas.addEventListener('pointerdown', empezar);
    canvas.addEventListener('pointermove', mover);
    canvas.addEventListener('pointerup', terminar);
    canvas.addEventListener('pointercancel', cancelar);
    return () => {
      canvas.removeEventListener('pointerdown', empezar);
      canvas.removeEventListener('pointermove', mover);
      canvas.removeEventListener('pointerup', terminar);
      canvas.removeEventListener('pointercancel', cancelar);
    };
  }, [gl, explorar, alNavegar]);
  useFrame((_, dt) => {
    if (!presentar) {
      const fondoVestidor =
        vestidor && bancos.current.get(`${escenario.id}:${variante ?? escenario.variantes[0]?.id}`);
      // Los bancos tienen la sala elegida sin agentes ni asistente; el avatar se compone después.
      gl.render(fondoVestidor || scene, camera);
      return;
    }
    vuelo.current += dt;
    const v = resolverVariante(escenario.variantes, variante).variante;
    const banco = bancos.current.get(`${escenario.id}:${v?.id}`);
    if (!banco || !puedeDibujarBanco(explorar, estados[`${escenario.id}:${v?.id}`])) {
      // Conserva el último cuadro mientras la miniatura comunica la selección pendiente.
      if (!gl.domElement.dataset.mundoCuadro) gl.render(scene, camera);
      return;
    }
    const c = cuadroExploracion(
      cuadroVuelo(
        escenario.vistas,
        size.width,
        size.height,
        vuelo.current / PARAMETROS_MUNDOS.vueloSegundos,
        reducir,
      ),
      giro.current,
    );
    const lente = camara.current;
    lente.aspect = size.width / size.height;
    lente.updateProjectionMatrix();
    lente.position.set(c.posicion.x, c.posicion.y, c.posicion.z);
    lente.lookAt(c.objetivo.x, c.objetivo.y, c.objetivo.z);
    // Luces comparte renderer: la exposición se fija por la variante activa, no por el último portal montado.
    gl.toneMappingExposure = luzActiva.exposicion;
    const color = luzActiva.interior.color;
    encenderLed(
      colorLed.current.setRGB(color.r, color.g, color.b, SRGBColorSpace),
      luzActiva.interior.led,
    );
    gl.render(banco, lente);
    const claveCuadro = `${escenario.id}:${v?.id}`;
    if (gl.domElement.dataset.mundoCuadro !== claveCuadro) {
      gl.domElement.dataset.mundoCuadro = claveCuadro;
      performance.mark(`mundo:cuadro:${claveCuadro}`);
      alPresentar(claveCuadro);
    }
  }, 1);
  useEffect(() => {
    if (!trabajo) return;
    let cancelada = false;
    let cuadro = 0;
    const preparar = async () => {
      try {
        const e = escenarioPorId(trabajo.id);
        const ancho = PARAMETROS_MUNDOS.miniaturaAncho;
        const alto = PARAMETROS_MUNDOS.miniaturaAlto;
        const lente = new PerspectiveCamera(
          PARAMETROS_MUNDOS.fov,
          ancho / alto,
          PARAMETROS_MUNDOS.cerca,
          PARAMETROS_MUNDOS.lejos,
        );
        const c = cuadroVuelo(e.vistas, ancho, alto, 1, true);
        lente.position.set(c.posicion.x, c.posicion.y, c.posicion.z);
        lente.lookAt(c.objetivo.x, c.objetivo.y, c.objetivo.z);
        const v = resolverVariante(e.variantes, trabajo.variante).variante;
        let banco = bancos.current.get(`${e.id}:${v.id}`);
        while (!banco) {
          await cederAlNavegador(trabajo.signal);
          if (cancelada) return;
          banco = bancos.current.get(`${e.id}:${v.id}`);
        }
        if (trabajo.fondo) await prepararBancoPorPartes(gl, banco, lente, trabajo.signal);
        else await gl.compileAsync(banco, lente);
        if (cancelada || trabajo.signal.aborted) return;
        // La miniatura se dibuja fuera de pantalla: nunca sustituye el mundo visible.
        const destino = new WebGLRenderTarget(ancho, alto);
        const anterior = gl.getRenderTarget();
        const exposicion = gl.toneMappingExposure;
        const pixeles = new Uint8Array(ancho * alto * 4);
        try {
          try {
            gl.setRenderTarget(destino);
            gl.toneMappingExposure = paletaLuz(v.paleta.hora).exposicion;
            gl.render(banco, lente);
          } finally {
            gl.setRenderTarget(anterior);
            gl.toneMappingExposure = exposicion;
          }
          await gl.readRenderTargetPixelsAsync(destino, 0, 0, ancho, alto, pixeles);
        } finally {
          destino.dispose();
        }
        if (cancelada || trabajo.signal.aborted) return;
        const lienzo = document.createElement('canvas');
        lienzo.width = ancho;
        lienzo.height = alto;
        const contexto = lienzo.getContext('2d');
        if (!contexto) throw new Error('No se pudo obtener la miniatura');
        const datos = contexto.createImageData(ancho, alto);
        for (let y = 0; y < alto; y++) {
          datos.data.set(
            pixeles.subarray((alto - y - 1) * ancho * 4, (alto - y) * ancho * 4),
            y * ancho * 4,
          );
        }
        contexto.putImageData(datos, 0, 0);
        const imagen = lienzo.toDataURL('image/jpeg');
        if (!cancelada) trabajo.completar(imagen);
      } catch (error) {
        if (!cancelada) trabajo.fallar(error instanceof Error ? error : new Error(String(error)));
      }
    };
    cuadro = requestAnimationFrame(() => {
      cuadro = requestAnimationFrame(() => {
        void preparar();
      });
    });
    return () => {
      cancelada = true;
      cancelAnimationFrame(cuadro);
    };
  }, [trabajo, gl]);
  return (
    <>
      {preparadas.map((clave) => {
        const [id, estilo] = clave.split(':');
        const e = escenarioPorId(id!);
        const v = resolverVariante(e.variantes, estilo).variante;
        return (
          <BancoMundo
            key={clave}
            escenario={e}
            variante={v}
            movimiento={reducir ? 0 : 1}
            activo={
              (presentar || vestidor) &&
              id === escenario.id &&
              estilo === varianteActiva(escenario, variante)
            }
            registrar={registrarBanco}
          />
        );
      })}
    </>
  );
}
