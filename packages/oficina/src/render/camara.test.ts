import { afterEach, describe, expect, it } from 'vitest';
import { encenderTodo, fijarOpciones } from '../animacion/opciones';
import { escenarioMansion } from '../escenarios/mansion';
import { escenarioTrading } from '../escenarios/trading';
import { SALA, zMuroLed } from '../escenarios/trading/plano';
import type { Caja3, Vistas } from '../escenarios/tipos';
import {
  avanzarCamara,
  avanzarSeguimiento,
  crearSeguimiento,
  PARAMETROS_SEGUIMIENTO,
  derivarAzimut,
  desplazamientoDe,
  leerOrbita,
  normalizarAngulo,
  DISTANCIA_FOCO,
  DISTANCIA_PERSONA,
  encuadreAmbiente,
  distanciaSeguirPara,
  encuadreCasa,
  encuadreGeneral,
  encuadreInicial,
  FOV_VERTICAL,
  puntoOrbeEncuadre,
} from './camara';
import type {
  Encuadre,
  EntradaSeguimiento,
  EstadoCamara,
  EstadoSeguimiento,
  Punto3,
} from './camara';
import {
  AZIMUT_AMBIENTE,
  ELEVACION_AMBIENTE_MAX,
  ELEVACION_GRADOS,
  ELEVACION_INICIAL,
} from './orbita';

const enBlanco = (): EstadoCamara => ({
  activo: false,
  x: 0,
  y: 0,
  z: 0,
  distancia: 1,
  azimut: 0,
  elevacion: 0,
  clave: null,
  reorientar: false,
});

/** Proyecta un punto del mundo a coordenadas normalizadas de pantalla (-1..1) para un encuadre. */
function proyectar(e: Encuadre, p: Punto3, ancho: number, alto: number) {
  const f = {
    x: e.objetivo.x - e.posicion.x,
    y: e.objetivo.y - e.posicion.y,
    z: e.objetivo.z - e.posicion.z,
  };
  const largo = Math.hypot(f.x, f.y, f.z);
  const fx = f.x / largo;
  const fy = f.y / largo;
  const fz = f.z / largo;
  // right = f × up(0,1,0) = (-fz, 0, fx), normalizada; up = right × f.
  const rl = Math.hypot(fz, fx);
  const rx = -fz / rl;
  const rz = fx / rl;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  const rel = { x: p.x - e.posicion.x, y: p.y - e.posicion.y, z: p.z - e.posicion.z };
  const profundo = rel.x * fx + rel.y * fy + rel.z * fz;
  const tanV = Math.tan((FOV_VERTICAL * Math.PI) / 360);
  const tanH = tanV * (ancho / alto);
  return {
    x: (rel.x * rx + rel.z * rz) / profundo / tanH,
    y: (rel.x * ux + rel.y * uy + rel.z * uz) / profundo / tanV,
    profundo,
  };
}

const esquinas = (
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): Punto3[] => [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z) => ({ x, y, z }))));

describe('encuadreCasa', () => {
  it.each([
    [1440, 900],
    [1280, 720],
    [390, 844],
    [320, 640],
    [900, 1000],
  ])('la casa completa (torre y piscina incluidas) cabe con margen en %i×%i', (w, h) => {
    const e = encuadreCasa(w, h);
    for (const p of esquinas(-16, 16, -4, 15.5, -4, 10)) {
      const s = proyectar(e, p, w, h);
      expect(s.profundo).toBeGreaterThan(0);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(0.96);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(0.96);
    }
  });

  it('mira de frente (desde +z), elevada ~14° y centrada en x', () => {
    const e = encuadreCasa(1440, 900);
    expect(e.posicion.x).toBeCloseTo(0, 6);
    expect(e.objetivo.x).toBeCloseTo(0, 6);
    expect(e.posicion.z).toBeGreaterThan(e.objetivo.z);
    const elevacion = Math.atan2(e.posicion.y - e.objetivo.y, e.posicion.z - e.objetivo.z);
    expect((elevacion * 180) / Math.PI).toBeCloseTo(ELEVACION_GRADOS, 4);
    expect(Math.hypot(e.posicion.y - e.objetivo.y, e.posicion.z - e.objetivo.z)).toBeCloseTo(
      e.distancia,
      6,
    );
  });

  it('en retrato la cámara se aleja más que en paisaje (encuadre por ancho)', () => {
    expect(encuadreCasa(390, 844).distancia).toBeGreaterThan(encuadreCasa(1440, 900).distancia);
  });

  it('en retrato la casa ocupa casi todo el ancho', () => {
    const e = encuadreCasa(390, 844);
    const borde = proyectar(e, { x: 16, y: 5, z: 4 }, 390, 844);
    expect(borde.x).toBeGreaterThan(0.8);
  });
});

/** Base de la casa por el frente, donde empieza el terreno visible. */
const BASE_CASA = { y: -2, z: 9 };

/** Altura en pantalla (NDC, −1 abajo) de un punto visto desde un encuadre. */
function proyectarNdcY(e: Encuadre, fovGrados: number, p: Punto3): number {
  const dx = e.objetivo.x - e.posicion.x;
  const dy = e.objetivo.y - e.posicion.y;
  const dz = e.objetivo.z - e.posicion.z;
  const n = Math.hypot(dx, dy, dz);
  const fx = dx / n;
  const fy = dy / n;
  const fz = dz / n;
  // arriba = (0, cos, -sen) respecto de la elevación de la cámara: mismo plano vertical.
  const h = Math.hypot(fy, fz);
  const uy = h === 0 ? 1 : -fz / h;
  const uz = h === 0 ? 0 : fy / h;
  const rx = p.x - e.posicion.x;
  const ry = p.y - e.posicion.y;
  const rz = p.z - e.posicion.z;
  const profundidad = rx * fx + ry * fy + rz * fz;
  const vertical = ry * uy + rz * uz;
  return vertical / (profundidad * Math.tan((fovGrados * Math.PI) / 360));
}

