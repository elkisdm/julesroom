/**
 * Lo que la persona coloca en su sala, dibujado dentro de la escena (`<Oficina>{children}`): los
 * objetos, y en modo construir la rejilla, el fantasma del objeto en mano y el marco de lo elegido.
 * Recibe el puntero sobre el piso por un plano invisible a la altura del nivel.
 */
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  type InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from 'three';
import type { Camera, Object3D } from 'three';
import { huella, radianes, suspenderControlesCamara, tipoObjeto } from '@oficina/motor';
import type { EstadoColocacion, Giro, ObjetoColocado } from '@oficina/motor';

import { claveInstancia, piezaDe, type ObjetoDibujo, type Parte } from './piezas';
import { matrizDeParte } from './matrizParte';
import { ndcSobreElDedo } from './interaccionMobiliario';
import { PARAMETROS_CONSTRUIR } from './parametrosConstruir';
import {
  crearAgarre,
  destinoDeAgarre,
  superaUmbral,
  type Agarre,
  type Rayo,
} from './gestoArrastre';

type Caja = { x0: number; x1: number; z0: number; z1: number };

const raycaster = new Raycaster();
const planoSuelo = new Plane(new Vector3(0, 1, 0), 0);
const impacto = new Vector3();
const ndc = new Vector2();

function ndcDe(ev: PointerEvent, dom: HTMLElement, desplazamientoPx: number) {
  const n = ndcSobreElDedo(ev.clientX, ev.clientY, dom.getBoundingClientRect(), desplazamientoPx);
  ndc.set(n.x, n.y);
}

/** Punto del piso bajo el puntero. Con desplazamiento, un trecho sobre el dedo para que no tape el objeto. */
function puntoEnPiso(
  ev: PointerEvent,
  y: number,
  camera: Camera,
  dom: HTMLElement,
  desplazar: boolean,
): { x: number; z: number } | null {
  ndcDe(ev, dom, desplazar ? PARAMETROS_CONSTRUIR.desplazamientoDedoPx : 0);
  raycaster.setFromCamera(ndc, camera);
  planoSuelo.constant = -y;
  return raycaster.ray.intersectPlane(planoSuelo, impacto);
}

function rayoDe(ev: PointerEvent, camera: Camera, dom: HTMLElement): Rayo {
  ndcDe(ev, dom, 0);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin;
  const d = raycaster.ray.direction;
  return { ox: o.x, oy: o.y, oz: o.z, dx: d.x, dy: d.y, dz: d.z };
}

/**
 * El primer impacto del rayo. Si es un objeto colocado, trae su id (las instancias
 * guardan la lista en `userData.ids`). Si no, el punto sirve para un mueble de la plantilla.
 */
function primerImpacto(
  ev: PointerEvent,
  camera: Camera,
  dom: HTMLElement,
  escena: Object3D,
): {
  colocado: { id: string; x: number; y: number; z: number } | null;
  punto: { x: number; y: number; z: number } | null;
} {
  ndcDe(ev, dom, 0);
  raycaster.setFromCamera(ndc, camera);
  const golpe = raycaster.intersectObject(escena, true)[0];
  if (!golpe) return { colocado: null, punto: null };
  const punto = { x: golpe.point.x, y: golpe.point.y, z: golpe.point.z };
  let nodo: Object3D | null = golpe.object;
  while (nodo) {
    const ids = nodo.userData.ids as readonly string[] | undefined;
    if (nodo.userData.colocable && ids && golpe.instanceId != null) {
      const id = ids[golpe.instanceId];
      if (id) return { colocado: { id, ...punto }, punto };
      break;
    }
    nodo = nodo.parent;
  }
  return { colocado: null, punto };
}

export const COLOR_ESTADO: Record<EstadoColocacion, string> = {
  libre: '#7fd88f',
  bloquea: '#ffb347',
  choca: '#ff6b5e',
  fuera: '#ff6b5e',
};

export interface Fantasma {
  tipo: string;
  x: number;
  z: number;
  giro: Giro;
  estado: EstadoColocacion;
  /** Por qué no cabe o qué estorba; `null` si cabe sin problema. */
  motivo?: string | null;
  /** Huella ya calculada (un mueble de la plantilla no está en el catálogo). */
  caja?: Caja;
}

