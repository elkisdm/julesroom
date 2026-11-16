import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import {
  AmbientLight,
  DirectionalLight,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import {
  catalogoBase,
  crearCatalogo,
  laboratorio as L,
  resolverAtuendo,
  aplicarConjunto,
} from '@oficina/motor';
import type { Atuendo } from '@oficina/motor';
import { ajusteIdle, ajusteNeutro } from '@oficina/motor';
import { encuadreVestidor, PARAMETROS_VESTIDOR as P } from './encuadreVestidor';
import { encuadreMiniatura } from './encuadreMiniaturas';
import { dibujarVestidor } from './composicionVestidor';
import { tomarCamara } from './controlCamaraVestidor';
import { useReduceMotion } from '@oficina/motor';
import type { Categoria } from './estadoPersonaje';
import { claveMiniatura, claveConjunto } from './cacheMiniaturas';
import { vestirFundador } from './fundador';
import { categorias, seleccionar } from './estadoPersonaje';

export interface ControlVestidor {
  categoria: number;
  giro: number;
  arrastrando: boolean;
  miniaturas: Record<string, string>;
  fundadorDesbloqueado?: boolean;
  conjuntos?: string[];
  cabeza?: { x: number; y: number; z: number };
}
const catalogo = crearCatalogo(catalogoBase);
const agente = { id: 'vestidor', nombre: '', rol: '', departamento: '', estado: 'libre' as const };
const MINIATURA = {
  lado: 128,
  espera: 3,
  luz: 2.4,
  direccion: 3,
  posicion: [2, 3, 4] as const,
  plano: 0.7,
  cercano: 0.1,
  lejano: 20,
  distancia: 5,
};

/** Dibuja exactamente el modelo del motor, con su idle y sus gestos existentes. */
function Modelo({
  atuendo,
  control,
  posicion,
  miniatura = false,
}: {
  atuendo: Atuendo;
  control?: MutableRefObject<ControlVestidor>;
  posicion: { x: number; y: number; z: number };
  miniatura?: boolean;
}) {
  const rigs = useRef(new Map<string, L.Rig>());
  const [recursos] = useState(() => ({
    flota: new L.Flota(),
    cuerpo: L.crearEstadoCuerpo(agente.id),
    ajuste: ajusteNeutro(),
    cabeza: new Vector3(),
  }));
  const cambio = useRef({ clave: JSON.stringify(atuendo), inicio: -Infinity });
  const reducido = useReduceMotion();
  useEffect(() => () => recursos.flota.liberar(), [recursos]);
  useFrame(({ clock }, dt) => {
    const rig = rigs.current.get(agente.id);
    if (!rig) return;
    const t = clock.elapsedTime;
    const clave = JSON.stringify(atuendo);
    if (clave !== cambio.current.clave) cambio.current = { clave, inicio: t };
    if (control && !control.current.arrastrando)
      control.current.giro *= reducido ? 0 : Math.exp(-dt * P.retorno);
    const { cuerpo, ajuste, flota } = recursos;
    cuerpo.loc.rumbo = control?.current.giro ?? 0;
    cuerpo.estiloCara = atuendo.face;
    cuerpo.objetivoYaw = -(control?.current.giro ?? 0);
    rig.raiz.position.set(posicion.x, posicion.y, posicion.z);
    L.aplicarCuerpo(rig, cuerpo, miniatura || reducido ? 0 : t, miniatura || reducido ? 0 : dt);
    if (!miniatura && !reducido) {
      ajusteIdle(
        { variante: 'asentir', duracion: P.duracionGesto, fase: 0 },
        (t - cambio.current.inicio) / P.duracionGesto,
        t,
        ajuste,
      );
      rig.cabeza.rotation.x -= ajuste.cabezaPitch;
    }
    rig.raiz.updateMatrixWorld(true);
    if (control) {
      rig.cabeza.getWorldPosition(recursos.cabeza);
      control.current.cabeza = recursos.cabeza;
    }
    flota.inicio();
    for (const parte of rig.partes)
      if (parte.ancla.visible) {
        flota.agregar(
          parte.geometria,
          parte.estilo.familia,
          parte.ancla.matrixWorld,
          parte.estilo.color,
          parte.celda,
        );
      }
    flota.fin();
  });
  return (
    <>
      <L.Persona
        agente={agente}
        atuendo={resolverAtuendo(catalogo, atuendo)}
        seleccionado={false}
        rigs={rigs}
        onSeleccionar={() => undefined}
        humano
      />
      <primitive object={recursos.flota.raiz} dispose={null} />
    </>
  );
}

/** Miniatura rasterizada desde las mismas piezas 3D, usando el contexto WebGL existente. */
function Miniatura3D({
  atuendo,
  clave,
  busto,
  campo,
  control,
  alTerminar,
}: {
  atuendo: Atuendo;
  clave: string;
  busto: boolean;
  campo: Categoria['id'];
  alTerminar: () => void;
  control: MutableRefObject<ControlVestidor>;
}) {
  const [recursos] = useState(() => {
    const escena = new Scene();
    escena.add(new AmbientLight('#ffffff', MINIATURA.luz));
    const luz = new DirectionalLight('#ffffff', MINIATURA.direccion);
    luz.position.set(...MINIATURA.posicion);
    escena.add(luz);
    const camara = new OrthographicCamera(
      -MINIATURA.plano,
      MINIATURA.plano,
      MINIATURA.plano,
      -MINIATURA.plano,
      MINIATURA.cercano,
      MINIATURA.lejano,
    );
    return {
      escena,
      camara,
      target: new WebGLRenderTarget(MINIATURA.lado, MINIATURA.lado, { colorSpace: SRGBColorSpace }),
      pixels: new Uint8Array(MINIATURA.lado ** 2 * 4),
    };
  });
  const cuadros = useRef(0);
  useEffect(() => {
    cuadros.current = 0;
  }, [clave]);
  useEffect(() => () => recursos.target.dispose(), [recursos]);
  useFrame(({ gl }) => {
    if (++cuadros.current !== MINIATURA.espera) return;
    const { escena, camara, target, pixels } = recursos;
    const { altura, escala } = encuadreMiniatura(campo, busto);
    camara.left = camara.bottom = -escala;
    camara.right = camara.top = escala;
    camara.position.set(0, altura, MINIATURA.distancia);
    camara.lookAt(0, altura, 0);
    camara.updateProjectionMatrix();
    const previo = gl.getRenderTarget();
    const alfa = gl.getClearAlpha();
    gl.setRenderTarget(target);
    gl.setClearAlpha(0);
    gl.clear();
    gl.render(escena, camara);
    gl.readRenderTargetPixels(target, 0, 0, MINIATURA.lado, MINIATURA.lado, pixels);
    gl.setRenderTarget(previo);
    gl.setClearAlpha(alfa);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = MINIATURA.lado;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const datos = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++)
      datos.data.set(
        pixels.subarray(y * canvas.width * 4, (y + 1) * canvas.width * 4),
        (canvas.height - y - 1) * canvas.width * 4,
      );
    ctx.putImageData(datos, 0, 0);
    control.current.miniaturas[clave] = canvas.toDataURL();
    alTerminar();
  });
  return createPortal(
    <Modelo atuendo={atuendo} posicion={{ x: 0, y: 0, z: 0 }} miniatura />,
    recursos.escena,
  );
}

