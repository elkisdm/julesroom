import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  CanvasTexture,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Vector3,
} from 'three';
import type { Group } from 'three';
import {
  OPCIONES,
  atuendoPorRol,
  catalogoBase,
  crearCatalogo,
  laboratorio as L,
  resolverAtuendo,
} from '@oficina/motor';
import type { AgenteOficina } from '@oficina/motor';
import { crearOrden, ordenEn, programaPorNombre } from './programa';
import type { Control } from './control';

type Rig = L.Rig;

/** Locomoción de main (66eda60), para la versión «antes». */
const LOCOMOCION_ANTES: L.ParametrosLocomocion = {
  ...L.PARAMETROS_LOCOMOCION,
  velMax: 1.15,
  velCorrer: 1.15,
  aceleracion: 2.2,
  frenado: 3,
  frenadoCorrer: 3,
  giroMax: 6,
  anticipacion: 0.1,
  rapidezGiro: 12,
  anguloGiroCerrado: (60 * Math.PI) / 180,
  fraccionGiroCerrado: 0.12,
};

const AGENTE: AgenteOficina = {
  id: 'caminante',
  nombre: 'Caminante',
  rol: 'Backend',
  departamento: 'ingenieria',
  estado: 'libre',
};

const MAX_HUELLAS = 160;

/** Textura del piso: cuadrícula de 1 m con línea gruesa cada 5 m (para medir a ojo). */
function texturaPiso(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#d9d4c7';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#bdb6a6';
  g.lineWidth = 2;
  for (let i = 0; i <= 5; i++) {
    const p = (i * 512) / 5;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, 512);
    g.moveTo(0, p);
    g.lineTo(512, p);
    g.stroke();
  }
  g.strokeStyle = '#8f8777';
  g.lineWidth = 6;
  g.strokeRect(0, 0, 512, 512);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(40, 40);
  t.anisotropy = 8;
  return t;
}

function Piso() {
  const textura = useMemo(texturaPiso, []);
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial map={textura} roughness={0.95} />
    </mesh>
  );
}

const PIE_LOCAL = new Vector3(0, -0.29, 0.03);