interface Props {
  objetos: readonly ObjetoColocado[];
  /** Altura del piso del nivel donde se construye. */
  y: number;
  limites: Caja;
  paso: number;
  construyendo: boolean;
  fantasma: Fantasma | null;
  seleccion: string | null;
  /** Objeto que se está arrastrando: se dibuja como fantasma, no en su sitio. */
  arrastrando: string | null;
  alPuntero?: (x: number, z: number, presionado: boolean) => void;
  alSoltar?: (x: number, z: number) => void;
  alBajarSobre?: (id: string, x: number, z: number) => void;
  /**
   * Clic en el piso. Si hay un mueble movible, devuelve su origen para agarrarlo
   * por el punto presionado; si no, `null` y la cámara puede orbitar.
   */
  alBajarPiso?: (x: number, z: number) => { x: number; z: number } | null;
  /** Hay un arrastre que no es un objeto del catálogo: el suelo igual debe soltar. */
  arrastreActivo?: boolean;
  /** Marco de un mueble de la plantilla elegido. */
  huellaMarca?: Caja | null;
}

/** Geometrías unitarias compartidas (se escalan por instancia). */
const UNIT_CAJA = new BoxGeometry(1, 1, 1);
const UNIT_CIL = new CylinderGeometry(0.5, 0.5, 1, 14);
const UNIT_ESFERA = new IcosahedronGeometry(0.5, 1);

function geomUnitaria(f: Parte['f']): BufferGeometry {
  if (f === 'caja') return UNIT_CAJA;
  if (f === 'cil') return UNIT_CIL;
  return UNIT_ESFERA;
}

const materiales = new Map<string, MeshStandardMaterial>();

function materialDe(p: Parte, fantasma?: boolean): MeshStandardMaterial {
  const clave = claveInstancia(p, Boolean(fantasma));
  const previo = materiales.get(clave);
  if (previo) return previo;
  const m = new MeshStandardMaterial({
    color: p.color,
    roughness: 0.85,
    transparent: Boolean(fantasma) || p.opacidad !== undefined,
    opacity: fantasma ? 0.55 : (p.opacidad ?? 1),
    depthWrite: !fantasma && p.opacidad === undefined,
    emissive: fantasma ? '#000000' : p.brillo ? p.color : '#000000',
    emissiveIntensity: fantasma ? 0 : p.brillo ? 0.6 : 0,
  });
  materiales.set(clave, m);
  return m;
}

interface Instancia {
  id: string;
  tipo: string;
  parteIdx: number;
}

interface Lote {
  clave: string;
  forma: Parte['f'];
  material: MeshStandardMaterial;
  lista: Instancia[];
}

const matrizFinal = new Matrix4();
function agruparLotes(objetos: readonly ObjetoDibujo[], excluir: string | null): Lote[] {
  const mapa = new Map<string, Lote>();
  for (const o of objetos) {
    if (o.id === excluir) continue;
    const partes = piezaDe(o.tipo);
    partes.forEach((p, parteIdx) => {
      const clave = claveInstancia(p, false);
      let lote = mapa.get(clave);
      if (!lote) {
        lote = { clave, forma: p.f, material: materialDe(p), lista: [] };
        mapa.set(clave, lote);
      }
      lote.lista.push({ id: o.id, tipo: o.tipo, parteIdx });
    });
  }
  return [...mapa.values()];
}

function ParteMalla({
  p,
  ancho,
  fondo,
  alto,
  fantasma,
}: {
  p: Parte;
  ancho: number;
  fondo: number;
  alto: number;
  fantasma?: boolean;
}) {
  const [cx, cy, cz] = p.c;
  const [sx, sy, sz] = p.s;
  const pos: [number, number, number] = [cx * ancho, cy * alto, cz * fondo];
  const material = fantasma ? (
    <meshStandardMaterial color={p.color} transparent opacity={0.55} depthWrite={false} />
  ) : (
    <meshStandardMaterial
      color={p.color}
      roughness={0.85}
      emissive={p.brillo ? p.color : '#000000'}
      emissiveIntensity={p.brillo ? 0.6 : 0}
    />
  );
  if (p.f === 'caja')
    return (
      <mesh position={pos} castShadow={!fantasma} receiveShadow={!fantasma}>
        <boxGeometry args={[sx * ancho, sy * alto, sz * fondo]} />
        {material}
      </mesh>
    );
  if (p.f === 'cil')
    return (
      <mesh position={pos} scale={[sx * ancho, sy * alto, sz * fondo]} castShadow={!fantasma}>
        <cylinderGeometry args={[0.5, 0.5, 1, 14]} />
        {material}
      </mesh>
    );
  return (
    <mesh position={pos} scale={[sx * ancho, sy * alto, sz * fondo]} castShadow={!fantasma}>
      <icosahedronGeometry args={[0.5, 1]} />
      {material}
    </mesh>
  );
}