describe('encuadreInicial', () => {
  it('en horizontal es la casa entera, como siempre', () => {
    expect(encuadreInicial(1440, 900)).toEqual(encuadreCasa(1440, 900));
  });

  it('en vertical se acerca y se centra en la casa en vez de mostrarla entera y chica', () => {
    const entera = encuadreCasa(390, 844);
    const e = encuadreInicial(390, 844);
    expect(e.distancia).toBeLessThan(entera.distancia * 0.75);
    expect(e.objetivo.x).toBeCloseTo(0, 6);
    // El punto de mira sube para que el terreno de delante no ocupe media pantalla.
    expect(e.objetivo.y).toBeGreaterThan(0);
  });

  it('un nivel más alto sube el punto de mira', () => {
    expect(encuadreInicial(390, 844, 3.9).objetivo.y).toBeGreaterThan(
      encuadreInicial(390, 844, 0).objetivo.y + 3,
    );
  });

  it('el terreno bajo la casa no pasa de ~15 % del alto de la pantalla', () => {
    for (const [w, h] of [
      [390, 844],
      [412, 915],
      [320, 640],
    ] as const) {
      const e = encuadreInicial(w, h);
      const ndc = proyectarNdcY(e, FOV_VERTICAL, { x: 0, y: BASE_CASA.y, z: BASE_CASA.z });
      // ndc −1 es el borde inferior: el terreno ocupa (1 + ndc) / 2 del alto.
      expect((1 + ndc) / 2, `${w}x${h}`).toBeLessThanOrEqual(0.17);
      expect((1 + ndc) / 2, `${w}x${h}`).toBeGreaterThanOrEqual(0.05);
    }
  });

  it('el desplazamiento mantiene el eje central de la casa y la distancia por ancho', () => {
    const e = encuadreInicial(390, 844);
    expect(e.posicion.x).toBeCloseTo(0, 6);
    expect(e.distancia).toBeGreaterThan(40);
  });

  it('una pantalla casi cuadrada sigue viendo la casa entera', () => {
    expect(encuadreInicial(900, 900)).toEqual(encuadreCasa(900, 900));
  });
});

describe('distanciaSeguirPara', () => {
  it('en horizontal no cambia', () => {
    expect(distanciaSeguirPara(16 / 9)).toBeCloseTo(PARAMETROS_SEGUIMIENTO.distanciaSeguir, 6);
  });
  it('en vertical se aleja para que se vea algo más que el avatar, con tope', () => {
    expect(distanciaSeguirPara(390 / 844)).toBeGreaterThan(
      PARAMETROS_SEGUIMIENTO.distanciaSeguir * 1.5,
    );
    expect(distanciaSeguirPara(0.1)).toBeLessThanOrEqual(
      PARAMETROS_SEGUIMIENTO.distanciaSeguir * 2.2 + 1e-9,
    );
  });
});

describe('encuadreAmbiente', () => {
  const ventas = { x0: 4, x1: 16, z0: -4, z1: 4, y: 3.9, alto: 3.6 };

  it('apunta al centro del ambiente', () => {
    const e = encuadreAmbiente(ventas, 1440, 900);
    expect(e.objetivo.x).toBeCloseTo(10, 6);
    expect(e.objetivo.y).toBeGreaterThan(3.9);
    expect(e.objetivo.y).toBeLessThan(7.5);
  });

  it.each([
    [1440, 900],
    [390, 844],
  ])('el ambiente cabe y llena la pantalla en %i×%i', (w, h) => {
    const e = encuadreAmbiente(ventas, w, h);
    const lleno = esquinas(4, 16, 3.9, 7.5, 4, 4).map((p) => proyectar(e, p, w, h));
    const maxX = Math.max(...lleno.map((s) => Math.abs(s.x)));
    const maxY = Math.max(...lleno.map((s) => Math.abs(s.y)));
    expect(maxX).toBeLessThanOrEqual(1);
    expect(Math.max(maxX, maxY)).toBeGreaterThan(0.8);
  });

  it('queda mucho más cerca que la casa completa', () => {
    expect(encuadreAmbiente(ventas, 1440, 900).distancia).toBeLessThan(
      encuadreCasa(1440, 900).distancia / 2,
    );
  });

  it('una terraza sin techo (alto 0) también se encuadra', () => {
    const e = encuadreAmbiente({ x0: -16, x1: 16, z0: 4, z1: 10, y: 0, alto: 0 }, 1440, 900);
    expect(Number.isFinite(e.distancia)).toBe(true);
    expect(e.distancia).toBeGreaterThan(5);
  });
});

