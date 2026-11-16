import { describe, expect, it } from 'vitest';
import {
  crearBufferRemoto,
  muestrearRemoto,
  PARAMETROS_RED,
  recibirInstantanea,
} from './instantaneas';
import type { BufferRemoto, ParametrosRed, SalidaRemota } from './instantaneas';

function salidaVacia(): SalidaRemota {
  return { x: 0, y: 0, z: 0, rumbo: 0, velX: 0, velZ: 0, velocidad: 0, extrapolando: false };
}

/** Generador determinista (mulberry32). */
function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const V = 1.4;
const recta = (t: number) => ({ x: V * t, y: 0, z: 0.5, rumbo: Math.PI / 2 });
const R = 3;
const W = V / R;
const circulo = (t: number) => ({
  x: R * Math.cos(W * t),
  y: 0,
  z: R * Math.sin(W * t),
  rumbo: Math.atan2(-Math.sin(W * t), Math.cos(W * t)),
});

interface Opciones {
  hz?: number;
  perdida?: number;
  jitter?: number;
  latencia?: number;
  duracion?: number;
  semilla?: number;
  p?: ParametrosRed;
  trayectoria?: (t: number) => { x: number; y: number; z: number; rumbo: number };
}

interface Cuadro {
  t: number;
  x: number;
  z: number;
  y: number;
  rumbo: number;
  verdadX: number;
  verdadZ: number;
  extrapolando: boolean;
  retardo: number;
}

/** Envía a `hz` con pérdida y jitter, y dibuja a 60 Hz. Devuelve los cuadros y el buffer. */
function simular(o: Opciones = {}): { cuadros: Cuadro[]; b: BufferRemoto } {
  const hz = o.hz ?? 10;
  const perdida = o.perdida ?? 0;
  const jitter = o.jitter ?? 0;
  const latencia = o.latencia ?? 0;
  const duracion = o.duracion ?? 10;
  const p = o.p ?? PARAMETROS_RED;
  const tray = o.trayectoria ?? recta;
  const rnd = azar(o.semilla ?? 7);
  const paquetes: { llegada: number; t: number }[] = [];
  for (let k = 0; k * (1 / hz) <= duracion; k++) {
    const t = k / hz;
    if (rnd() < perdida) continue;
    paquetes.push({ llegada: t + latencia + (rnd() * 2 - 1) * jitter, t });
  }
  paquetes.sort((a, c) => a.llegada - c.llegada);
  const b = crearBufferRemoto();
  const s = salidaVacia();
  const cuadros: Cuadro[] = [];
  let i = 0;
  for (let f = 0; f / 60 <= duracion; f++) {
    const ahora = f / 60;
    while (i < paquetes.length && (paquetes[i] as { llegada: number }).llegada <= ahora) {
      const pk = paquetes[i] as { t: number };
      const q = tray(pk.t);
      recibirInstantanea(b, pk.t, q.x, q.y, q.z, q.rumbo);
      i++;
    }
    muestrearRemoto(b, ahora, p, s);
    const verdad = tray(ahora - b.retardo);
    cuadros.push({
      t: ahora,
      x: s.x,
      y: s.y,
      z: s.z,
      rumbo: s.rumbo,
      verdadX: verdad.x,
      verdadZ: verdad.z,
      extrapolando: s.extrapolando,
      retardo: b.retardo,
    });
  }
  return { cuadros, b };
}

function pasoMax(cuadros: Cuadro[], desde: number): number {
  let m = 0;
  for (let i = 1; i < cuadros.length; i++) {
    const a = cuadros[i - 1] as Cuadro;
    const c = cuadros[i] as Cuadro;
    if (c.t < desde) continue;
    m = Math.max(m, Math.hypot(c.x - a.x, c.z - a.z));
  }
  return m;
}