const ObjetoFantasma = memo(function ObjetoFantasma({
  o,
  y,
}: {
  o: { tipo: string; x: number; z: number; giro: Giro };
  y: number;
}) {
  const t = tipoObjeto(o.tipo);
  if (!t) return null;
  const base = t.elevacion ?? (o.tipo === 'cuadro' ? 1.3 : 0);
  return (
    <group position={[o.x, y + base, o.z]} rotation={[0, radianes(o.giro), 0]}>
      {piezaDe(o.tipo).map((p, i) => (
        <ParteMalla key={i} p={p} ancho={t.ancho} fondo={t.fondo} alto={t.alto} fantasma />
      ))}
    </group>
  );
});

const LoteInstanciado = memo(function LoteInstanciado({
  lote,
  objetos,
  y,
}: {
  lote: Lote;
  objetos: readonly ObjetoDibujo[];
  y: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const capacidad = Math.max(lote.lista.length, 1);
  const geometria = useMemo(() => geomUnitaria(lote.forma), [lote.forma]);
  const idsPorIndice = useMemo(() => lote.lista.map((i) => i.id), [lote.lista]);

  const porId = useMemo(() => new Map(objetos.map((o) => [o.id, o])), [objetos]);

  useLayoutEffect(() => {
    const malla = ref.current;
    if (!malla) return;
    const n = lote.lista.length;
    for (let i = 0; i < n; i++) {
      const inst = lote.lista[i]!;
      const obj = porId.get(inst.id);
      if (!obj) continue;
      const parte = piezaDe(obj.tipo)[inst.parteIdx];
      if (!parte) continue;
      matrizDeParte(obj, y, parte, matrizFinal);
      malla.setMatrixAt(i, matrizFinal);
    }
    malla.count = n;
    malla.instanceMatrix.needsUpdate = true;
    // El raycast y el descarte de frustum deben usar las posiciones nuevas.
    malla.computeBoundingSphere();
  }, [lote.lista, porId, y]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometria, lote.material, capacidad]}
      castShadow
      receiveShadow
      userData={{ colocable: true, ids: idsPorIndice }}
    />
  );
});