describe('avanzarCamara', () => {
  const casa: Encuadre = {
    posicion: { x: 0, y: 20, z: 80 },
    objetivo: { x: 0, y: 6, z: 3 },
    distancia: 80,
  };
  const sala: Encuadre = {
    posicion: { x: 10, y: 8, z: 20 },
    objetivo: { x: 10, y: 5.7, z: 0 },
    distancia: 20,
  };
  const enReposo = (): EstadoCamara => ({
    activo: false,
    x: casa.objetivo.x,
    y: casa.objetivo.y,
    z: casa.objetivo.z,
    distancia: casa.distancia,
    azimut: 0,
    elevacion: ELEVACION_INICIAL,
    clave: casa,
    reorientar: false,
  });
  const paso = (e: EstadoCamara, extra: Partial<Parameters<typeof avanzarCamara>[1]> = {}) =>
    avanzarCamara(e, { dt: 0.016, casa, ambiente: null, foco: null, enfocado: null, ...extra });
  const correr = (e: EstadoCamara, n: number, extra = {}) => {
    for (let i = 0; i < n; i++) paso(e, extra);
  };

  it('con una vista elegida, la persona enfocada se encuadra con ese azimut, elevación y distancia', () => {
    const e = enReposo();
    const vista = { azimut: 0.8, elevacion: 0.4, distancia: 3 };
    correr(e, 600, { enfocado: { x: 1, y: 0, z: 2 }, vista });
    expect(e.azimut).toBeCloseTo(0.8, 2);
    expect(e.elevacion).toBeCloseTo(0.4, 2);
    expect(e.distancia).toBeCloseTo(3, 2);
  });

  it('sin vista, la distancia a la persona sigue siendo la de siempre', () => {
    const e = enReposo();
    correr(e, 600, { enfocado: { x: 1, y: 0, z: 2 } });
    expect(e.distancia).toBeCloseTo(DISTANCIA_PERSONA, 2);
  });

  it('en reposo sobre la casa no toca nada: la órbita es del usuario', () => {
    const e = enReposo();
    paso(e);
    expect(e).toEqual(enReposo());
  });

  it('avisa si movió el estado: no en reposo, sí en cada paso y en el último', () => {
    const e = enReposo();
    expect(avanzarCamara(e, { dt: 0.016, casa, ambiente: null, foco: null, enfocado: null })).toBe(
      false,
    );
    expect(avanzarCamara(e, { dt: 0.016, casa, ambiente: sala, foco: null, enfocado: null })).toBe(
      true,
    );
    // Con movimiento reducido llega y se desactiva en el mismo paso, y aun así hay que aplicarlo.
    const rapido = enReposo();
    expect(
      avanzarCamara(rapido, {
        dt: 0.016,
        casa,
        ambiente: sala,
        foco: null,
        enfocado: null,
        instantaneo: true,
      }),
    ).toBe(true);
    expect(rapido.activo).toBe(false);
  });

  it('al activar un ambiente se acerca de a poco, sin pasarse', () => {
    const e = enReposo();
    paso(e, { ambiente: sala, dt: 0.1 });
    expect(e.activo).toBe(true);
    expect(e.distancia).toBeLessThan(80);
    expect(e.distancia).toBeGreaterThan(20);
    expect(e.x).toBeGreaterThan(0);
    expect(e.x).toBeLessThan(10);
  });

  it('converge al ambiente y se desactiva al llegar', () => {
    const e = enReposo();
    correr(e, 600, { ambiente: sala });
    expect(e.distancia).toBeCloseTo(20, 1);
    expect(e.x).toBeCloseTo(10, 1);
    expect(e.y).toBeCloseTo(5.7, 1);
    expect(e.activo).toBe(false);
  });

  it('al salir (ambiente null) vuelve a la casa', () => {
    const e = enReposo();
    correr(e, 600, { ambiente: sala });
    correr(e, 600);
    expect(e.distancia).toBeCloseTo(80, 1);
    expect(e.x).toBeCloseTo(0, 1);
    expect(e.z).toBeCloseTo(3, 1);
    expect(e.activo).toBe(false);
  });

  it('la persona enfocada manda sobre el ambiente: apunta a su cabeza y se queda activa', () => {
    const e = enReposo();
    const persona: Punto3 = { x: 4, y: 3.9, z: -2 };
    correr(e, 600, { ambiente: sala, enfocado: persona });
    expect(e.distancia).toBeCloseTo(DISTANCIA_PERSONA, 1);
    expect(e.x).toBeCloseTo(4, 1);
    expect(e.y).toBeGreaterThan(3.9 + 0.8);
    expect(e.y).toBeLessThan(3.9 + 1.6);
    expect(e.z).toBeCloseTo(-2, 1);
    expect(e.activo).toBe(true);
  });

  it('sigue a la persona cuando se mueve', () => {
    const e = enReposo();
    const persona: Punto3 = { x: 4, y: 0, z: 0 };
    correr(e, 300, { enfocado: persona });
    persona.x = -6;
    correr(e, 300, { enfocado: persona });
    expect(e.x).toBeCloseTo(-6, 1);
  });

  it('con movimiento reducido (instantáneo) llega en un solo paso', () => {
    const e = enReposo();
    paso(e, { ambiente: sala, instantaneo: true });
    expect(e.distancia).toBeCloseTo(20, 6);
    expect(e.x).toBeCloseTo(10, 6);
    paso(e, { ambiente: sala, instantaneo: true });
    expect(e.activo).toBe(false);
  });

  it('un dt enorme no se pasa del objetivo', () => {
    const e = enReposo();
    paso(e, { ambiente: sala, dt: 5 });
    expect(e.distancia).toBeCloseTo(20, 6);
  });

  it('un cambio de tamaño de pantalla (casa nueva) reencuadra', () => {
    const e = enReposo();
    const otra: Encuadre = { ...casa, distancia: 150 };
    paso(e, { casa: otra, dt: 0.1 });
    expect(e.activo).toBe(true);
    expect(e.distancia).toBeGreaterThan(80);
  });

  describe('enfoque por doble toque', () => {
    const punto: Punto3 = { x: -8, y: 1, z: 2 };

    it('el punto pasa a ser el centro de la órbita y la cámara se acerca', () => {
      const e = enReposo();
      correr(e, 600, { foco: punto });
      expect(e.x).toBeCloseTo(-8, 1);
      expect(e.y).toBeCloseTo(1, 1);
      expect(e.z).toBeCloseTo(2, 1);
      expect(e.distancia).toBeCloseTo(DISTANCIA_FOCO, 1);
      expect(e.activo).toBe(false);
    });

    it('no aleja la cámara si ya estaba más cerca que la distancia de enfoque', () => {
      const e = { ...enReposo(), distancia: 6 };
      correr(e, 600, { foco: punto });
      expect(e.distancia).toBeCloseTo(6, 1);
    });

    it('un punto nuevo (otra referencia) reinicia el viaje', () => {
      const e = enReposo();
      correr(e, 600, { foco: punto });
      paso(e, { foco: { x: 5, y: 1, z: 0 } });
      expect(e.activo).toBe(true);
    });

    it('mantiene la dirección de la cámara que tenía el usuario', () => {
      const e = { ...enReposo(), azimut: 2.5, elevacion: 0.5 };
      correr(e, 600, { foco: punto });
      expect(e.azimut).toBeCloseTo(2.5, 2);
      expect(e.elevacion).toBeCloseTo(0.5, 2);
    });
  });

  describe('dirección', () => {
    it('en la casa completa la órbita libre de 360° no se toca', () => {
      const e = { ...enReposo(), azimut: 3, elevacion: 0.9, activo: true };
      correr(e, 300);
      expect(e.azimut).toBeCloseTo(3, 2);
      expect(e.elevacion).toBeCloseTo(0.9, 2);
    });

    it('al entrar a un ambiente desde atrás da la vuelta por el camino corto hasta el límite', () => {
      const e = { ...enReposo(), azimut: 3.0, elevacion: 0.3 };
      let maxAbs = 0;
      for (let i = 0; i < 800; i++) {
        paso(e, { ambiente: sala });
        maxAbs = Math.max(maxAbs, Math.abs(normalizarAngulo(e.azimut)));
      }
      // 3.0 rad (172°) está detrás: el límite más cercano es +40° y no cruza por el frente.
      expect(normalizarAngulo(e.azimut)).toBeCloseTo(AZIMUT_AMBIENTE, 2);
      expect(maxAbs).toBeLessThanOrEqual(3.0 + 1e-6);
    });

    it('da la vuelta por el lado más corto aunque el ángulo pase de π', () => {
      // 3.5 rad equivale a -2.78 rad: el límite más cercano es -40° y no hay que cruzar el frente.
      const e = { ...enReposo(), azimut: 3.5, elevacion: 0.3 };
      let maxPositivo = -Infinity;
      for (let i = 0; i < 800; i++) {
        paso(e, { ambiente: sala });
        maxPositivo = Math.max(maxPositivo, normalizarAngulo(e.azimut));
      }
      expect(maxPositivo).toBeLessThanOrEqual(1e-6);
      expect(normalizarAngulo(e.azimut)).toBeCloseTo(-AZIMUT_AMBIENTE, 2);
    });

    it('dentro de un ambiente la elevación se acota a su rango', () => {
      const e = { ...enReposo(), elevacion: 1.1 };
      correr(e, 800, { ambiente: sala });
      expect(e.elevacion).toBeCloseTo(ELEVACION_AMBIENTE_MAX, 2);
    });

    it('reorientar (vista general) vuelve al frente y a la elevación inicial', () => {
      const e = { ...enReposo(), azimut: -2, elevacion: 1, reorientar: true };
      correr(e, 800);
      expect(e.azimut).toBeCloseTo(0, 2);
      expect(e.elevacion).toBeCloseTo(ELEVACION_INICIAL, 2);
      expect(e.reorientar).toBe(false);
      expect(e.activo).toBe(false);
    });
  });
});

