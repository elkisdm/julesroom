import {
  BatchedMesh,
  Color as ColorValor,
  Matrix4 as MatrizValor,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  DynamicDrawUsage,
  BufferAttribute,
} from 'three';
import type { BufferGeometry, Color, Material, Matrix4 } from 'three';
import { uvDeCelda } from './celdas';
import type { GeometriaAtlas, UvCelda } from './celdas';

const normalizadas = new WeakMap<BufferGeometry, BufferGeometry>();

/**
 * BatchedMesh exige que todas las geometrías de un lote tengan índice y los mismos atributos.
 * Devuelve (cacheado) un clon con índice, solo position/normal/uv y sin grupos; no muta la original.
 */
export function normalizarParaLote(original: BufferGeometry): BufferGeometry {
  const previa = normalizadas.get(original);
  if (previa) return previa;
  const g = original.clone();
  if (!g.getIndex()) {
    const n = g.getAttribute('position').count;
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new BufferAttribute(idx, 1));
  }
  for (const nombre of Object.keys(g.attributes)) {
    if (nombre !== 'position' && nombre !== 'normal' && nombre !== 'uv') g.deleteAttribute(nombre);
  }
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) {
    g.setAttribute(
      'uv',
      new BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2),
    );
  }
  g.clearGroups();
  normalizadas.set(original, g);
  return g;
}

/**
 * Cómo se dibuja un grupo de piezas: todas las que comparten geometría y familia salen en un
 * solo draw call. El color va por instancia (multiplica al del material, que es blanco).
 */
export interface Familia {
  readonly clave: string;
  readonly material: Material;
  /** Variante con colores por vértice, para fusionar geometrías estáticas (decorado). */
  readonly fusion?: Material;
  /** Si existe, cada instancia elige una celda del atlas de la textura del material. */
  readonly atlas?: GeometriaAtlas;
  readonly ordenRender?: number;
}

/** Familia + color: lo que `Pieza` necesita para saber cómo pintarse. */
export interface Estilo {
  readonly familia: Familia;
  readonly color: Color | null;
}

const CAPACIDAD_INICIAL = 16;

interface Lote {
  malla: InstancedMesh;
  /** Geometría de la malla: propia (clon) si lleva atlas, compartida si no. */
  geometria: BufferGeometry;
  familia: Familia;
  capacidad: number;
  n: number;
}

const VERTICES_INICIALES = 256;

/** Lote de una familia sin atlas: un BatchedMesh con todas sus geometrías registradas dentro. */
interface LoteBatch {
  malla: BatchedMesh;
  familia: Familia;
  /** Geometrías registradas, en orden de registro (el índice es su geometryId). */
  geometrias: BufferGeometry[];
  ids: Map<BufferGeometry, number>;
  vertices: number;
  indices: number;
  maxInstancias: number;
  maxVertices: number;
  maxIndices: number;
  /** Instancias creadas en la malla (los slots por encima de `n` siguen ahí, ocultos). */
  creadas: number;
  /** Slots escritos este cuadro. */
  n: number;
  /** Slots que quedaron visibles en el último `fin()`. */
  previo: number;
  /** 1 si el slot está visible en la malla. */
  activos: Uint8Array;
  /** geometryId vigente de cada slot (-1 = ninguno). */
  geoSlot: Int32Array;
  conColor: boolean;
}

function subirSolo(atributo: InstancedBufferAttribute, instancias: number): void {
  atributo.clearUpdateRanges();
  atributo.addUpdateRange(0, instancias * atributo.itemSize);
}

const uv: UvCelda = { x: 0, y: 0 };
const colorTmp = new ColorValor();
const matrizTmp = new MatrizValor();

function crearMalla(
  geometria: BufferGeometry,
  familia: Familia,
  capacidad: number,
  sombras: boolean,
): InstancedMesh {
  const malla = new InstancedMesh(geometria, familia.material, capacidad);
  malla.instanceMatrix.setUsage(DynamicDrawUsage);
  malla.instanceColor = new InstancedBufferAttribute(new Float32Array(capacidad * 3), 3);
  malla.instanceColor.setUsage(DynamicDrawUsage);
  // Las instancias se mueven cada cuadro: la esfera envolvente de la geometría base mentiría.
  malla.frustumCulled = false;
  malla.castShadow = sombras;
  malla.renderOrder = familia.ordenRender ?? 0;
  malla.count = 0;
  malla.visible = false;
  return malla;
}