describe('buffer de instantáneas', () => {
  it('ignora llegadas fuera de orden o repetidas', () => {
    const b = crearBufferRemoto();
    expect(recibirInstantanea(b, 1, 0, 0, 0, 0)).toBe(true);
    expect(recibirInstantanea(b, 1.1, 1, 0, 0, 0)).toBe(true);
    expect(recibirInstantanea(b, 1.05, 99, 0, 0, 0)).toBe(false);
    expect(recibirInstantanea(b, 1.1, 99, 0, 0, 0)).toBe(false);
    expect(b.n).toBe(2);
    const s = salidaVacia();
    muestrearRemoto(b, 5, PARAMETROS_RED, s);
    expect(s.x).toBeLessThan(5);
  });

  it('el anillo no pasa de su capacidad', () => {
    const b = crearBufferRemoto(8);
    for (let k = 0; k < 20; k++) recibirInstantanea(b, k * 0.1, k, 0, 0, 0);
    expect(b.n).toBe(8);
  });

  it('estima el intervalo entre llegadas', () => {
    const b = crearBufferRemoto();
    for (let k = 0; k < 40; k++) recibirInstantanea(b, k * 0.2, 0, 0, 0, 0);
    expect(b.intervalo).toBeCloseTo(0.2, 3);
  });
});