describe('órbita <-> estado', () => {
  it('leerOrbita y desplazamientoDe son inversas', () => {
    const e = enBlanco();
    leerOrbita(e, 10, 6, -12);
    const d = desplazamientoDe(e, { x: 0, y: 0, z: 0 });
    expect(d.x).toBeCloseTo(10, 9);
    expect(d.y).toBeCloseTo(6, 9);
    expect(d.z).toBeCloseTo(-12, 9);
  });

  it('desde el frente el azimut es 0 y desde el este π/2', () => {
    const e = enBlanco();
    leerOrbita(e, 0, 5, 20);
    expect(e.azimut).toBeCloseTo(0, 9);
    leerOrbita(e, 20, 5, 0);
    expect(e.azimut).toBeCloseTo(Math.PI / 2, 9);
  });

  it('justo sobre el punto de mira conserva el azimut anterior (cenital sin NaN)', () => {
    const e = { ...enBlanco(), azimut: 1.2 };
    leerOrbita(e, 0, 10, 0);
    expect(e.azimut).toBeCloseTo(1.2, 9);
    expect(Number.isNaN(e.elevacion)).toBe(false);
  });
});

describe('normalizarAngulo', () => {
  it.each([
    [0, 0],
    [Math.PI * 1.5, -Math.PI / 2],
    [-Math.PI * 1.5, Math.PI / 2],
    [Math.PI * 5, Math.PI],
  ])('%f -> %f', (entrada, esperado) => {
    expect(normalizarAngulo(entrada)).toBeCloseTo(esperado, 9);
  });
});

describe('puntoOrbeEncuadre', () => {
  const cabeza: Punto3 = { x: 4, y: 1.6, z: -2 };
  const camaras: Punto3[] = [
    { x: 34, y: 27, z: 28 },
    { x: 4 + 28, y: 27, z: -2 + 8 },
    { x: -26, y: 20, z: -30 },
    { x: 4, y: 3, z: 3 },
    { x: 4, y: 20, z: -1.9 },
  ];
  const aspectos = [16 / 9, 9 / 16, 1];

  const resta = (a: Punto3, b: Punto3): Punto3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const largo = (v: Punto3) => Math.hypot(v.x, v.y, v.z);
  /** Ángulo (grados) entre la línea cámara→objetivo y la línea cámara→orbe. */
  const anguloAlOrbe = (orbe: Punto3, camara: Punto3) => {
    const a = resta(cabeza, camara);
    const b = resta(orbe, camara);
    const cos = (a.x * b.x + a.y * b.y + a.z * b.z) / (largo(a) * largo(b));
    return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
  };

  it.each(camaras)('queda fuera del cono alrededor de cámara→cabeza (cámara %#)', (camara) => {
    for (const aspecto of aspectos) {
      const orbe = puntoOrbeEncuadre(cabeza, camara, FOV_VERTICAL, aspecto);
      expect(anguloAlOrbe(orbe, camara)).toBeGreaterThan(aspecto < 1 ? 5 : 10);
    }
  });

  it.each(camaras)(
    'cae dentro de la pantalla, en el tercio derecho y más lejos (cámara %#)',
    (camara) => {
      const orbe = puntoOrbeEncuadre(cabeza, camara, FOV_VERTICAL, 16 / 9);
      const distancia = largo(resta(cabeza, camara));
      expect(largo(resta(orbe, camara))).toBeGreaterThan(distancia);
      // Mira desde la cámara hacia la cabeza: el orbe proyectado queda a la derecha y arriba.
      const e: Encuadre = { posicion: camara, objetivo: cabeza, distancia };
      const p = proyectar(e, orbe, 16, 9);
      expect(p.x).toBeGreaterThan(1 / 3);
      expect(p.x).toBeLessThan(1);
      expect(p.y).toBeGreaterThan(0);
    },
  );

  it('sigue al objetivo: el mismo encuadre relativo desde otra posición', () => {
    const camara = { x: 34, y: 27, z: 28 };
    const lejos = { x: -6, y: 1.6, z: 3 };
    const a = puntoOrbeEncuadre(cabeza, camara, FOV_VERTICAL, 16 / 9);
    const b = puntoOrbeEncuadre(lejos, camara, FOV_VERTICAL, 16 / 9);
    const pa = proyectar({ posicion: camara, objetivo: cabeza, distancia: 1 }, a, 16, 9);
    const pb = proyectar({ posicion: camara, objetivo: lejos, distancia: 1 }, b, 16, 9);
    expect(pa.x).toBeCloseTo(pb.x, 2);
    expect(pa.y).toBeCloseTo(pb.y, 2);
  });
});

