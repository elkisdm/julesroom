import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useThree } from '@react-three/fiber';
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  NoColorSpace,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  DataTexture,
  UnsignedByteType,
  Vector3,
} from 'three';
import type { Rig } from './animador';
import { candidatoVivo, correccionNombre, NOMBRES_VIVOS } from './nombresVivos';
import { planoCorte } from './casa/planoCorte';
import { useGrafica } from './contextoGrafica';
import {
  apilarEtiquetas,
  disponerTexto,
  elegirEtiquetas,
  etiquetaEnRadio,
  escalaEtiqueta,
  otraPlanta,
  type CandidatoEtiqueta,
  type RectEtiqueta,
} from './textoEtiquetas';

const CELDA = 64;
const FUENTE_PX = 40;
const MARGEN_PX = 8;
const COLUMNAS = 16;
const MAX_INSTANCIAS = 2048;
const TAMANO_MUNDO = 0.14;
const PX_MIN = 12;
const MARGEN_HISTERESIS = 4;
const ESCALA_SELECCIONADO = 1.25;
const LADO_EM = CELDA / FUENTE_PX;
/** Alto de una línea de etiqueta (em) con su interlínea: lo que sube cada nivel al apilarse. */
const LINEA_EM = 1.3;
/** Alturas de etiqueta que puede subir una normal antes de descartarse (valor inicial). */
const MAX_NIVELES = 3;
/** Metros de distancia que pesa cada nivel previo para que el apilado no cambie con empates. */
const VENTAJA_NIVEL = 0.5;
/** Radio (m) alrededor del avatar con nombres en «seguirme» (tope: `distanciaEtiquetas`); valor inicial. */
const RADIO_SEGUIR = 4.5;
/** Diferencia de altura (m) desde la que, en «seguirme», alguien es de otra planta y no lleva nombre; valor inicial. */
const ALTO_PLANTA = 1.5;
/** Tamaño del nombre del avatar propio frente al de los demás, para que sea inconfundible. */
const ESCALA_PROPIO = 1.4;
/** Aire entre nombres apilados, como fracción del alto de línea. */
const SEPARACION = 0.15;
/**
 * Alturas de línea que el nombre sube en pantalla desde su ancla (el aro de la cabeza): fijo en
 * pantalla, así no cruza el aro de cerca ni flota lejos de la cabeza con la cámara cerca.
 */
const SOBRE_ARO = 0.65;
/** Fila más alta de un nombre (fracción del alto de pantalla): el sombreador clava ahí lo que pasa de 0,9 NDC. */
const TOPE_PANTALLA = 0.05;
/** Una cabeza más arriba que esto (fracción del alto, sobre el borde) no se clava en el borde: no está en cuadro. */
const FUERA_ARRIBA = 0.5;
const INF = 1e20;

const RANGOS: [number, number][] = [
  [32, 126],
  [160, 255],
];

function indiceCelda(codigo: number): number {
  if (codigo >= 32 && codigo <= 126) return codigo - 32;
  if (codigo >= 160 && codigo <= 255) return 95 + codigo - 160;
  return -1;
}

/** Transformada de distancia euclidiana al cuadrado en 1D (Felzenszwalb). */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const dx = q - v[k]!;
    d[q] = dx * dx + f[v[k]!]!;
  }
}

/** Distancia al cuadrado de cada píxel al sitio más cercano (sitio = f 0). */
function edt2d(grid: Float64Array, w: number, h: number): void {
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]!;
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]!;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]!;
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x]!;
  }
}

interface Atlas {
  textura: DataTexture;
  avance: (c: string) => number;
}