/**
 * Todas las piezas móviles de las personas, agrupadas en mallas instanciadas. Cada cuadro:
 * `inicio()`, un `agregar(...)` por pieza visible (en cualquier orden) y `fin()`. Las
 * instancias se compactan solas, así que no hay que reservar ni liberar espacios por agente.
 */
export class Flota {
  readonly raiz = new Group();
  private readonly lotes = new Map<BufferGeometry, Map<Familia, Lote>>();
  private readonly lista: Lote[] = [];
  private readonly batches = new Map<Familia, LoteBatch>();
  private readonly listaBatch: LoteBatch[] = [];
  private sombras = false;
  private rangosParciales = false;

  inicio(): void {
    for (const lote of this.lista) lote.n = 0;
    for (const lote of this.listaBatch) lote.n = 0;
  }

  agregar(
    geometria: BufferGeometry,
    familia: Familia,
    matriz: Matrix4,
    color: Color | null,
    celda: number,
  ): void {
    if (!familia.atlas) {
      this.agregarBatch(geometria, familia, matriz, color);
      return;
    }
    const lote = this.lote(geometria, familia);
    if (lote.n === lote.capacidad) this.crecer(lote);
    const i = lote.n++;
    const m = lote.malla.instanceMatrix.array as Float32Array;
    const e = matriz.elements;
    const o = i * 16;
    for (let k = 0; k < 16; k++) m[o + k] = e[k] ?? 0;
    const c = (lote.malla.instanceColor as InstancedBufferAttribute).array as Float32Array;
    c[i * 3] = color ? color.r : 1;
    c[i * 3 + 1] = color ? color.g : 1;
    c[i * 3 + 2] = color ? color.b : 1;
    uvDeCelda(familia.atlas, celda, uv);
    const a = lote.geometria.getAttribute('aAtlas') as InstancedBufferAttribute;
    (a.array as Float32Array)[i * 2] = uv.x;
    (a.array as Float32Array)[i * 2 + 1] = uv.y;
  }

  fin(): void {
    for (const lote of this.lista) {
      const { malla } = lote;
      malla.count = lote.n;
      malla.visible = lote.n > 0;
      if (lote.n === 0) continue;
      const color = malla.instanceColor as InstancedBufferAttribute;
      const celdas = lote.familia.atlas
        ? (lote.geometria.getAttribute('aAtlas') as InstancedBufferAttribute)
        : null;
      if (this.rangosParciales) {
        // `start` y `count` van en elementos del array, no en instancias (WebGLAttributes, r169).
        subirSolo(malla.instanceMatrix, lote.n);
        subirSolo(color, lote.n);
        if (celdas) subirSolo(celdas, lote.n);
      }
      malla.instanceMatrix.needsUpdate = true;
      color.needsUpdate = true;
      if (celdas) celdas.needsUpdate = true;
    }
    for (const lote of this.listaBatch) {
      const { malla, activos, n } = lote;
      for (let i = 0; i < n; i++) {
        if (activos[i] === 0) {
          activos[i] = 1;
          malla.setVisibleAt(i, true);
        }
      }
      for (let i = n; i < lote.previo; i++) {
        activos[i] = 0;
        malla.setVisibleAt(i, false);
      }
      lote.previo = n;
      malla.visible = n > 0;
    }
  }

  /** Sube solo las instancias en uso de las mallas instanciadas (las de atlas), no toda su capacidad. */
  fijarRangosParciales(activos: boolean): void {
    this.rangosParciales = activos;
    if (activos) return;
    for (const lote of this.lista) {
      lote.malla.instanceMatrix.clearUpdateRanges();
      lote.malla.instanceColor?.clearUpdateRanges();
    }
  }

  fijarSombras(activas: boolean): void {
    this.sombras = activas;
    for (const lote of this.lista) lote.malla.castShadow = activas;
    for (const lote of this.listaBatch) lote.malla.castShadow = activas;
  }