describe('derivarAzimut', () => {
  it('sin velocidad (o con 0) no cambia el azimut', () => {
    expect(derivarAzimut(0.3, 5, 0.016, 0, Infinity)).toBe(0.3);
    expect(derivarAzimut(0.3, 5, 0.016, -1, Infinity)).toBe(0.3);
  });

  it('se mece: cambia el azimut y vuelve, sin salirse de una banda estrecha', () => {
    let az = 0;
    let max = 0;
    let min = 0;
    for (let i = 0; i < 60 * 120; i++) {
      az = derivarAzimut(az, i / 60, 1 / 60, 0.06, Infinity);
      max = Math.max(max, az);
      min = Math.min(min, az);
    }
    // Barre ±velocidad/frecuencia = ±0,12 rad.
    expect(max).toBeGreaterThan(0.1);
    expect(max).toBeLessThan(0.13);
    expect(min).toBeLessThan(-0.1);
    expect(min).toBeGreaterThan(-0.13);
  });

  it('dentro de un ambiente no pasa de AZIMUT_AMBIENTE aunque parta pegado al límite', () => {
    let az = AZIMUT_AMBIENTE - 0.001;
    for (let i = 0; i < 60 * 300; i++) {
      az = derivarAzimut(az, i / 60, 1 / 60, 0.5, AZIMUT_AMBIENTE);
      expect(Math.abs(az)).toBeLessThanOrEqual(AZIMUT_AMBIENTE + 1e-12);
    }
  });
});