export function Vestidor3D({
  atuendo,
  control,
  posicion,
}: {
  atuendo: Atuendo;
  control: MutableRefObject<ControlVestidor>;
  posicion: { x: number; y: number; z: number };
}) {
  const { camera, controls } = useThree();
  const [escena] = useState(() => new Scene());
  const [velo] = useState(() => new Scene());
  useFrame(({ gl }) => dibujarVestidor(gl, escena, camera, velo), P.prioridadComposicion);
  const reducido = useReduceMotion();
  const [recursos] = useState(() => ({
    objetivo: new Vector3(),
    posicion: new Vector3(),
    iniciado: false,
  }));
  const [categoria, setCategoria] = useState(control.current.categoria);
  const [pedidos, setPedidos] = useState<string[]>([]);
  const [, actualizarCola] = useState(0);
  useEffect(() => {
    const orbita = controls as unknown as { enabled: boolean } | null;
    return tomarCamara(camera, orbita);
  }, [controls, camera]);
  useFrame(({ size }, dt) => {
    const solicitados = control.current.conjuntos ?? [];
    if (solicitados.join('|') !== pedidos.join('|')) setPedidos([...solicitados]);
    const cat = categorias[control.current.categoria]!;
    if (categoria !== control.current.categoria) setCategoria(control.current.categoria);
    const e = encuadreVestidor(size.width, size.height, posicion, !!cat.busto);
    const k = !recursos.iniciado || reducido ? 1 : 1 - Math.exp(-dt * P.suavizado);
    recursos.iniciado = true;
    recursos.posicion.x += (e.posicion.x - recursos.posicion.x) * k;
    recursos.posicion.y += (e.posicion.y - recursos.posicion.y) * k;
    recursos.posicion.z += (e.posicion.z - recursos.posicion.z) * k;
    recursos.objetivo.x += (e.objetivo.x - recursos.objetivo.x) * k;
    recursos.objetivo.y += (e.objetivo.y - recursos.objetivo.y) * k;
    recursos.objetivo.z += (e.objetivo.z - recursos.objetivo.z) * k;
    camera.position.copy(recursos.posicion);
    camera.lookAt(recursos.objetivo);
    camera.updateMatrixWorld();
  });
  const cat = categorias[categoria]!;
  const cola = [
    ...pedidos.map((id) => ({
      clave: claveConjunto(id, atuendo),
      atuendo: aplicarConjunto(atuendo, id),
      campo: 'acc' as const,
      busto: false,
    })),
    ...(control.current.fundadorDesbloqueado
      ? [
          {
            clave: `fundador:${JSON.stringify(atuendo)}`,
            atuendo: vestirFundador(atuendo),
            campo: 'acc' as const,
            busto: false,
          },
        ]
      : []),
    ...(cat.color
      ? []
      : cat.opciones.map((o) => ({
          clave: claveMiniatura(cat, o.id, atuendo),
          atuendo: seleccionar(cat.id === 'acc' ? { ...atuendo, acc: [] } : atuendo, cat, o.id),
          campo: cat.id,
          busto: !!cat.busto,
        }))),
  ];
  const pendiente = cola.find((p) => !control.current.miniaturas[p.clave]);
  return (
    <>
      {createPortal(
        <mesh position={[posicion.x, posicion.y, posicion.z - P.fondoDistancia]}>
          <planeGeometry args={[P.fondoLado, P.fondoLado]} />
          <meshBasicMaterial
            color={P.fondoColor}
            transparent
            opacity={P.fondoOpacidad}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>,
        velo,
      )}
      {createPortal(
        <>
          <Modelo atuendo={atuendo} posicion={posicion} control={control} />
          <ambientLight intensity={P.luzAmbiente} />
          <pointLight
            position={[posicion.x, posicion.y + P.luzAltura, posicion.z + P.luzAltura]}
            intensity={P.luzIntensidad}
            distance={P.luzDistancia}
          />
          {pendiente && (
            <Miniatura3D
              key={pendiente.clave}
              {...pendiente}
              control={control}
              alTerminar={() => actualizarCola((n) => n + 1)}
            />
          )}
        </>,
        escena,
      )}
    </>
  );
}