function crearAtlas(): Atlas {
  const filas = Math.ceil(191 / COLUMNAS);
  const ancho = COLUMNAS * CELDA;
  const alto = filas * CELDA;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.font = `600 ${FUENTE_PX}px system-ui, sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const avances = new Map<string, number>();
  for (const [a, b] of RANGOS) {
    for (let cod = a; cod <= b; cod++) {
      const c = String.fromCharCode(cod);
      const i = indiceCelda(cod);
      avances.set(c, ctx.measureText(c).width / FUENTE_PX);
      ctx.fillText(
        c,
        (i % COLUMNAS) * CELDA + CELDA / 2,
        Math.floor(i / COLUMNAS) * CELDA + CELDA / 2,
      );
    }
  }

  const rgba = ctx.getImageData(0, 0, ancho, alto).data;
  const salida = new Uint8Array(ancho * alto * 4);
  const radio = MARGEN_PX;
  const fuera = new Float64Array(CELDA * CELDA);
  const dentro = new Float64Array(CELDA * CELDA);
  for (let i = 0; i < COLUMNAS * filas; i++) {
    const ox = (i % COLUMNAS) * CELDA;
    const oy = Math.floor(i / COLUMNAS) * CELDA;
    for (let y = 0; y < CELDA; y++) {
      for (let x = 0; x < CELDA; x++) {
        const interior = rgba[((oy + y) * ancho + ox + x) * 4]! > 127;
        fuera[y * CELDA + x] = interior ? 0 : INF;
        dentro[y * CELDA + x] = interior ? INF : 0;
      }
    }
    edt2d(fuera, CELDA, CELDA);
    edt2d(dentro, CELDA, CELDA);
    for (let y = 0; y < CELDA; y++) {
      for (let x = 0; x < CELDA; x++) {
        const p = y * CELDA + x;
        const firmada = Math.sqrt(fuera[p]!) - Math.sqrt(dentro[p]!);
        const valor = Math.round(Math.min(1, Math.max(0, 0.5 - firmada / (2 * radio))) * 255);
        const o = ((oy + y) * ancho + ox + x) * 4;
        salida[o] = valor;
        salida[o + 1] = valor;
        salida[o + 2] = valor;
        salida[o + 3] = 255;
      }
    }
  }

  const textura = new DataTexture(salida, ancho, alto, RGBAFormat, UnsignedByteType);
  textura.minFilter = LinearFilter;
  textura.magFilter = LinearFilter;
  textura.generateMipmaps = false;
  textura.colorSpace = NoColorSpace;
  textura.flipY = false;
  textura.needsUpdate = true;

  return { textura, avance: (c) => avances.get(c) ?? NaN };
}

const VERTEX = /* glsl */ `
  attribute vec3 aAncla;
  attribute vec4 aDatos;
  attribute float aNivel;
  attribute float aCorreccion;
  uniform float uAncho;
  uniform float uTamano;
  uniform float uLado;
  uniform float uLinea;
  uniform float uSobre;
  uniform float uColumnas;
  uniform float uFilas;
  varying vec2 vUv;
  varying float vEstado;
  void main() {
    vec3 derecha = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 arriba = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float tam = uTamano * aDatos.z;
    // aNivel: alturas de línea (con su aire) que sube el nombre en pantalla; negativo = baja.
    vec3 mundo = aAncla + derecha * (aDatos.x + position.x * uLado) * tam + arriba * (position.y * uLado + aNivel * uLinea + uSobre) * tam;
    float col = mod(aDatos.y, uColumnas);
    float fila = floor(aDatos.y / uColumnas);
    vec2 local = position.xy + 0.5;
    vUv = vec2((col + local.x) / uColumnas, (fila + 1.0 - local.y) / uFilas);
    vEstado = mod(aDatos.w, 4.0);
    vec4 clip = projectionMatrix * viewMatrix * vec4(mundo, 1.0);
    // Centro del nombre sin apilar (ancla + sobre el aro): es lo que apilarEtiquetas clava en el tope.
    vec4 centro = projectionMatrix * viewMatrix * vec4(aAncla + arriba * uSobre * tam, 1.0);
    // Nunca se corta contra el borde superior: si ese centro pasa de 0,9, todo el texto baja a 0,9.
    clip.y += min(0.0, 0.9 - centro.y / centro.w) * clip.w;
    clip.x += 2.0 * aCorreccion / uAncho * clip.w;
    if (aDatos.w > 3.5) clip.z = -0.99 * clip.w;
    gl_Position = clip;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uHalo;
  varying vec2 vUv;
  varying float vEstado;
  void main() {
    float d = texture2D(uAtlas, vUv).r;
    float w = max(fwidth(d), 0.0001);
    float a = smoothstep(0.5 - w, 0.5 + w, d);
    if (uHalo > 0.5) {
      // Contorno oscuro de ~0,12 em: va en su propia pasada, antes del texto, para que el contorno de una
      // letra no tape la blanca de su vecina; así el nombre se lee sobre piso claro y oscuro.
      float halo = smoothstep(0.16, 0.42, d) * 0.85;
      if (halo < 0.01) discard;
      gl_FragColor = vec4(0.05, 0.06, 0.09, halo);
      return;
    }
    vec3 tinte = vec3(1.0);
    if (vEstado > 1.5) tinte = vec3(0.55, 0.85, 1.0);
    else if (vEstado > 0.5) tinte = vec3(1.0, 0.93, 0.78);
    if (a < 0.01) discard;
    gl_FragColor = vec4(tinte, a);
  }
`;

interface Recursos {
  mesh: InstancedMesh;
  /** Contorno oscuro: misma geometría y atributos, dibujado justo antes que el texto. */
  contorno: InstancedMesh;
  ancla: InstancedBufferAttribute;
  datos: InstancedBufferAttribute;
  nivel: InstancedBufferAttribute;
  correccion: InstancedBufferAttribute;
  atlas: Atlas;
  geometria: PlaneGeometry;
  material: ShaderMaterial;
}

function crearRecursos(): Recursos {
  const atlas = crearAtlas();
  const geometria = new PlaneGeometry(1, 1);
  const ancla = new InstancedBufferAttribute(new Float32Array(MAX_INSTANCIAS * 3), 3);
  const datos = new InstancedBufferAttribute(new Float32Array(MAX_INSTANCIAS * 4), 4);
  const nivel = new InstancedBufferAttribute(new Float32Array(MAX_INSTANCIAS), 1);
  const correccion = new InstancedBufferAttribute(new Float32Array(MAX_INSTANCIAS), 1);
  correccion.setUsage(DynamicDrawUsage);
  ancla.setUsage(DynamicDrawUsage);
  datos.setUsage(DynamicDrawUsage);
  nivel.setUsage(DynamicDrawUsage);
  geometria.setAttribute('aAncla', ancla);
  geometria.setAttribute('aDatos', datos);
  geometria.setAttribute('aNivel', nivel);
  geometria.setAttribute('aCorreccion', correccion);
  const crearMaterial = (halo: number) =>
    new ShaderMaterial({
      uniforms: {
        uAtlas: { value: atlas.textura },
        uAncho: { value: 1 },
        uHalo: { value: halo },
        uTamano: { value: TAMANO_MUNDO },
        uLado: { value: LADO_EM },
        uLinea: { value: LINEA_EM * (1 + SEPARACION) },
        uSobre: { value: LINEA_EM * SOBRE_ARO },
        uColumnas: { value: COLUMNAS },
        uFilas: { value: Math.ceil(191 / COLUMNAS) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
  const material = crearMaterial(0);
  const mesh = new InstancedMesh(geometria, material, MAX_INSTANCIAS);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.count = 0;
  const contorno = new InstancedMesh(geometria, crearMaterial(1), MAX_INSTANCIAS);
  contorno.frustumCulled = false;
  contorno.renderOrder = 4;
  contorno.count = 0;
  return { mesh, contorno, ancla, datos, nivel, correccion, atlas, geometria, material };
}

interface TextoCacheado {
  celdas: number[];
  centros: number[];
  /** Ancho del texto (em). */
  ancho: number;
}

interface Props {
  nombres: ReadonlyMap<string, string>;
  rigs: MutableRefObject<Map<string, Rig>>;
  seleccionadoId: string | null;
  hablandoIds: ReadonlySet<string>;
  alturaCabeza?: number;
  /**
   * Con el avatar propio seguido por la cámara, su id: los nombres cercanos se miden desde él y no
   * desde la cámara (que va 8 m atrás).
   */
  centroId?: string | null;
  /** Radio (m) de nombres alrededor de `centroId`; nunca pasa de `distanciaEtiquetas`. */
  radioSeguir?: number;
  siempreIds?: ReadonlySet<string>;
}

/** Nombres sobre la cabeza de cada persona: texto SDF instanciado, una sola llamada de dibujo. */
export function Etiquetas(props: Props) {
  const { tecnicas } = useGrafica();
  if (!tecnicas.etiquetas && !props.siempreIds?.size) return null;
  return <EtiquetasActivas {...props} />;
}

function EtiquetasActivas({
  nombres,
  rigs,
  seleccionadoId,
  hablandoIds,
  alturaCabeza = 2.15,
  centroId = null,
  radioSeguir = RADIO_SEGUIR,
  siempreIds,
}: Props) {
  const { maxEtiquetas, distanciaEtiquetas } = useGrafica();
  const recursos = useMemo(crearRecursos, []);
  const previas = useRef(new Set<string>());
  const pool = useRef<CandidatoEtiqueta[]>([]);
  const distancias = useRef(new Map<string, number>());
  const correcciones = useRef(new Map<string, number>());
  const escalas = useRef(new Map<string, number>());
  const referencias = useRef(new Map<string, number>());
  const rects = useRef<RectEtiqueta[]>([]);
  const bajanRef = useRef(new Set<string>());
  const niveles = useRef({ actual: new Map<string, number>(), previo: new Map<string, number>() });
  const punto = useMemo(() => new Vector3(), []);
  const cache = useRef(new Map<string, TextoCacheado>());
  const camara = useThree((s) => s.camera);
  const ancho = useThree((s) => s.size.width);
  const alto = useThree((s) => s.size.height);

  useEffect(
    () => () => {
      recursos.geometria.dispose();
      recursos.material.dispose();
      (recursos.contorno.material as ShaderMaterial).dispose();
      recursos.atlas.textura.dispose();
      recursos.mesh.dispose();
      recursos.contorno.dispose();
    },
    [recursos],
  );

  /**
   * Se recalcula al dibujar (`onBeforeRender`) y no en un `useFrame`: aquí ya se movieron las personas, el
   * avatar y la cámara de este cuadro, y las matrices de la cámara están al día. En un `useFrame` que corre
   * antes de `ControlesCamara`, los rectángulos de choque iban un cuadro atrás de lo que dibujaba el sombreador.
   */
  const actualizar = () => {
    const { mesh, contorno, ancla, datos, nivel: nivelAttr, correccion, atlas } = recursos;
    recursos.material.uniforms.uAncho!.value = ancho;
    (contorno.material as ShaderMaterial).uniforms.uAncho!.value = ancho;
    correcciones.current.clear();
    const fov = ((camara as PerspectiveCamera).fov * Math.PI) / 180;
    const cands = pool.current;
    let n = 0;
    distancias.current.clear();
    referencias.current.clear();
    // Lo cercano se mide desde el avatar seguido (si lo hay) y no desde la cámara.
    const centro = centroId ? rigs.current.get(centroId)?.raiz.position : undefined;
    const radio = centro ? Math.min(radioSeguir, distanciaEtiquetas) : distanciaEtiquetas;
    for (const [id, rig] of rigs.current) {
      if (!nombres.has(id)) continue;
      const p = rig.raiz.position;
      const dx = p.x - camara.position.x;
      const dy = p.y + alturaCabeza - camara.position.y;
      const dz = p.z - camara.position.z;
      const distanciaCamara = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // En «seguirme» el radio se mide en planta y quien está en otra planta no lleva nombre.
      const distancia = centro ? Math.hypot(p.x - centro.x, p.z - centro.z) : distanciaCamara;
      const forzado = siempreIds?.has(id) || id === seleccionadoId || hablandoIds.has(id);
      if (centro && otraPlanta(p.y - centro.y, ALTO_PLANTA, forzado)) continue;
      if (!etiquetaEnRadio(distancia, radio, forzado)) continue;
      // Quien queda sobre el corte de la casa (otra planta) no se dibuja: tampoco su nombre.
      if (!forzado && p.y >= planoCorte.constant) continue;
      const c = (cands[n] ??= candidatoVivo(id, distancia, Boolean(siempreIds?.has(id))));
      c.id = id;
      c.distancia = distancia;
      c.seleccionado = id === seleccionadoId;
      c.hablando = Boolean(siempreIds?.has(id)) || hablandoIds.has(id);
      distancias.current.set(id, distanciaCamara);
      referencias.current.set(id, distancia);
      n++;
    }
    cands.length = n;
    const elegidos = elegirEtiquetas(cands, maxEtiquetas, previas.current, MARGEN_HISTERESIS);
    previas.current.clear();

    // Cada nombre elegido, proyectado a la pantalla: de ahí sale quién se enciman con quién.
    const lista = rects.current;
    escalas.current.clear();
    let k = 0;
    for (const id of elegidos) {
      previas.current.add(id);
      const rig = rigs.current.get(id);
      const nombre = nombres.get(id);
      if (!rig || nombre === undefined) continue;
      let texto = cache.current.get(nombre);
      if (!texto) {
        const disp = disponerTexto(nombre, atlas.avance, 1);
        texto = { celdas: [], centros: [], ancho: disp.ancho };
        for (const ch of disp.caracteres) {
          const i = indiceCelda(ch.c.charCodeAt(0));
          const celda = i >= 0 ? i : indiceCelda(63);
          const av = atlas.avance(ch.c);
          texto.celdas.push(celda);
          texto.centros.push(ch.x + (Number.isFinite(av) ? av : 0.5) / 2);
        }
        cache.current.set(nombre, texto);
      }
      const p = rig.raiz.position;
      // Tamaño en pantalla = tamaño en el mundo × f / profundidad (a lo largo del eje de la cámara,
      // no la distancia en línea recta: en los bordes la segunda sobrestima).
      const el = camara.matrixWorld.elements;
      const dist = Math.max(
        0.01,
        -(
          (p.x - camara.position.x) * el[8]! +
          (p.y + alturaCabeza - camara.position.y) * el[9]! +
          (p.z - camara.position.z) * el[10]!
        ),
      );
      const seleccionado = id === seleccionadoId;
      const escala =
        escalaEtiqueta(
          dist,
          TAMANO_MUNDO,
          siempreIds?.has(id) ? NOMBRES_VIVOS.minimoPx : PX_MIN,
          fov,
          alto,
        ) *
        (seleccionado ? ESCALA_SELECCIONADO : 1) *
        (id === centroId ? ESCALA_PROPIO : 1);
      punto.set(p.x, p.y + alturaCabeza, p.z).project(camara);
      if (punto.z > 1) continue;
      const pxPorMetro = alto / (2 * dist * Math.tan(fov / 2));
      const r = (lista[k] ??= {
        id,
        x: 0,
        y: 0,
        ancho: 0,
        alto: 0,
        distancia: 0,
        forzada: false,
      });
      r.id = id;
      r.x = ((punto.x + 1) / 2) * ancho;
      r.y = ((1 - punto.y) / 2) * alto;
      r.ancho = texto.ancho * TAMANO_MUNDO * escala * pxPorMetro;
      r.alto = LINEA_EM * TAMANO_MUNDO * escala * pxPorMetro;
      r.y -= SOBRE_ARO * r.alto;
      // Lo que cae del todo fuera (lados, abajo o muy por encima del borde) no se ve: no ocupa sitio ni instancias.
      if (
        r.x + r.ancho / 2 < 0 ||
        r.x - r.ancho / 2 > ancho ||
        r.y - r.alto / 2 > alto ||
        r.y < -FUERA_ARRIBA * alto ||
        // Clavar un nombre en el borde superior solo vale para el seleccionado o quien habla.
        (!(siempreIds?.has(id) || seleccionado || hablandoIds.has(id)) && r.y < 0)
      )
        continue;
      const corr = siempreIds?.has(id) ? correccionNombre(r.x, r.ancho, ancho) : 0;
      correcciones.current.set(id, corr);
      r.x += corr;
      escalas.current.set(id, escala);
      r.distancia = referencias.current.get(id) ?? dist;
      r.forzada = Boolean(siempreIds?.has(id)) || seleccionado || hablandoIds.has(id);
      k++;
    }
    lista.length = k;
    const par = niveles.current;
    [par.actual, par.previo] = [par.previo, par.actual];
    apilarEtiquetas(
      lista,
      {
        maxNiveles: MAX_NIVELES,
        altoPantalla: siempreIds?.size ? alto : undefined,
        ventaja: VENTAJA_NIVEL,
        separacion: SEPARACION,
        tope: TOPE_PANTALLA * alto,
      },
      par.previo,
      par.actual,
    );
    const bajan = bajanRef.current;
    bajan.clear();
    for (const r of lista) if (r.abajo) bajan.add(r.id);

    const a = ancla.array as Float32Array;
    const d = datos.array as Float32Array;
    let escritos = 0;
    for (const id of elegidos) {
      const nivel = par.actual.get(id);
      if (nivel === undefined) continue;
      const rig = rigs.current.get(id);
      const nombre = nombres.get(id);
      const texto = nombre === undefined ? undefined : cache.current.get(nombre);
      if (!rig || !texto) continue;
      if (escritos + texto.celdas.length > MAX_INSTANCIAS) break;
      const p = rig.raiz.position;
      const escala = escalas.current.get(id) ?? 1;
      const estado =
        (siempreIds?.has(id) ? 4 : 0) + (hablandoIds.has(id) ? 2 : id === seleccionadoId ? 1 : 0);
      const sube = bajan.has(id) ? -nivel : nivel;
      for (let j = 0; j < texto.celdas.length; j++) {
        const o3 = escritos * 3;
        const o4 = escritos * 4;
        a[o3] = p.x;
        a[o3 + 1] = p.y + alturaCabeza;
        a[o3 + 2] = p.z;
        d[o4] = texto.centros[j]!;
        d[o4 + 1] = texto.celdas[j]!;
        d[o4 + 2] = escala;
        d[o4 + 3] = estado;
        nivelAttr.array[escritos] = sube;
        correccion.array[escritos] = correcciones.current.get(id) ?? 0;
        escritos++;
      }
    }
    mesh.count = escritos;
    contorno.count = escritos;
    ancla.needsUpdate = true;
    datos.needsUpdate = true;
    nivelAttr.needsUpdate = true;
    correccion.needsUpdate = true;
  };
  const ultima = useRef(actualizar);
  ultima.current = actualizar;
  useEffect(() => {
    const { contorno } = recursos;
    contorno.onBeforeRender = (_r, _e, cam) => {
      if (cam === camara) ultima.current();
    };
    return () => {
      contorno.onBeforeRender = () => {};
    };
  }, [recursos, camara]);

  return (
    <>
      <primitive object={recursos.contorno} />
      <primitive object={recursos.mesh} />
    </>
  );
}