describe('cámara de seguimiento del avatar', () => {
  const DT = 1 / 60;
  const entrada = (s: Partial<EntradaSeguimiento> = {}): EntradaSeguimiento => ({
    dt: DT,
    x: 0,
    y: 0,
    z: 0,
    adelante: 0,
    lateral: 0,
    azimut: 0,
    elevacion: ELEVACION_INICIAL,
    distanciaActual: 8,
    cajas: [],
    ...s,
  });
  /** Avanza `n` cuadros con el avatar yendo a (vx, vz) m/s desde su posición actual. */
  const caminar = (
    s: EstadoSeguimiento,
    e: EntradaSeguimiento,
    vx: number,
    vz: number,
    n: number,
    cada?: (s: EstadoSeguimiento) => void,
  ) => {
    for (let i = 0; i < n; i++) {
      e.x += vx * DT;
      e.z += vz * DT;
      avanzarSeguimiento(s, e);
      e.distanciaActual = s.distancia;
      cada?.(s);
    }
  };
  const asentado = (e: EntradaSeguimiento) => {
    const s = crearSeguimiento();
    avanzarSeguimiento(s, e);
    caminar(s, e, 0, 0, 240);
    return s;
  };

  afterEach(() => encenderTodo());

  it('zona muerta: moverse poco dentro de la ventana no mueve el punto de mira', () => {
    const e = entrada();
    const s = asentado(e);
    const x0 = s.mira.x;
    const z0 = s.mira.z;
    caminar(s, e, 0.2, 0, 30); // 0,5 s a 0,2 m/s: 0,1 m, dentro de la ventana
    expect(Math.hypot(s.mira.x - x0, s.mira.z - z0)).toBeLessThan(0.02);
  });

  it('al salirse de la ventana el punto de mira sigue al avatar y se adelanta a su ventana', () => {
    const e = entrada();
    const s = asentado(e);
    caminar(s, e, 1.15, 0, 180);
    expect(s.mira.x - s.cx).toBeGreaterThan(0.05);
    expect(s.mira.x - s.cx).toBeLessThanOrEqual(PARAMETROS_SEGUIMIENTO.anticipacionMax + 1e-6);
    expect(Math.abs(e.x - s.cx)).toBeLessThanOrEqual(PARAMETROS_SEGUIMIENTO.zonaMuerta + 1e-6);
    expect(Math.abs(s.mira.z - e.z)).toBeLessThan(0.05);
  });

  it('la anticipación por el mando está acotada y respeta el azimut', () => {
    const e = entrada({ adelante: 1 }); // adelante = −z con azimut 0
    const s = asentado(e);
    caminar(s, e, 0, -1.15, 120);
    const adelanto = s.cz - s.mira.z; // > 0: el mira va por delante del centro (hacia −z)
    expect(adelanto).toBeGreaterThan(0.1);
    expect(adelanto).toBeLessThanOrEqual(PARAMETROS_SEGUIMIENTO.anticipacionMax + 1e-6);
    caminar(s, e, 0, -5, 120);
    expect(s.cz - s.mira.z).toBeLessThanOrEqual(PARAMETROS_SEGUIMIENTO.anticipacionMax + 1e-6);
    expect(Math.abs(s.mira.x)).toBeLessThan(1e-3);
  });

  it('el punto de mira nunca supera su velocidad máxima', () => {
    const e = entrada();
    const s = asentado(e);
    e.x += 3.5; // salto de 3,5 m (< saltoMax): el resorte sin tope iría mucho más rápido
    let ax = s.mira.x;
    let az = s.mira.z;
    for (let i = 0; i < 60; i++) {
      avanzarSeguimiento(s, e);
      const v = Math.hypot(s.mira.x - ax, s.mira.z - az) / DT;
      expect(v).toBeLessThanOrEqual(PARAMETROS_SEGUIMIENTO.velocidadMaxMira + 1e-6);
      ax = s.mira.x;
      az = s.mira.z;
    }
  });

  it('un teletransporte lo lleva de golpe, sin viaje', () => {
    const e = entrada();
    const s = asentado(e);
    e.x = 20;
    avanzarSeguimiento(s, e);
    expect(s.mira.x).toBe(20);
  });

  it('realinea despacio con el avatar quieto dentro de la ventana', () => {
    const e = entrada();
    const s = asentado(e);
    e.x = 0.2; // dentro de la ventana: el centro no se mueve de inmediato
    caminar(s, e, 0, 0, 30);
    expect(s.mira.x).toBeLessThan(0.1); // el paso de 0,2 m en un cuadro asoma algo de anticipación
    caminar(s, e, 0, 0, 60 * 10);
    expect(s.mira.x).toBeCloseTo(0.2, 1);
  });

  it('con el seguimiento apagado el mira va rígido en la cabeza del avatar', () => {
    fijarOpciones({ camaraSeguimiento: false });
    const e = entrada({ y: 3 });
    const s = crearSeguimiento();
    avanzarSeguimiento(s, e);
    e.x = 1;
    e.z = -2;
    avanzarSeguimiento(s, e);
    expect(s.mira).toEqual({ x: 1, y: 3 + PARAMETROS_SEGUIMIENTO.alturaMira, z: -2 });
  });

  it('el brazo acorta la distancia si un muro queda entre la cámara y el avatar', () => {
    const e = entrada({
      distanciaActual: 8,
      cajas: [{ x0: -5, x1: 5, y0: -1, y1: 5, z0: 3, z1: 3.3 }],
    });
    const s = asentado(e);
    // Con azimut 0 la cámara queda en +z: el muro (z 3..3,3) la separa del avatar.
    const camaraZ = s.mira.z + s.distancia * Math.cos(e.elevacion);
    expect(camaraZ).toBeLessThan(3);
    expect(s.distancia).toBeLessThan(8);
    expect(s.distancia).toBeGreaterThanOrEqual(PARAMETROS_SEGUIMIENTO.distanciaMinBrazo);
  });

  it('con una columna justo a la distancia mínima del brazo, la cámara nunca queda dentro de ella', () => {
    // Columna de 0,7 m entre la cámara y el avatar, que cubre la distancia mínima del brazo (2,2 m):
    // antes la cámara quedaba en 2,2 m, dentro de la columna, y la pantalla se veía marrón.
    const columna = { x0: -0.35, x1: 0.35, y0: -1, y1: 6, z0: 1.7, z1: 2.5 };
    const e = entrada({ distanciaActual: 8, cajas: [columna] });
    const s = asentado(e);
    const horizontal = Math.cos(e.elevacion);
    const camara = {
      x: s.mira.x,
      y: s.mira.y + s.distancia * Math.sin(e.elevacion),
      z: s.mira.z + s.distancia * horizontal,
    };
    const dentro =
      camara.x > columna.x0 &&
      camara.x < columna.x1 &&
      camara.y > columna.y0 &&
      camara.y < columna.y1 &&
      camara.z > columna.z0 &&
      camara.z < columna.z1;
    expect(dentro).toBe(false);
    expect(camara.z).toBeLessThan(columna.z0);
  });

  it('sin obstáculos conserva la distancia y el zoom del usuario manda', () => {
    const e = entrada();
    const s = asentado(e);
    expect(s.distancia).toBeCloseTo(PARAMETROS_SEGUIMIENTO.distanciaSeguir, 1);
    e.distanciaActual = 5; // el usuario hizo zoom
    caminar(s, e, 0, 0, 30);
    expect(s.distancia).toBeCloseTo(5, 1);
  });

  it('el brazo vuelve a alargarse despacio al despejarse', () => {
    const e = entrada({ cajas: [{ x0: -5, x1: 5, y0: -1, y1: 5, z0: 3, z1: 3.3 }] });
    const s = asentado(e);
    const corto = s.distancia;
    e.cajas = [];
    caminar(s, e, 0, 0, 6);
    expect(s.distancia).toBeGreaterThanOrEqual(corto);
    expect(s.distancia).toBeLessThan(PARAMETROS_SEGUIMIENTO.distanciaSeguir);
    caminar(s, e, 0, 0, 240);
    expect(s.distancia).toBeCloseTo(PARAMETROS_SEGUIMIENTO.distanciaSeguir, 1);
  });

  describe('con la caminata nueva (correr y saltar)', () => {
    const CORRER = 4.8;
    const CAMINAR = 2.3;
    const ALTO_CABEZA = 2.25; // coronilla + aro sobre los pies
    const [ANCHO, ALTO] = [1440, 900];
    const seguir = escenarioTrading.vistas.seguir;
    const params = { ...PARAMETROS_SEGUIMIENTO, distanciaSeguir: seguir.distancia };
    const elevacion = (seguir.elevacion * Math.PI) / 180;

    const nueva = () => {
      const e = entrada({ elevacion, distanciaActual: seguir.distancia });
      const s = crearSeguimiento();
      avanzarSeguimiento(s, e, params);
      for (let i = 0; i < 240; i++) {
        avanzarSeguimiento(s, e, params);
        e.distanciaActual = s.distancia;
      }
      return { s, e };
    };
    const paso = (s: EstadoSeguimiento, e: EntradaSeguimiento, vx: number, vz: number) => {
      e.x += vx * DT;
      e.z += vz * DT;
      avanzarSeguimiento(s, e, params);
      e.distanciaActual = s.distancia;
    };
    const encuadreDe = (s: EstadoSeguimiento, e: EntradaSeguimiento): Encuadre => {
      const d = desplazamientoDe(
        { distancia: s.distancia, azimut: e.azimut, elevacion: e.elevacion } as EstadoCamara,
        { x: 0, y: 0, z: 0 },
      );
      return {
        posicion: { x: s.mira.x + d.x, y: s.mira.y + d.y, z: s.mira.z + d.z },
        objetivo: { ...s.mira },
        distancia: s.distancia,
      };
    };
    /** Máxima desviación en pantalla (NDC) de pies y cabeza (con `alzada` m de salto) del avatar. */
    const desvio = (s: EstadoSeguimiento, e: EntradaSeguimiento, alzada = 0) => {
      const enc = encuadreDe(s, e);
      const pies = proyectar(enc, { x: e.x, y: e.y + alzada, z: e.z }, ANCHO, ALTO);
      const cabeza = proyectar(enc, { x: e.x, y: e.y + alzada + ALTO_CABEZA, z: e.z }, ANCHO, ALTO);
      return Math.max(Math.abs(pies.x), Math.abs(pies.y), Math.abs(cabeza.x), Math.abs(cabeza.y));
    };

    it('corriendo en línea recta nunca sale del 80 % central del cuadro', () => {
      const { s, e } = nueva();
      let peor = 0;
      for (let i = 0; i < 300; i++) {
        paso(s, e, 0, -CORRER);
        peor = Math.max(peor, desvio(s, e));
      }
      expect(peor).toBeLessThan(0.8);
    });

    it('corriendo en zigzag (cambios de rumbo de golpe) nunca sale del 80 % central', () => {
      const { s, e } = nueva();
      let peor = 0;
      for (let i = 0; i < 300; i++) {
        const lado = Math.floor(i / 30) % 2 === 0 ? 1 : -1;
        paso(s, e, lado * CORRER * Math.SQRT1_2, -CORRER * Math.SQRT1_2);
        peor = Math.max(peor, desvio(s, e));
      }
      expect(peor).toBeLessThan(0.8);
    });

    it('la anticipación conserva un encuadre cercano a los pies al cambiar la rapidez', () => {
      const adelanto = (v: number) => {
        const { s, e } = nueva();
        for (let i = 0; i < 240; i++) paso(s, e, v, 0);
        return s.mira.x - e.x;
      };
      const [lento, medio, rapido] = [adelanto(1.2), adelanto(CAMINAR), adelanto(CORRER)];
      for (const encuadre of [lento, medio, rapido]) {
        expect(encuadre).toBeGreaterThan(-params.zonaMuerta);
        expect(encuadre).toBeLessThanOrEqual(0);
      }
      const { s, e } = nueva();
      for (let i = 0; i < 240; i++) paso(s, e, 12, 0); // el doble que correr
      expect(s.mira.x - s.cx).toBeLessThanOrEqual(params.anticipacionMax + 1e-6);
    });

    it('el salto no mueve el punto de mira en altura y la cabeza no se corta en lo alto', () => {
      const { s, e } = nueva();
      const y0 = s.mira.y;
      let peor = 0;
      // 0,55 s en el aire con la altura de PARAMETROS_SALTO (1,2 m): parábola desde el piso.
      const frames = Math.round(0.55 * 60);
      for (let i = 0; i <= frames; i++) {
        const u = i / frames;
        const alzada = 1.2 * 4 * u * (1 - u);
        paso(s, e, 0, -CAMINAR);
        expect(Math.abs(s.mira.y - y0)).toBeLessThan(1e-6);
        peor = Math.max(peor, desvio(s, e, alzada));
      }
      expect(peor).toBeLessThan(0.8);
    });

    it('al correr se aleja y al dejar de correr vuelve, sin tirones', () => {
      const { s, e } = nueva();
      const base = s.distancia;
      let previa = s.distancia;
      let salto = 0;
      for (let i = 0; i < 240; i++) {
        paso(s, e, 0, -CORRER);
        salto = Math.max(salto, Math.abs(s.distancia - previa));
        previa = s.distancia;
      }
      expect(s.distancia).toBeGreaterThan(base + 1);
      for (let i = 0; i < 300; i++) {
        paso(s, e, 0, 0);
        salto = Math.max(salto, Math.abs(s.distancia - previa));
        previa = s.distancia;
      }
      expect(s.distancia).toBeCloseTo(base, 1);
      expect(salto).toBeLessThan(0.06); // m por cuadro (≈ 3,6 m/s)
    });

    it('junto al borde abierto del piso casi no se ve el vacío y los pies del avatar quedan dentro del 80 % central', () => {
      const frente = SALA.z1;
      const { s, e } = nueva();
      for (let i = 0; i < 400; i++) {
        e.frente = frente;
        paso(s, e, 0, e.z < frente - 0.4 ? CORRER : 0);
        const enc = encuadreDe(s, e);
        const borde = proyectar(enc, { x: e.x, y: 0, z: frente }, ANCHO, ALTO);
        const pies = proyectar(enc, { x: e.x, y: 0, z: e.z }, ANCHO, ALTO);
        expect(borde.y).toBeLessThanOrEqual(-0.7); // como mucho una franja del 15 % del alto, solo pegado al borde
        expect(pies.y).toBeGreaterThan(-0.8);
      }
      expect(e.z).toBeGreaterThan(frente - 0.5);
    });

    it('caminando no se aleja y el zoom del usuario sigue mandando al correr', () => {
      const { s, e } = nueva();
      const base = s.distancia;
      for (let i = 0; i < 240; i++) paso(s, e, 0, -CAMINAR);
      expect(s.distancia).toBeCloseTo(base, 1);
      for (let i = 0; i < 120; i++) paso(s, e, 0, -CORRER);
      e.distanciaActual = 6; // el usuario hace zoom
      for (let i = 0; i < 30; i++) paso(s, e, 0, -CORRER);
      expect(s.distancia).toBeLessThan(base);
    });
  });
});

