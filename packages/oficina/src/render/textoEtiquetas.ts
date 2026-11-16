const AVANCE_DEFECTO = 0.5;

export interface TextoDispuesto {
  caracteres: { c: string; x: number }[];
  ancho: number;
}

export interface CandidatoEtiqueta {
  id: string;
  distancia: number;
  seleccionado: boolean;
  hablando: boolean;
}

/** Coloca los caracteres en fila y centra el texto en x=0; `avance` está en em y `tamano` lo escala. */
export function disponerTexto(
  texto: string,
  avance: (c: string) => number,
  tamano: number,
): TextoDispuesto {
  const medir = (c: string): number => {
    const a = avance(c);
    if (Number.isFinite(a)) return a;
    const q = avance('?');
    return Number.isFinite(q) ? q : AVANCE_DEFECTO;
  };
  const caracteres: { c: string; x: number }[] = [];
  let cursor = 0;
  for (const c of texto) {
    caracteres.push({ c, x: cursor });
    cursor += medir(c) * tamano;
  }
  for (const k of caracteres) k.x -= cursor / 2;
  return { caracteres, ancho: cursor };
}

/**
 * Ids con etiqueta: seleccionados y hablando siempre; el resto por cercanía hasta `max`,
 * con histéresis (un previo se mantiene hasta el rango max+margen).
 */
export function elegirEtiquetas(
  candidatos: readonly CandidatoEtiqueta[],
  max: number,
  previas: ReadonlySet<string>,
  margen: number,
): string[] {
  const orden = candidatos
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.distancia - b.c.distancia || a.i - b.i)
    .map((o) => o.c);
  const elegidos = new Set<string>();
  const libres: CandidatoEtiqueta[] = [];
  for (const c of orden) {
    if (c.seleccionado || c.hablando) elegidos.add(c.id);
    else libres.push(c);
  }
  const cupo = Math.max(0, max - elegidos.size);
  let tomados = 0;
  for (let r = 0; r < libres.length && r < cupo + margen && tomados < cupo; r++) {
    if (previas.has(libres[r]!.id)) {
      elegidos.add(libres[r]!.id);
      tomados++;
    }
  }
  for (let r = 0; r < libres.length && r < cupo && tomados < cupo; r++) {
    if (!elegidos.has(libres[r]!.id)) {
      elegidos.add(libres[r]!.id);
      tomados++;
    }
  }
  return orden.filter((c) => elegidos.has(c.id)).map((c) => c.id);
}

/** Factor de escala para que el texto mida al menos `pxMin` px de alto en pantalla; nunca baja de 1. */
export function escalaEtiqueta(
  distancia: number,
  tamanoMundo: number,
  pxMin: number,
  fovRad: number,
  altoPx: number,
): number {
  const pxBase = (tamanoMundo * altoPx) / (2 * distancia * Math.tan(fovRad / 2));
  return Math.max(1, pxMin / pxBase);
}

/** Una etiqueta ya proyectada a la pantalla (px): centro `x`, centro vertical `y` (hacia abajo) y su tamaño. */
export interface RectEtiqueta {
  id: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Distancia a lo que se mira (cámara o avatar): manda quién queda abajo y quién se descarta. */
  distancia: number;
  /** Seleccionada o que habla: nunca se descarta ni se sube sobre una normal. */
  forzada: boolean;
  /** Lo deja `apilarEtiquetas`: sin espacio arriba, sus niveles bajan en vez de subir. */
  abajo?: boolean;
}

export interface OpcionesApilado {
  /** Alto visible: las etiquetas forzadas buscan hueco a ambos lados del ancla. */
  altoPantalla?: number;
  /** Cuántas alturas de etiqueta se puede subir una normal; más arriba se descarta. */
  maxNiveles: number;
  /** Metros de distancia que pesa cada nivel previo: quien iba arriba no cambia con empates. */
  ventaja: number;
  /** Aire entre etiquetas apiladas, como fracción del alto de línea (0 = pegadas). */
  separacion?: number;
  /**
   * Fila (px, hacia abajo) más alta donde se dibuja un nombre: lo que pasa de ahí se clava en ella
   * (así lo hace el sombreador) y, como subir ya no separa, sus niveles bajan.
   */
  tope?: number;
}

