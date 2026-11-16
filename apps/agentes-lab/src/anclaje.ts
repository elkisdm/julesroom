/** Dónde va una burbuja anclada a la cabeza de un agente proyectada en pantalla. Lógica pura (píxeles). */

export interface Cabeza {
  x: number;
  y: number;
  visible: boolean;
}

export const PARAMETROS_ANCLAJE = {
  /** Margen mínimo con los bordes de la ventana (px). */
  margen: 12,
  /** Espacio entre la cabeza y la burbuja (px): la burbuja nunca la cubre. */
  hueco: 52,
  /** Radio (px) que se reserva alrededor de la cabeza proyectada. */
  radioCabeza: 44,
  /** Lo que se deja de cola con el borde de la burbuja (px). */
  esquina: 20,
  /** Mejora mínima (px² de intersección) para cambiar de lado al evitar el avatar: evita el parpadeo. */
  histeresisArea: 40,
} as const;

/** Caja del avatar propio en pantalla (valores iniciales parametrizables). */
export const PARAMETROS_AVATAR = {
  /** Altura del avatar sobre sus pies (m), para proyectar la cabeza. */
  altura: 1.9,
  /** Medio ancho como fracción de la altura en píxeles. */
  anchoRelativo: 0.28,
  /** Holgura alrededor de la caja (px). */
  holgura: 24,
  /** Extra por debajo de los pies para el aro del piso (px). */
  aro: 18,
} as const;

export type Lado = 'arriba' | 'tope' | 'abajo' | 'derecha' | 'izquierda' | 'borde';

export interface Ubicacion {
  /** Esquina superior izquierda de la burbuja. */
  x: number;
  y: number;
  lado: Lado;
  /** Posición de la cola sobre el borde de la burbuja (px desde la esquina superior o izquierda). */
  cola: number;
  /** Con `lado: 'borde'`: hacia dónde apunta la flecha (rad, 0 = derecha, sentido horario en pantalla). */
  angulo: number;
}

const limitar = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), Math.max(min, max));

/**
 * Con `extra.evitar` (rectángulos en píxeles) elige el primer lado, en el orden anterior, que no los cruce; si
 * ninguno queda libre, el de menor intersección. `extra.ladoPrevio` da histéresis entre cuadros.
 *
 * Ubica una burbuja de `ancho` × `alto` (su alto real) sobre la cabeza del agente. `altoMax` es lo más alto que
 * puede llegar a ser: con él se decide el lado, para que no salte de arriba al costado mientras crece el texto.
 * Arriba de la cabeza si cabe; si no, a un costado sin cubrirla; si tampoco, debajo. Fuera de pantalla (o
 * detrás de la cámara) se ancla al borde más cercano con una flecha hacia el agente.
 */