  /** Libera las mallas (no las geometrías ni materiales compartidos). La flota queda reutilizable. */
  liberar(): void {
    for (const lote of this.lista) this.descartar(lote);
    for (const lote of this.listaBatch) lote.malla.dispose();
    this.raiz.clear();
    this.lotes.clear();
    this.lista.length = 0;
    this.batches.clear();
    this.listaBatch.length = 0;
  }

  private agregarBatch(
    geometria: BufferGeometry,
    familia: Familia,
    matriz: Matrix4,
    color: Color | null,
  ): void {
    let lote = this.batches.get(familia);
    if (!lote) lote = this.crearBatch(familia, geometria);
    let id = lote.ids.get(geometria);
    if (id === undefined) id = this.registrar(lote, geometria);
    if (lote.n >= lote.maxInstancias) this.reconstruir(lote, 0, 0, true);
    const slot = lote.n++;
    const { malla } = lote;
    if (slot >= lote.creadas) {
      malla.addInstance(id);
      lote.creadas++;
      lote.geoSlot[slot] = id;
    } else if (lote.geoSlot[slot] !== id) {
      malla.setGeometryIdAt(slot, id);
      lote.geoSlot[slot] = id;
    }
    malla.setMatrixAt(slot, matriz);
    malla.setColorAt(slot, color ?? colorTmp.setRGB(1, 1, 1));
    lote.conColor = true;
  }

  /** Registra una geometría nueva en el lote, reconstruyéndolo si no cabe. */
  private registrar(lote: LoteBatch, geometria: BufferGeometry): number {
    const norm = normalizarParaLote(geometria);
    const v = norm.getAttribute('position').count;
    const ix = norm.getIndex()?.count ?? 0;
    const sinInstancias = lote.creadas >= lote.maxInstancias;
    if (
      sinInstancias ||
      lote.vertices + v > lote.maxVertices ||
      lote.indices + ix > lote.maxIndices
    ) {
      this.reconstruir(lote, v, ix, sinInstancias);
    }
    const id = lote.malla.addGeometry(norm, v, ix);
    lote.geometrias.push(geometria);
    lote.ids.set(geometria, id);
    lote.vertices += v;
    lote.indices += ix;
    return id;
  }

  private crearBatch(familia: Familia, primera: BufferGeometry): LoteBatch {
    const v = normalizarParaLote(primera).getAttribute('position').count;
    const maxVertices = Math.max(VERTICES_INICIALES, v * 2);
    const maxIndices = maxVertices * 2;
    const lote: LoteBatch = {
      malla: this.crearMallaBatch(familia, CAPACIDAD_INICIAL, maxVertices, maxIndices),
      familia,
      geometrias: [],
      ids: new Map(),
      vertices: 0,
      indices: 0,
      maxInstancias: CAPACIDAD_INICIAL,
      maxVertices,
      maxIndices,
      creadas: 0,
      n: 0,
      previo: 0,
      activos: new Uint8Array(CAPACIDAD_INICIAL),
      geoSlot: new Int32Array(CAPACIDAD_INICIAL).fill(-1),
      conColor: false,
    };
    this.raiz.add(lote.malla);
    this.batches.set(familia, lote);
    this.listaBatch.push(lote);
    return lote;
  }

  private crearMallaBatch(
    familia: Familia,
    instancias: number,
    vertices: number,
    indices: number,
  ): BatchedMesh {
    const malla = new BatchedMesh(instancias, vertices, indices, familia.material);
    malla.sortObjects = false;
    malla.perObjectFrustumCulled = false;
    malla.frustumCulled = false;
    malla.castShadow = this.sombras;
    malla.renderOrder = familia.ordenRender ?? 0;
    malla.visible = false;
    return malla;
  }