function Muneco({ control, version }: { control: Control; version: 'ahora' | 'antes' }) {
  const rigs = useRef(new Map<string, Rig>());
  const flota = useMemo(() => new L.Flota(), []);
  const estado = useMemo(() => L.crearEstadoCuerpo(AGENTE.id), []);
  const atuendo = useMemo(
    () => resolverAtuendo(crearCatalogo(catalogoBase), atuendoPorRol(AGENTE.rol, 0)),
    [],
  );
  const orden = useMemo(crearOrden, []);
  const reloj = useRef({ t: 0, anterior: -1 });
  const huellas = useMemo(() => {
    const geo = new PlaneGeometry(0.12, 0.22);
    geo.rotateX(-Math.PI / 2);
    const m = new InstancedMesh(
      geo,
      new MeshBasicMaterial({ color: new Color('#3b4a63'), transparent: true, opacity: 0.55 }),
      MAX_HUELLAS,
    );
    m.count = 0;
    m.frustumCulled = false;
    return m;
  }, []);
  const huella = useRef({ siguiente: 0, enSuelo: [true, true] as [boolean, boolean] });
  const camara = useThree((s) => s.camera);
  const seguir = useRef(new Vector3());
  const tmp = useMemo(() => ({ v: new Vector3(), m: new Matrix4(), mira: new Vector3() }), []);

  useEffect(() => {
    flota.fijarSombras(true);
    return () => flota.liberar();
  }, [flota]);

  useFrame((_, delta) => {
    const rig = rigs.current.get(AGENTE.id);
    if (!rig) return;
    const c = control;
    let dt = c.pausa ? 0 : Math.min(delta, 1 / 20) * c.velocidad;
    if (c.pausa && c.cuadros > 0) dt = 1 / 60;
    const l = estado.loc;

    if (c.reiniciar[version]) {
      c.reiniciar[version] = false;
      l.x = 0;
      l.z = 0;
      l.rumbo = 0;
      l.velocidad = 0;
      reloj.current.t = 0;
      reloj.current.anterior = -1;
      huellas.count = 0;
      huella.current.siguiente = 0;
    }

    if (dt > 0) {
      const r = reloj.current;
      r.t += dt;
      if (c.programa === 'manual') {
        orden.dirX = c.teclas.x;
        orden.dirZ = c.teclas.z;
        orden.magnitud = c.teclas.x !== 0 || c.teclas.z !== 0 ? 1 : 0;
        orden.correr = c.teclas.correr;
        orden.saltar = c.teclas.saltar;
      } else {
        const programa = programaPorNombre(c.programa);
        // Al empezar otra vuelta del programa, de vuelta al origen (las vueltas se ven iguales).
        if (
          Math.floor(r.t / programa.duracion) !==
          Math.floor(Math.max(0, r.anterior) / programa.duracion)
        ) {
          l.x = 0;
          l.z = 0;
          l.rumbo = 0;
          l.velocidad = 0;
          seguir.current.set(0, 0, 0);
        }
        ordenEn(programa, r.t, r.anterior, orden);
      }
      r.anterior = r.t;

      const antes = version === 'antes';
      const poses = OPCIONES.caminataPoses;
      if (antes) OPCIONES.caminataPoses = false;
      l.correr = orden.correr;
      if (orden.saltar && !antes) L.pedirSalto(l.salto);
      L.conducir(
        l,
        orden.dirX,
        orden.dirZ,
        orden.magnitud,
        antes ? LOCOMOCION_ANTES : L.PARAMETROS_LOCOMOCION,
        dt,
      );
      rig.raiz.position.set(l.x, 0, l.z);
      L.aplicarCuerpo(rig, estado, r.t, dt);
      OPCIONES.caminataPoses = poses;
    }
    rig.raiz.updateMatrixWorld(true);

    // Huellas: donde un pie vuelve a tocar el suelo.
    const h = huella.current;
    for (let k = 0; k < 2; k++) {
      tmp.v.copy(PIE_LOCAL).applyMatrix4(rig.piernas[k as 0 | 1].rodilla.matrixWorld);
      const suelo = tmp.v.y < 0.025;
      if (suelo && !h.enSuelo[k]) {
        tmp.m.makeRotationY(l.rumbo);
        tmp.m.setPosition(tmp.v.x, 0.004, tmp.v.z);
        huellas.setMatrixAt(h.siguiente % MAX_HUELLAS, tmp.m);
        h.siguiente++;
        huellas.count = Math.min(MAX_HUELLAS, h.siguiente);
        huellas.instanceMatrix.needsUpdate = true;
      }
      h.enSuelo[k] = suelo;
    }
    huellas.visible = c.huellas;

    // Lecturas para el panel.
    if (version === 'ahora' || c.vista === 'antes') {
      const cabeza = tmp.mira.setFromMatrixPosition(rig.cabeza.matrixWorld);
      c.lectura.alto = cabeza.y + 0.24;
      c.lectura.velocidad = l.velocidad;
      c.lectura.fase = l.fase;
      c.lectura.salto = l.salto.fase;
    }

    // Dibujo con la flota real (mismas piezas y materiales que en la oficina).
    flota.inicio();
    for (const parte of rig.partes) {
      if (!parte.ancla.visible || parte.cartel) continue;
      flota.agregar(
        parte.geometria,
        parte.estilo.familia,
        parte.ancla.matrixWorld,
        parte.estilo.color,
        parte.celda,
      );
    }
    flota.fin();

    // Cámara que sigue al personaje.
    const s = seguir.current;
    const k = dt > 0 ? 1 - Math.exp(-dt * 14) : 0;
    s.x += (l.x - s.x) * (c.camara === 'fija' ? 0 : k);
    s.z += (l.z - s.z) * (c.camara === 'fija' ? 0 : k);
    const objetivoY = 0.85;
    switch (c.camara) {
      case 'lateral':
        camara.position.set(s.x + 6, 1.1, s.z);
        break;
      case 'frontal':
        camara.position.set(s.x, 1.3, s.z + 6.5);
        break;
      case 'atras': // tercera persona desde atrás y arriba, como la referencia de Roblox
        camara.position.set(s.x, 2.7, s.z - 5.2);
        break;
      case 'cerca':
        camara.position.set(s.x + 2.4, 1.6, s.z + 2.4);
        break;
      case 'fija':
        camara.position.set(7, 4, 0);
        break;
      default: // juego: elevada en tres cuartos, como la oficina
        camara.position.set(s.x + 6.5, 8.5, s.z + 6.5);
    }
    camara.lookAt(
      s.x,
      c.camara === 'juego' ? 0.6 : objetivoY,
      s.z + (c.camara === 'atras' ? 1.5 : 0),
    );
    if (c.pausa && c.cuadros > 0) c.cuadros--;
  });

  const sombra = useRef<Group>(null);
  return (
    <>
      <group ref={sombra}>
        <L.Persona
          agente={AGENTE}
          atuendo={atuendo}
          seleccionado={false}
          rigs={rigs}
          onSeleccionar={() => undefined}
          humano
        />
      </group>
      <primitive object={flota.raiz} dispose={null} />
      <primitive object={huellas} dispose={null} />
    </>
  );
}

export function Escena({ control, version }: { control: Control; version: 'ahora' | 'antes' }) {
  const paleta = useMemo(() => L.paletaLuz(14), []);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 35, near: 0.1, far: 300, position: [6, 1.1, 0] }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#cfd8e3']} />
      <L.Luces paleta={paleta} sombras />
      <Piso />
      <Muneco control={control} version={version} />
    </Canvas>
  );
}