describe('suavizado de personas remotas', () => {
  it('a 10 Hz y 60 Hz la posición sigue la trayectoria recta con error < 3 cm y sin saltos', () => {
    const { cuadros } = simular({ hz: 10 });
    let err = 0;
    for (const c of cuadros)
      if (c.t > 2) err = Math.max(err, Math.hypot(c.x - c.verdadX, c.z - c.verdadZ));
    expect(err).toBeLessThan(0.03);
    expect(pasoMax(cuadros, 2)).toBeLessThan(V / 60 + 0.005);
  });

  it('sobre una curva el error sigue siendo pequeño', () => {
    const { cuadros } = simular({ hz: 10, trayectoria: circulo });
    let err = 0;
    for (const c of cuadros)
      if (c.t > 2) err = Math.max(err, Math.hypot(c.x - c.verdadX, c.z - c.verdadZ));
    expect(err).toBeLessThan(0.03);
  });

  it('el rumbo se interpola por el camino corto al cruzar ±π', () => {
    const b = crearBufferRemoto();
    recibirInstantanea(b, 0, 0, 0, 0, Math.PI - 0.1);
    recibirInstantanea(b, 0.1, 0, 0, 0, -Math.PI + 0.1);
    const s = salidaVacia();
    const p = { ...PARAMETROS_RED, retardoMin: 0.05, retardoIntervalos: 0.5 };
    muestrearRemoto(b, 0.1, p, s);
    const d = Math.abs(Math.atan2(Math.sin(s.rumbo - Math.PI), Math.cos(s.rumbo - Math.PI)));
    expect(d).toBeLessThan(0.11);
  });

  it('con velocidad horizontal el rumbo tiende a la dirección del movimiento', () => {
    const b = crearBufferRemoto();
    // Se mueve hacia +x (rumbo π/2) pero el rumbo recibido sigue en 0 (rezagado).
    for (let k = 0; k < 30; k++) recibirInstantanea(b, k * 0.1, V * k * 0.1, 0, 0, 0);
    const s = salidaVacia();
    for (let f = 0; f < 100; f++) muestrearRemoto(b, 1 + f / 60, PARAMETROS_RED, s);
    expect(s.rumbo).toBeGreaterThan(0.5);
    expect(s.rumbo).toBeLessThanOrEqual(Math.PI / 2 + 1e-6);
  });

  it('con 20 % de pérdida y jitter ±40 ms no hay saltos mayores de 5 cm entre cuadros', () => {
    for (const semilla of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const { cuadros } = simular({
        hz: 10,
        perdida: 0.2,
        jitter: 0.04,
        latencia: 0.04,
        trayectoria: circulo,
        duracion: 20,
        semilla,
      });
      expect(pasoMax(cuadros, 2)).toBeLessThan(0.05);
    }
  });

  it('el retardo se adapta al intervalo y nunca pasa de retardoMax', () => {
    const lento = simular({ hz: 5, duracion: 8 });
    const rapido = simular({ hz: 20, duracion: 8 });
    const muyLento = simular({ hz: 1, duracion: 20 });
    const r5 = (lento.cuadros.at(-1) as Cuadro).retardo;
    const r20 = (rapido.cuadros.at(-1) as Cuadro).retardo;
    expect(r5).toBeGreaterThan(r20);
    expect(r20).toBeCloseTo(0.15, 2);
    for (const c of [...lento.cuadros, ...rapido.cuadros, ...muyLento.cuadros]) {
      expect(c.retardo).toBeLessThanOrEqual(PARAMETROS_RED.retardoMax + 1e-9);
      expect(c.retardo).toBeGreaterThanOrEqual(PARAMETROS_RED.retardoMin - 1e-9);
    }
    expect((muyLento.cuadros.at(-1) as Cuadro).retardo).toBeCloseTo(PARAMETROS_RED.retardoMax, 6);
  });

  it('el retardo no da saltos al cambiar la tasa de envío', () => {
    // 20 Hz durante 4 s y luego 5 Hz: el retardo sube gradualmente, sin saltos de posición.
    const b = crearBufferRemoto();
    const s = salidaVacia();
    let tSig = 0;
    let previo = 0;
    let paso = 0;
    for (let f = 0; f / 60 <= 12; f++) {
      const ahora = f / 60;
      const hz = ahora < 4 ? 20 : 5;
      while (tSig <= ahora) {
        recibirInstantanea(b, tSig, V * tSig, 0, 0, 0);
        tSig += 1 / hz;
      }
      muestrearRemoto(b, ahora, PARAMETROS_RED, s);
      if (ahora > 2) paso = Math.max(paso, Math.abs(s.x - previo));
      previo = s.x;
    }
    expect(paso).toBeLessThan(V / 60 + 0.01);
    expect(b.retardo).toBeGreaterThan(0.3);
  });

  it('sin snapshot posterior extrapola un tramo, decae a velocidad 0 y se detiene sin rebote', () => {
    const b = crearBufferRemoto();
    for (let k = 0; k <= 10; k++) recibirInstantanea(b, k * 0.1, V * k * 0.1, 0, 0, 0);
    const s = salidaVacia();
    let anterior = -Infinity;
    let sawExtrapolando = false;
    for (let f = 0; f < 60 * 4; f++) {
      muestrearRemoto(b, 1 + f / 60, PARAMETROS_RED, s);
      expect(s.x).toBeGreaterThanOrEqual(anterior - 1e-9);
      anterior = s.x;
      sawExtrapolando ||= s.extrapolando;
      expect(Number.isNaN(s.x)).toBe(false);
    }
    expect(sawExtrapolando).toBe(true);
    expect(s.extrapolando).toBe(true);
    expect(s.velocidad).toBe(0);
    // Avanzó a lo sumo V * extrapolacionMax / 2 más allá del último snapshot (x = 1.4).
    expect(s.x).toBeGreaterThan(V);
    expect(s.x).toBeLessThanOrEqual(V + (V * PARAMETROS_RED.extrapolacionMax) / 2 + 1e-9);
    // Reposo estable.
    const x = s.x;
    muestrearRemoto(b, 20, PARAMETROS_RED, s);
    expect(s.x).toBe(x);
  });

  it('un salto mayor que saltoMax es teletransporte: nunca aparece en puntos intermedios', () => {
    const b = crearBufferRemoto();
    const s = salidaVacia();
    for (let k = 0; k <= 10; k++) recibirInstantanea(b, k * 0.1, V * k * 0.1, 0, 0, 0);
    for (let k = 11; k <= 40; k++) recibirInstantanea(b, k * 0.1, 20 + V * (k - 11) * 0.1, 0, 0, 0);
    const xs: number[] = [];
    for (let f = 0; f < 60 * 4.5; f++) {
      muestrearRemoto(b, 0.3 + f / 60, PARAMETROS_RED, s);
      xs.push(s.x);
    }
    expect(xs.some((x) => x > V + 0.01 && x < 20 - 0.01)).toBe(false);
    expect(xs.some((x) => x >= 20)).toBe(true);
    expect(xs.at(-1)).toBeGreaterThanOrEqual(20);
  });

  it('un salto menor que saltoMax se interpola', () => {
    const b = crearBufferRemoto();
    recibirInstantanea(b, 0, 0, 0, 0, 0);
    recibirInstantanea(b, 0.2, 2, 0, 0, 0);
    recibirInstantanea(b, 0.4, 4, 0, 0, 0);
    recibirInstantanea(b, 0.6, 6, 0, 0, 0);
    const s = salidaVacia();
    const p = { ...PARAMETROS_RED, retardoMin: 0.3, retardoIntervalos: 1 };
    muestrearRemoto(b, 0.6, p, s);
    expect(s.x).toBeGreaterThan(2.5);
    expect(s.x).toBeLessThan(3.5);
  });

  it('la tasa y el retardo cambian solo con ParametrosRed', () => {
    const base = simular({ hz: 10 }).cuadros.at(-1) as Cuadro;
    const corto = simular({
      hz: 10,
      p: { ...PARAMETROS_RED, retardoIntervalos: 1 },
    }).cuadros.at(-1) as Cuadro;
    expect(base.retardo).toBeCloseTo(0.3, 2);
    expect(corto.retardo).toBeCloseTo(0.1, 2);
    // Con extrapolación 0 se queda en el último snapshot.
    const b = crearBufferRemoto();
    for (let k = 0; k <= 10; k++) recibirInstantanea(b, k * 0.1, V * k * 0.1, 0, 0, 0);
    const s = salidaVacia();
    const p0 = { ...PARAMETROS_RED, extrapolacionMax: 0 };
    for (let f = 0; f < 120; f++) muestrearRemoto(b, 1 + f / 60, p0, s);
    expect(s.x).toBeCloseTo(V, 9);
    expect(s.velocidad).toBe(0);
  });

  it('es estable con dt de 0 a 0,1 s y sin NaN', () => {
    const b = crearBufferRemoto();
    const s = salidaVacia();
    const rnd = azar(3);
    let t = 0;
    let ahora = 0;
    for (let i = 0; i < 2000; i++) {
      ahora += rnd() < 0.1 ? 0 : rnd() * 0.1;
      if (rnd() < 0.3) {
        t += 0.02 + rnd() * 0.2;
        recibirInstantanea(b, t, V * t, 0, 0.1 * t, rnd() * 6 - 3);
      }
      muestrearRemoto(b, ahora, PARAMETROS_RED, s);
      for (const v of [s.x, s.y, s.z, s.rumbo, s.velX, s.velZ, s.velocidad]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('es determinista', () => {
    const a = simular({ perdida: 0.2, jitter: 0.04, latencia: 0.04, semilla: 9 }).cuadros;
    const c = simular({ perdida: 0.2, jitter: 0.04, latencia: 0.04, semilla: 9 }).cuadros;
    expect(a.map((q) => q.x)).toEqual(c.map((q) => q.x));
  });

  it('no asigna memoria en el bucle por cuadro', () => {
    const gc = (globalThis as { gc?: () => void }).gc;
    const b = crearBufferRemoto();
    const s = salidaVacia();
    let t = 0;
    const ciclo = (n: number) => {
      for (let i = 0; i < n; i++) {
        const ahora = i / 60;
        if (i % 6 === 0) {
          t += 0.1;
          recibirInstantanea(b, t, V * t, 0, 0, 1);
        }
        muestrearRemoto(b, ahora + t, PARAMETROS_RED, s);
      }
    };
    ciclo(2000);
    gc?.();
    const antes = process.memoryUsage().heapUsed;
    ciclo(50_000);
    gc?.();
    const despues = process.memoryUsage().heapUsed;
    if (gc) expect(despues - antes).toBeLessThan(2 * 1024 * 1024);
    expect(Number.isFinite(s.x)).toBe(true);
  });
});