describe('encuadreGeneral', () => {
  const GRADOS = Math.PI / 180;
  const sala: Caja3 = { x0: -14, x1: 14, y0: 0, y1: 5, z0: -9, z1: 9 };
  const vistas = (extra: Partial<Vistas> = {}): Vistas => ({
    general: sala,
    elevacionGeneral: 25,
    seguir: { distancia: 8, elevacion: 35 },
    zonas: [],
    ...extra,
  });
  const cajaCentral: Caja3 = { ...sala, x0: -7, x1: 7 };
  const lienzos = [
    [1440, 900],
    [390, 844],
  ] as const;

  /** Mayor ocupación (0..1) de la pantalla entre las 8 esquinas; falla si alguna queda fuera o detrás. */
  function ocupacion(e: Encuadre, c: Caja3, w: number, h: number, etiqueta: string) {
    let maxX = 0;
    let maxY = 0;
    for (const p of esquinas(c.x0, c.x1, c.y0, c.y1, c.z0, c.z1)) {
      const s = proyectar(e, p, w, h);
      expect(s.profundo, etiqueta).toBeGreaterThan(0);
      maxX = Math.max(maxX, Math.abs(s.x));
      maxY = Math.max(maxY, Math.abs(s.y));
    }
    return { maxX, maxY };
  }

  it.each(lienzos)('la mansión se encuadra igual que hoy en %i×%i', (w, h) => {
    expect(encuadreGeneral(escenarioMansion.vistas, w, h)).toEqual(encuadreInicial(w, h));
  });

  it('la mansión en horizontal es la casa entera de siempre', () => {
    expect(encuadreGeneral(escenarioMansion.vistas, 1440, 900)).toEqual(encuadreCasa(1440, 900));
  });

  it('en horizontal las 8 esquinas caben y el eje que manda sobra ≤ 15 %', () => {
    const [w, h] = lienzos[0];
    const o = ocupacion(encuadreGeneral(vistas(), w, h), sala, w, h, 'horizontal');
    expect(Math.max(o.maxX, o.maxY)).toBeLessThanOrEqual(1);
    expect(Math.max(o.maxX, o.maxY)).toBeGreaterThanOrEqual(0.85);
  });

  it('en vertical encuadra generalVertical: caben las 8 esquinas y sobra ≤ 15 %', () => {
    const [w, h] = lienzos[1];
    const e = encuadreGeneral(vistas({ generalVertical: cajaCentral }), w, h);
    const o = ocupacion(e, cajaCentral, w, h, 'vertical');
    expect(Math.max(o.maxX, o.maxY)).toBeLessThanOrEqual(1);
    expect(Math.max(o.maxX, o.maxY)).toBeGreaterThanOrEqual(0.85);
  });

  it('sin generalVertical usa el recorte central de general (más cerca que la caja entera)', () => {
    const [w, h] = lienzos[1];
    const e = encuadreGeneral(vistas(), w, h);
    const o = ocupacion(e, { ...sala, x0: -7, x1: 7 }, w, h, 'recorte');
    expect(Math.max(o.maxX, o.maxY)).toBeLessThanOrEqual(1);
    expect(Math.max(o.maxX, o.maxY)).toBeGreaterThanOrEqual(0.85);
    const entera = encuadreGeneral(vistas({ generalVertical: sala }), w, h);
    expect(e.distancia).toBeLessThan(entera.distancia);
  });

  it('mira de frente con la elevación del escenario y centrada en x', () => {
    const e = encuadreGeneral(vistas({ elevacionGeneral: 25 }), 1440, 900);
    const elevacion = Math.atan2(e.posicion.y - e.objetivo.y, e.posicion.z - e.objetivo.z);
    expect(elevacion / GRADOS).toBeCloseTo(25, 4);
    expect(e.posicion.x).toBeCloseTo(0, 6);
    expect(e.objetivo.y).toBeCloseTo(2.5, 6);
  });

  it('con baseVertical, en vertical, la base cae al ~14 % del alto', () => {
    const [w, h] = lienzos[1];
    const e = encuadreGeneral(vistas({ baseVertical: { y: 0, z: 9 } }), w, h);
    const base = proyectar(e, { x: 0, y: 0, z: 9 }, w, h);
    expect((1 + base.y) / 2).toBeCloseTo(0.14, 2);
  });
});