export function ubicarBurbuja(
  cabeza: Cabeza,
  tam: { ancho: number; alto: number; altoMax?: number },
  ventana: { ancho: number; alto: number },
  p: typeof PARAMETROS_ANCLAJE = PARAMETROS_ANCLAJE,
  extra: { evitar?: readonly Rect[]; ladoPrevio?: Lado; reservaAbajo?: number } = {},
): Ubicacion {
  const { ancho, alto } = tam;
  const altoMax = Math.max(tam.altoMax ?? alto, alto);
  const m = p.margen;
  const maxX = ventana.ancho - m - ancho;
  const maxY = ventana.alto - (extra.reservaAbajo ?? 0) - m - alto;

  const dentro =
    cabeza.visible &&
    cabeza.x >= 0 &&
    cabeza.x <= ventana.ancho &&
    cabeza.y >= 0 &&
    cabeza.y <= ventana.alto;

  if (!dentro) {
    const cx = ventana.ancho / 2;
    const cy = ventana.alto / 2;
    // Detrás de la cámara la proyección se invierte: se apunta al lado contrario.
    const signo = cabeza.visible ? 1 : -1;
    const dx = (cabeza.x - cx) * signo || 0;
    const dy = (cabeza.y - cy) * signo || -1;
    const angulo = Math.atan2(dy, dx);
    // Punto del borde de la ventana (con margen) por donde sale la recta centro → agente.
    const medioX = ventana.ancho / 2 - m;
    const medioY = ventana.alto / 2 - m;
    const t = Math.min(
      dx === 0 ? Infinity : medioX / Math.abs(dx),
      dy === 0 ? Infinity : medioY / Math.abs(dy),
    );
    const px = cx + dx * t;
    const py = cy + dy * t;
    return {
      x: limitar(px - ancho / 2, m, maxX),
      y: limitar(py - alto / 2, m, maxY),
      lado: 'borde',
      cola: 0,
      angulo,
    };
  }

  const colaH = (izq: number) => limitar(cabeza.x - izq, p.esquina, ancho - p.esquina);
  const colaV = (arr: number) => limitar(cabeza.y - arr, p.esquina, alto - p.esquina);
  const base = { angulo: 0 };
  const separacion = p.radioCabeza + 12;
  const yLado = limitar(cabeza.y - alto / 2, m, maxY);
  const xCentro = limitar(cabeza.x - ancho / 2, m, maxX);

  // Candidatos en orden de preferencia. Arriba y los costados solo si caben; debajo siempre (ventana angosta).
  const candidatos: Ubicacion[] = [];
  // Arriba: cabe si, con el alto máximo, queda bajo el margen superior.
  if (cabeza.y - p.hueco - altoMax >= m) {
    candidatos.push({
      ...base,
      x: xCentro,
      y: cabeza.y - p.hueco - alto,
      lado: 'arriba',
      cola: colaH(xCentro),
    });
  }
  // Al costado, a la altura de la cabeza, sin cubrirla.
  if (cabeza.x + separacion + ancho <= ventana.ancho - m) {
    candidatos.push({
      ...base,
      x: cabeza.x + separacion,
      y: yLado,
      lado: 'derecha',
      cola: colaV(yLado),
    });
  }
  if (cabeza.x - separacion - ancho >= m) {
    candidatos.push({
      ...base,
      x: cabeza.x - separacion - ancho,
      y: yLado,
      lado: 'izquierda',
      cola: colaV(yLado),
    });
  }
  // Tope: solo sin costados posibles; pegada al margen superior y centrada sobre el agente (móvil, sin costados). Con el alto máximo no
  // debe cubrir la cabeza; la cola apunta hacia abajo, al agente.
  const haySitioLateral = candidatos.some((u) => u.lado === 'derecha' || u.lado === 'izquierda');
  if (!haySitioLateral && m + altoMax + p.radioCabeza <= cabeza.y) {
    candidatos.push({ ...base, x: xCentro, y: m, lado: 'tope', cola: colaH(xCentro) });
  }
  candidatos.push({
    ...base,
    x: xCentro,
    y: limitar(cabeza.y + p.radioCabeza + 12, m, maxY),
    lado: 'abajo',
    cola: colaH(xCentro),
  });

  const evitar = extra.evitar ?? [];
  const primero = candidatos[0] as Ubicacion;
  if (evitar.length === 0) return primero;

  const area = (u: Ubicacion) =>
    evitar.reduce((suma, r) => suma + interseccion({ x: u.x, y: u.y, ancho, alto }, r), 0);
  const areas = candidatos.map(area);
  let mejor = 0;
  for (let i = 1; i < candidatos.length && areas[mejor] !== 0; i++) {
    if ((areas[i] as number) < (areas[mejor] as number)) mejor = i;
  }
  // Histéresis: se conserva el lado previo mientras esté libre o la alternativa no mejore lo suficiente.
  const previo = candidatos.findIndex((u) => u.lado === extra.ladoPrevio);
  if (previo >= 0 && (areas[previo] as number) - (areas[mejor] as number) <= p.histeresisArea) {
    mejor = previo;
  }
  return candidatos[mejor] as Ubicacion;
}

/** Alto máximo de la burbuja: 46 % de la ventana (tope 340 px); a ≤ 560 px de ancho, 38 % del alto sin el compositor. */
export function altoMaximoBurbuja(alto: number, ancho: number, reservaAbajo: number): number {
  return ancho <= 560 ? (alto - reservaAbajo) * 0.38 : Math.min(alto * 0.46, 340);
}

export interface Rect {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Área (px²) de la intersección de dos rectángulos. */
export function interseccion(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Caja en pantalla del avatar propio a partir de la proyección de sus pies y su cabeza; incluye el aro del piso. */
export function rectAvatar(
  pies: { x: number; y: number },
  cabeza: { x: number; y: number },
  p: typeof PARAMETROS_AVATAR = PARAMETROS_AVATAR,
): Rect {
  const altura = Math.abs(pies.y - cabeza.y);
  const medio = altura * p.anchoRelativo;
  const x = Math.min(pies.x, cabeza.x) - medio - p.holgura;
  const arriba = Math.min(pies.y, cabeza.y) - p.holgura;
  const abajo = Math.max(pies.y, cabeza.y) + p.holgura + p.aro;
  return {
    x,
    y: arriba,
    ancho: Math.abs(pies.x - cabeza.x) + 2 * (medio + p.holgura),
    alto: abajo - arriba,
  };
}