/** ¿Lleva etiqueta por su distancia al centro de interés? Quien está forzado (elegido o habla) siempre. */
export function etiquetaEnRadio(distancia: number, radio: number, forzado: boolean): boolean {
  return forzado || distancia <= radio;
}

/** ¿Está a una altura de planta o más de quien se mira? Entonces su nombre sobra, salvo que esté forzado. */
export function otraPlanta(dy: number, altoPlanta: number, forzado: boolean): boolean {
  return !forzado && Math.abs(dy) >= altoPlanta;
}

/** Fila (px) donde se dibuja `r` en `nivel`, con el borde superior y la separación ya aplicados. */
export function yDibujada(r: RectEtiqueta, nivel: number, o: OpcionesApilado): number {
  const paso = r.alto * (1 + (o.separacion ?? 0));
  const tope = o.tope ?? -Infinity;
  return r.abajo ? Math.max(r.y, tope) + nivel * paso : r.y - nivel * paso;
}

/**
 * Reparte las etiquetas para que no se encimen: las forzadas primero y luego por cercanía (con la
 * ventaja de quien ya iba arriba), cada una sube de a una altura propia (más `separacion`) hasta quedar
 * libre; si arriba no caben `maxNiveles` alturas antes del `tope`, baja. Una normal que pasa de
 * `maxNiveles` se descarta; una forzada nunca. Deja en `salida` (la vacía antes) el nivel de cada
 * etiqueta mostrada; las ausentes quedan descartadas. Ordena `rects` en el lugar y marca `abajo`.
 * `previos` es la `salida` del cuadro anterior y no puede ser el mismo mapa.
 */
export function apilarEtiquetas(
  rects: RectEtiqueta[],
  opciones: OpcionesApilado,
  previos: ReadonlyMap<string, number>,
  salida: Map<string, number>,
): void {
  salida.clear();
  const clave = (r: RectEtiqueta) => r.distancia + (previos.get(r.id) ?? 0) * opciones.ventaja;
  rects.sort((a, b) => Number(b.forzada) - Number(a.forzada) || clave(a) - clave(b));
  const tope = opciones.tope ?? -Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    const paso = r.alto * (1 + (opciones.separacion ?? 0));
    r.abajo = r.y - opciones.maxNiveles * paso < tope;
    let nivel = 0;
    if (r.forzada && opciones.altoPantalla !== undefined) {
      let colocado = false;
      const maximo = Math.ceil(opciones.altoPantalla / paso);
      for (let candidato = 0; candidato <= maximo && !colocado; candidato++) {
        for (const abajo of [false, true]) {
          r.abajo = abajo;
          const y = yDibujada(r, candidato, opciones);
          if (y < tope + r.alto / 2 || y > opciones.altoPantalla - r.alto / 2) continue;
          if (!choca(r, candidato, rects, i, salida, opciones)) {
            salida.set(r.id, candidato);
            colocado = true;
            break;
          }
        }
      }
      if (colocado) continue;
      r.abajo = r.y - opciones.maxNiveles * paso < tope;
    }
    while (choca(r, nivel, rects, i, salida, opciones)) {
      nivel++;
      if (!r.forzada && nivel > opciones.maxNiveles) {
        nivel = -1;
        break;
      }
    }
    if (nivel >= 0) salida.set(r.id, nivel);
  }
}

/** ¿`r`, en `nivel`, pisa (o queda sin el aire pedido) a alguna de las `hasta` primeras ya colocadas? */
function choca(
  r: RectEtiqueta,
  nivel: number,
  rects: readonly RectEtiqueta[],
  hasta: number,
  colocadas: ReadonlyMap<string, number>,
  opciones: OpcionesApilado,
): boolean {
  const y = yDibujada(r, nivel, opciones);
  const aire = 1 + (opciones.separacion ?? 0);
  for (let j = 0; j < hasta; j++) {
    const o = rects[j]!;
    const nivelO = colocadas.get(o.id);
    if (nivelO === undefined) continue;
    if (
      Math.abs(r.x - o.x) < (r.ancho + o.ancho) / 2 &&
      Math.abs(y - yDibujada(o, nivelO, opciones)) < ((r.alto + o.alto) / 2) * aire - 1e-6
    ) {
      return true;
    }
  }
  return false;
}