describe('distanciaSeguirPara con base propia', () => {
  it('usa la distancia del escenario en horizontal y la aleja en vertical', () => {
    expect(distanciaSeguirPara(1.6, 12)).toBe(12);
    expect(distanciaSeguirPara(0.5, 12)).toBeGreaterThan(12);
  });
});

describe('avanzarCamara con elevación general propia', () => {
  it('al reorientar vuelve a la elevación del escenario y no a la de la mansión', () => {
    const casa: Encuadre = {
      posicion: { x: 0, y: 5, z: 20 },
      objetivo: { x: 0, y: 0, z: 0 },
      distancia: 20,
    };
    const e: EstadoCamara = { ...enBlanco(), elevacion: 0.1, reorientar: true };
    avanzarCamara(e, {
      dt: 1,
      casa,
      ambiente: null,
      foco: null,
      enfocado: null,
      instantaneo: true,
      elevacionGeneral: 0.6,
    });
    expect(e.elevacion).toBeCloseTo(0.6, 6);
  });
});

describe('encuadreGeneral de la sala de trading', () => {
  const v = escenarioTrading.vistas;
  const alturaPantalla = (w: number, h: number, base: Punto3, alto: number) => {
    const e = encuadreGeneral(v, w, h);
    const a = proyectar(e, base, w, h);
    const b = proyectar(e, { ...base, y: base.y + alto }, w, h);
    return Math.abs(b.y - a.y) / 2;
  };

  it('en 390×844 la sala, del muro de datos al borde frontal, ocupa ≥ 40 % del alto y cabe (el muro entero manda el ancho)', () => {
    const [w, h] = [390, 844];
    const e = encuadreGeneral(v, w, h);
    const fondo = proyectar(e, { x: 0, y: SALA.alto, z: SALA.z0 }, w, h);
    const frente = proyectar(e, { x: 0, y: 0, z: SALA.z1 }, w, h);
    expect((fondo.y - frente.y) / 2).toBeGreaterThanOrEqual(0.4);
    expect(fondo.y).toBeLessThanOrEqual(1);
    expect(frente.y).toBeGreaterThanOrEqual(-1);
  });

  it('en 390×844 el muro de datos entero (sus 16 m, base y tope) cabe en el cuadro: ningún texto de pantalla se corta', () => {
    const [w, h] = [390, 844];
    const e = encuadreGeneral(v, w, h);
    const muro = escenarioTrading.pantallas.find((p) => p.id === 'muro')!;
    for (const x of [-muro.ancho / 2, 0, muro.ancho / 2]) {
      for (const y of [muro.y - muro.alto / 2, muro.y + muro.alto / 2]) {
        const q = proyectar(e, { x, y, z: zMuroLed(x) }, w, h);
        expect(Math.abs(q.x), `x ${x}`).toBeLessThanOrEqual(0.97);
        expect(Math.abs(q.y), `x ${x} y ${y}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('en 390×844 una persona de 1,7 m en el banco de agentes mide ≥ 1,8 % del alto', () => {
    expect(alturaPantalla(390, 844, { x: 0, y: 0, z: -7 }, 1.7)).toBeGreaterThanOrEqual(0.018);
  });

  it('en 1440×900 la sala llena el ancho, cabe entera y deja asomar la ciudad', () => {
    const [w, h] = [1440, 900];
    const e = encuadreGeneral(v, w, h);
    const g = v.general;
    let maxX = 0;
    let maxY = 0;
    let minY = 1;
    let maxYp = -1;
    for (const p of esquinas(g.x0, g.x1, g.y0, g.y1, g.z0, g.z1)) {
      const s = proyectar(e, p, w, h);
      maxX = Math.max(maxX, Math.abs(s.x));
      maxY = Math.max(maxY, Math.abs(s.y));
      minY = Math.min(minY, s.y);
      maxYp = Math.max(maxYp, s.y);
    }
    expect(Math.max(maxX, maxY)).toBeLessThanOrEqual(1);
    // Alto que ocupa la sala entera (0..1 del cuadro) y ancho.
    // A 46° (caras y cuerpos a la vista, la ciudad asoma sobre el muro) y 36 m de ancho a 16:10, el
    // ancho manda: la sala ocupa ~68 % del alto y el resto es la ciudad de arriba y el piso de abajo.
    expect((maxYp - minY) / 2).toBeGreaterThanOrEqual(0.66);
    expect(maxYp).toBeLessThanOrEqual(0.7); // sobre el muro queda ≥ 15 % del alto para la ciudad
    expect(maxX).toBeGreaterThanOrEqual(0.9);
  });
});