  /**
   * Duplica los presupuestos que no alcanzan y vuelve a armar el lote: mismas geometrías en el
   * mismo orden (los geometryId se conservan) y copia de lo escrito en el cuadro en curso.
   */
  private reconstruir(
    lote: LoteBatch,
    vNuevos: number,
    iNuevos: number,
    masInstancias: boolean,
  ): void {
    let maxVertices = lote.maxVertices;
    let maxIndices = lote.maxIndices;
    while (lote.vertices + vNuevos > maxVertices) maxVertices *= 2;
    while (lote.indices + iNuevos > maxIndices) maxIndices *= 2;
    const maxInstancias = masInstancias ? lote.maxInstancias * 2 : lote.maxInstancias;
    const vieja = lote.malla;
    const nueva = this.crearMallaBatch(lote.familia, maxInstancias, maxVertices, maxIndices);
    for (const g of lote.geometrias) nueva.addGeometry(normalizarParaLote(g));
    const activos = new Uint8Array(maxInstancias);
    const geoSlot = new Int32Array(maxInstancias).fill(-1);
    activos.set(lote.activos);
    geoSlot.set(lote.geoSlot);
    for (let i = 0; i < lote.creadas; i++) {
      nueva.addInstance(lote.geoSlot[i] as number);
      if (i < lote.n) {
        vieja.getMatrixAt(i, matrizTmp);
        nueva.setMatrixAt(i, matrizTmp);
        if (lote.conColor) {
          vieja.getColorAt(i, colorTmp);
          nueva.setColorAt(i, colorTmp);
        }
      }
      nueva.setVisibleAt(i, activos[i] === 1);
    }
    nueva.visible = vieja.visible;
    this.raiz.remove(vieja);
    vieja.dispose();
    this.raiz.add(nueva);
    lote.malla = nueva;
    lote.maxInstancias = maxInstancias;
    lote.maxVertices = maxVertices;
    lote.maxIndices = maxIndices;
    lote.activos = activos;
    lote.geoSlot = geoSlot;
  }

  private lote(geometria: BufferGeometry, familia: Familia): Lote {
    let porFamilia = this.lotes.get(geometria);
    if (!porFamilia) {
      porFamilia = new Map();
      this.lotes.set(geometria, porFamilia);
    }
    let lote = porFamilia.get(familia);
    if (!lote) {
      const propia = familia.atlas ? geometria.clone() : geometria;
      if (familia.atlas) this.atributoAtlas(propia, CAPACIDAD_INICIAL);
      lote = {
        malla: crearMalla(propia, familia, CAPACIDAD_INICIAL, this.sombras),
        geometria: propia,
        familia,
        capacidad: CAPACIDAD_INICIAL,
        n: 0,
      };
      this.raiz.add(lote.malla);
      porFamilia.set(familia, lote);
      this.lista.push(lote);
    }
    return lote;
  }

  /** Duplica la capacidad conservando lo ya escrito este cuadro. */
  private crecer(lote: Lote): void {
    const capacidad = lote.capacidad * 2;
    const vieja = lote.malla;
    const nueva = crearMalla(lote.geometria, lote.familia, capacidad, this.sombras);
    (nueva.instanceMatrix.array as Float32Array).set(vieja.instanceMatrix.array as Float32Array);
    const colores = vieja.instanceColor as InstancedBufferAttribute;
    (nueva.instanceColor as InstancedBufferAttribute).array.set(colores.array);
    if (lote.familia.atlas) {
      const anterior = lote.geometria.getAttribute('aAtlas') as InstancedBufferAttribute;
      // Soltar los buffers de la geometría antes de cambiar su atributo evita dejar uno huérfano en la GPU.
      lote.geometria.dispose();
      this.atributoAtlas(lote.geometria, capacidad);
      (lote.geometria.getAttribute('aAtlas') as InstancedBufferAttribute).array.set(anterior.array);
    }
    this.raiz.remove(vieja);
    vieja.dispose();
    this.raiz.add(nueva);
    lote.malla = nueva;
    lote.capacidad = capacidad;
  }

  private atributoAtlas(geometria: BufferGeometry, capacidad: number): void {
    const atributo = new InstancedBufferAttribute(new Float32Array(capacidad * 2), 2);
    atributo.setUsage(DynamicDrawUsage);
    geometria.setAttribute('aAtlas', atributo);
  }

  private descartar(lote: Lote): void {
    lote.malla.dispose();
    if (lote.familia.atlas) lote.geometria.dispose();
  }
}