/** Rectángulo de la huella sobre el piso (fantasma y selección). */
function Huella({ caja, y, color }: { caja: Caja; y: number; color: string }) {
  const ancho = caja.x1 - caja.x0;
  const fondo = caja.z1 - caja.z0;
  return (
    <mesh
      position={[(caja.x0 + caja.x1) / 2, y + 0.015, (caja.z0 + caja.z1) / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[ancho, fondo]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
    </mesh>
  );
}

function Rejilla({ limites, paso, y }: { limites: Caja; paso: number; y: number }) {
  const geometria = useMemo(() => {
    const v: number[] = [];
    const yy = y + 0.012;
    for (let x = Math.ceil(limites.x0 / paso) * paso; x <= limites.x1; x += paso)
      v.push(x, yy, limites.z0, x, yy, limites.z1);
    for (let z = Math.ceil(limites.z0 / paso) * paso; z <= limites.z1; z += paso)
      v.push(limites.x0, yy, z, limites.x1, yy, z);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(v, 3));
    return g;
  }, [limites, paso, y]);
  return (
    <lineSegments geometry={geometria} raycast={() => null}>
      <lineBasicMaterial color="#f4efe6" transparent opacity={0.16} depthWrite={false} />
    </lineSegments>
  );
}

interface GestoPuntero {
  pointerId: number;
  origenPx: { x: number; y: number };
  agarre: Agarre | null;
  movio: boolean;
  ultimo: { x: number; z: number } | null;
  soltarCamara: () => void;
}

export function Objetos3D({
  objetos,
  y,
  limites,
  paso,
  construyendo,
  fantasma,
  seleccion,
  arrastrando,
  alPuntero,
  alSoltar,
  alBajarSobre,
  alBajarPiso,
  arrastreActivo = false,
  huellaMarca,
}: Props) {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const escena = useThree((s) => s.scene);
  const vivo = useRef({
    alPuntero,
    alSoltar,
    alBajarSobre,
    alBajarPiso,
    fantasma,
    arrastrando,
    arrastreActivo,
    y,
    paso,
    objetos,
    umbralPx: PARAMETROS_CONSTRUIR.umbralArrastrePx,
  });
  vivo.current = {
    alPuntero,
    alSoltar,
    alBajarSobre,
    alBajarPiso,
    fantasma,
    arrastrando,
    arrastreActivo,
    y,
    paso,
    objetos,
    umbralPx: PARAMETROS_CONSTRUIR.umbralArrastrePx,
  };
  const elegido = objetos.find((o) => o.id === seleccion);
  const ancho = limites.x1 - limites.x0;
  const fondo = limites.z1 - limites.z0;
  const cajaFantasma = fantasma
    ? (fantasma.caja ?? (tipoObjeto(fantasma.tipo) ? huella(fantasma) : null))
    : null;

  // Captura: la suspensión ocurre antes de que OrbitControls vea el pointerdown.
  // El move y el up van en la ventana para que soltar fuera del lienzo cierre el gesto.
  useEffect(() => {
    if (!construyendo) return;
    let gesto: GestoPuntero | null = null;
    const dedos = new Set<number>();
    let presionLibre: { id: number; x: number; y: number } | null = null;

    const piso = (e: PointerEvent, desplazar: boolean) =>
      puntoEnPiso(e, vivo.current.y, camera, dom, desplazar && e.pointerType === 'touch');

    const reclamar = (e: PointerEvent, agarre: Agarre | null) => {
      const soltarCamara = suspenderControlesCamara();
      gesto = {
        pointerId: e.pointerId,
        origenPx: { x: e.clientX, y: e.clientY },
        agarre,
        movio: false,
        ultimo: null,
        soltarCamara,
      };
      presionLibre = null;
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        // Sin captura igual oímos el pointerup en la ventana.
      }
    };

    const soltarCaptura = (id: number) => {
      if (dom.hasPointerCapture(id)) dom.releasePointerCapture(id);
    };

    const terminar = (id: number | null, clic: boolean, evento: PointerEvent | null) => {
      if (!gesto) return;
      if (id !== null && id !== gesto.pointerId) return;
      const g = gesto;
      gesto = null;
      g.soltarCamara();
      soltarCaptura(id ?? g.pointerId);
      const v = vivo.current;
      if (g.agarre) {
        if (g.movio && g.ultimo) v.alSoltar?.(g.ultimo.x, g.ultimo.z);
        return;
      }
      if (!clic || !evento) return;
      const p = piso(evento, evento.pointerType === 'touch') ?? g.ultimo;
      if (p) v.alSoltar?.(p.x, p.z);
    };

    const bajar = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' && e.button !== 0) return;
      const previos = dedos.size;
      dedos.add(e.pointerId);
      if (gesto || previos >= 1) return;
      const v = vivo.current;
      const colocar = Boolean(v.fantasma) && !v.arrastreActivo && !v.arrastrando;
      if (colocar) {
        reclamar(e, null);
        if (e.pointerType === 'touch') {
          const arriba = piso(e, true);
          if (arriba) v.alPuntero?.(arriba.x, arriba.z, false);
        }
        return;
      }
      const hit = primerImpacto(e, camera, dom, escena);
      if (hit.colocado) {
        const obj = v.objetos.find((o) => o.id === hit.colocado!.id);
        if (obj) {
          v.alBajarSobre?.(obj.id, hit.colocado.x, hit.colocado.z);
          reclamar(e, crearAgarre(obj, hit.colocado));
          return;
        }
      }
      const suelo = piso(e, false);
      const candidatos = [hit.punto, suelo ? { x: suelo.x, y: v.y, z: suelo.z } : null].filter(
        (p): p is { x: number; y: number; z: number } => p !== null,
      );
      for (const punto of candidatos) {
        const origen = v.alBajarPiso?.(punto.x, punto.z) ?? null;
        if (!origen) continue;
        reclamar(e, crearAgarre(origen, punto));
        return;
      }
      presionLibre = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };

    const mover = (e: PointerEvent) => {
      const v = vivo.current;
      if (gesto && e.pointerId !== gesto.pointerId) return;
      const enLienzo = e.target === dom || (e.target instanceof Node && dom.contains(e.target));
      if (!gesto && !enLienzo) return;
      if (gesto?.agarre) {
        if (
          !gesto.movio &&
          !superaUmbral(gesto.origenPx, { x: e.clientX, y: e.clientY }, v.umbralPx)
        )
          return;
        const destino = destinoDeAgarre(rayoDe(e, camera, dom), gesto.agarre, v.paso);
        if (!destino) return;
        gesto.movio = true;
        gesto.ultimo = destino;
        v.alPuntero?.(destino.x, destino.z, true);
        return;
      }
      const p = piso(e, e.pointerType === 'touch' && (Boolean(v.fantasma) || gesto !== null));
      if (!p) return;
      if (gesto) gesto.ultimo = p;
      v.alPuntero?.(p.x, p.z, gesto !== null || (e.buttons & 1) === 1);
    };

    const subir = (e: PointerEvent) => {
      dedos.delete(e.pointerId);
      if (gesto) {
        if (e.pointerId !== gesto.pointerId) return;
        const clic =
          e.type === 'pointerup' &&
          !superaUmbral(gesto.origenPx, { x: e.clientX, y: e.clientY }, vivo.current.umbralPx);
        terminar(e.pointerId, clic, e);
        return;
      }
      const inicio = presionLibre;
      presionLibre = null;
      if (!inicio || inicio.id !== e.pointerId) return;
      if (e.pointerType !== 'touch' && e.button !== 0) return;
      if (superaUmbral(inicio, { x: e.clientX, y: e.clientY }, vivo.current.umbralPx)) return;
      const enLienzo = e.target === dom || (e.target instanceof Node && dom.contains(e.target));
      if (!enLienzo) return;
      const p = piso(e, false);
      if (p) vivo.current.alSoltar?.(p.x, p.z);
    };

    const alBlur = () => {
      dedos.clear();
      presionLibre = null;
      if (!gesto) return;
      terminar(null, false, null);
    };

    dom.addEventListener('pointerdown', bajar, true);
    window.addEventListener('pointermove', mover, true);
    window.addEventListener('pointerup', subir, true);
    window.addEventListener('pointercancel', subir, true);
    window.addEventListener('blur', alBlur);
    return () => {
      gesto?.soltarCamara();
      gesto = null;
      dom.removeEventListener('pointerdown', bajar, true);
      window.removeEventListener('pointermove', mover, true);
      window.removeEventListener('pointerup', subir, true);
      window.removeEventListener('pointercancel', subir, true);
      window.removeEventListener('blur', alBlur);
    };
  }, [construyendo, camera, dom, escena]);
  const dibujo: ObjetoDibujo[] = useMemo(
    () => objetos.map((o) => ({ id: o.id, tipo: o.tipo, x: o.x, z: o.z, giro: o.giro })),
    [objetos],
  );
  const lotes = useMemo(() => agruparLotes(dibujo, arrastrando), [dibujo, arrastrando]);

  return (
    <group>
      {lotes.map((lote) => (
        <LoteInstanciado key={lote.clave} lote={lote} objetos={dibujo} y={y} />
      ))}
      {construyendo && (
        <>
          <Rejilla limites={limites} paso={paso} y={y} />
          <mesh
            position={[(limites.x0 + limites.x1) / 2, y + 0.01, (limites.z0 + limites.z1) / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <planeGeometry args={[ancho, fondo]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {fantasma && (
            <>
              <ObjetoFantasma o={fantasma} y={y} />
              {cajaFantasma && (
                <Huella caja={cajaFantasma} y={y} color={COLOR_ESTADO[fantasma.estado]} />
              )}
            </>
          )}
          {elegido && !arrastrando && <Huella caja={huella(elegido)} y={y} color="#f6d27a" />}
          {huellaMarca && !arrastreActivo && <Huella caja={huellaMarca} y={y} color="#f6d27a" />}
        </>
      )}
    </group>
  );
}
