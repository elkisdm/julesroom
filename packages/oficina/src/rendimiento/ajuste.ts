import type { NivelCalidad } from './calidad';

export interface PerfilNivel {
  dprMax: number;
  dprMin: number;
  sombras: boolean;
  distanciaLod: number;
  maxEtiquetas: number;
  /** Metros a la cámara más allá de los cuales no se rotula (salvo seleccionado y quien habla). */
  distanciaEtiquetas: number;
  /** Luz de contorno / rampa. */
  volumen: boolean;
  anisotropia: number;
}

export interface ConfigAjuste {
  perfiles: Record<NivelCalidad, PerfilNivel>;
  /** p95 (ms) por encima del cual se baja la resolución. */
  presupuestoMs: number;
  /** Se sube la resolución cuando p95 < presupuestoMs - holguraMs. */
  holguraMs: number;
  muestrasMinimas: number;
  pasoDpr: number;
  /** Muestreos (≈ 0,5 s c/u) sin subir la resolución después de haberla bajado, para no oscilar. */
  enfriamientoSubida: number;
  /** Muestreos (≈ 0,5 s c/u) iniciales sin decidir nada: compilar y subir texturas pierde cuadros que no son del equipo. */
  graciaInicial: number;
}

export const CONFIG_AJUSTE_INICIAL: ConfigAjuste = {
  perfiles: {
    alta: {
      dprMax: 2,
      dprMin: 1,
      sombras: true,
      distanciaLod: 24,
      maxEtiquetas: 40,
      distanciaEtiquetas: 22,
      volumen: true,
      anisotropia: 8,
    },
    media: {
      dprMax: 1.5,
      dprMin: 1,
      sombras: false,
      distanciaLod: 16,
      maxEtiquetas: 20,
      distanciaEtiquetas: 16,
      volumen: true,
      anisotropia: 4,
    },
    baja: {
      dprMax: 1,
      dprMin: 0.75,
      sombras: false,
      distanciaLod: 10,
      maxEtiquetas: 8,
      distanciaEtiquetas: 10,
      volumen: false,
      anisotropia: 2,
    },
  },
  presupuestoMs: 12,
  holguraMs: 3,
  muestrasMinimas: 90,
  pasoDpr: 0.25,
  enfriamientoSubida: 40,
  graciaInicial: 16,
};

export interface Equipo {
  nucleos: number;
  memoriaGb?: number;
  dpr: number;
  tactil: boolean;
  anchoPx: number;
}

export function nivelInicialPorEquipo(e: Equipo): NivelCalidad {
  const memoria = e.memoriaGb ?? 4;
  if (e.tactil || e.anchoPx < 600) {
    return e.nucleos >= 8 && memoria >= 6 ? 'media' : 'baja';
  }
  if (e.nucleos >= 8) return 'alta';
  if (e.nucleos >= 4) return 'media';
  return 'baja';
}

export interface ControladorDpr {
  readonly dpr: number;
  /** Mientras es `true` no se decide nada (arranque). */
  readonly enGracia: boolean;
  muestrear(p95Ms: number, muestras: number): number;
  cambiarNivel(n: NivelCalidad): void;
}

/**
 * Controlador de resolución continua: un escalón de `pasoDpr` por llamada, con histéresis
 * entre `presupuestoMs - holguraMs` y `presupuestoMs`. `dprDispositivo` (opcional) topa el máximo.
 */
export function crearControladorDpr(
  cfg: ConfigAjuste,
  nivel: NivelCalidad,
  dprDispositivo = Infinity,
): ControladorDpr {
  const paso = cfg.pasoDpr;
  const cuantizar = (v: number) => Math.round(v / paso) * paso;
  let actual = nivel;
  let dpr = 0;
  let espera = 0;
  let gracia = cfg.graciaInicial;

  const limites = () => {
    const p = cfg.perfiles[actual];
    const max = cuantizar(Math.min(p.dprMax, dprDispositivo));
    return { max, min: Math.min(cuantizar(p.dprMin), max) };
  };
  const encuadrar = (v: number) => {
    const { min, max } = limites();
    return cuantizar(Math.min(max, Math.max(min, v)));
  };
  dpr = limites().max;

  return {
    get dpr() {
      return dpr;
    },
    get enGracia() {
      return gracia > 0;
    },
    muestrear(p95Ms, muestras) {
      if (gracia > 0) {
        gracia--;
        return dpr;
      }
      if (muestras < cfg.muestrasMinimas) return dpr;
      if (espera > 0) espera--;
      if (p95Ms > cfg.presupuestoMs) {
        const anterior = dpr;
        dpr = encuadrar(dpr - paso);
        if (dpr !== anterior) espera = cfg.enfriamientoSubida;
      } else if (p95Ms < cfg.presupuestoMs - cfg.holguraMs && espera === 0) {
        dpr = encuadrar(dpr + paso);
      }
      return dpr;
    },
    cambiarNivel(n) {
      actual = n;
      dpr = encuadrar(dpr);
    },
  };
}

const ORDEN: NivelCalidad[] = ['alta', 'media', 'baja'];

/** Baja de nivel si ya no queda resolución que recortar; sube si ya no queda que ganar. */
export function proponerNivel(
  cfg: ConfigAjuste,
  nivelActual: NivelCalidad,
  dprActual: number,
  p95Ms: number,
  muestras: number,
): NivelCalidad {
  if (muestras < cfg.muestrasMinimas) return nivelActual;
  const i = ORDEN.indexOf(nivelActual);
  const perfil = cfg.perfiles[nivelActual];
  if (dprActual <= perfil.dprMin && p95Ms > cfg.presupuestoMs) {
    return ORDEN[Math.min(i + 1, ORDEN.length - 1)] ?? nivelActual;
  }
  if (dprActual >= perfil.dprMax && p95Ms < cfg.presupuestoMs - cfg.holguraMs) {
    return ORDEN[Math.max(i - 1, 0)] ?? nivelActual;
  }
  return nivelActual;
}
