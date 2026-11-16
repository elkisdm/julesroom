import { describe, expect, it } from 'vitest';
import {
  PARAMETROS_LOCOMOCION as P,
  conducir,
  crearLocomocion,
  irHacia,
  type Locomocion,
} from './locomocion';
import { envolverAngulo } from './resorte';

const DT = 1 / 60;

/** Aplica `paso` durante `segundos` con pasos de `dt`. */
function correr(paso: (dt: number) => void, segundos: number, dt = DT): void {
  const n = Math.round(segundos / dt);
  for (let i = 0; i < n; i++) paso(dt);
}

/** Lleva a `l` a velocidad de crucero hacia +z. */
function crucero(l: Locomocion): void {
  correr((dt) => conducir(l, 0, 1, 1, P, dt), 3);
}

const finito = (l: Locomocion) =>
  [
    l.x,
    l.z,
    l.rumbo,
    l.velocidad,
    l.giro,
    l.fase,
    l.inclinacion.x,
    l.inclinacion.v,
    l.alabeo.x,
    l.alabeo.v,
    l.aceleracionLong,
    l.aceleracionLat,
  ].every(Number.isFinite);

describe('crearLocomocion', () => {
  it('nace quieta, en su sitio y con los resortes en reposo', () => {
    const l = crearLocomocion(2, -3, 1.2);
    expect([l.x, l.z, l.rumbo]).toEqual([2, -3, 1.2]);
    expect([l.velocidad, l.giro, l.fase, l.aceleracionLong, l.aceleracionLat]).toEqual([
      0, 0, 0, 0, 0,
    ]);
    expect(l.inclinacion).toEqual({ x: 0, v: 0 });
    expect(l.alabeo).toEqual({ x: 0, v: 0 });
    expect(l.ultimaPisada).toBe(0);
  });

  it('los parámetros por defecto son de juego: caminar ágil, correr y respuesta inmediata', () => {
    expect(P.velMax).toBeGreaterThanOrEqual(2);
    expect(P.velCorrer).toBeGreaterThan(1.5 * P.velMax);
    expect(P.velMax / P.aceleracion).toBeLessThanOrEqual(0.15);
    expect(P.frenado).toBeGreaterThan(P.aceleracion);
    expect(P.frenadoCorrer).toBeLessThan(P.frenado);
    expect(P.giroMax).toBeGreaterThanOrEqual(12);
  });
});

describe('conducir: arranque y frenado', () => {
  it('arranca sin escalón: velocidad continua y aceleración dentro del límite', () => {
    const l = crearLocomocion(0, 0, 0);
    let anterior = 0;
    let maxima = 0;
    for (let i = 0; i < 180; i++) {
      conducir(l, 0, 1, 1, P, DT);
      expect(Math.abs(l.velocidad - anterior)).toBeLessThanOrEqual(P.aceleracion * DT + 1e-9);
      expect(l.velocidad).toBeLessThanOrEqual(P.velMax + 1e-9);
      expect(Math.abs(l.aceleracionLong)).toBeLessThanOrEqual(P.aceleracion + 1e-6);
      maxima = Math.max(maxima, l.velocidad);
      anterior = l.velocidad;
    }
    expect(maxima).toBeCloseTo(P.velMax, 3);
  });

  it('anticipa: se contra-inclina hacia atrás antes de ir hacia delante', () => {
    const l = crearLocomocion(0, 0, 0);
    let minimo = 0;
    const tiempo = Math.floor(P.anticipacion / DT);
    for (let i = 0; i < tiempo; i++) {
      conducir(l, 0, 1, 1, P, DT);
      minimo = Math.min(minimo, l.inclinacion.x);
      expect(l.velocidad).toBe(0);
    }
    expect(minimo).toBeLessThan(0);
    let maximo = 0;
    for (let i = 0; i < 60; i++) {
      conducir(l, 0, 1, 1, P, DT);
      maximo = Math.max(maximo, l.inclinacion.x);
    }
    expect(maximo).toBeGreaterThan(0.03);
  });

  it('se inclina hacia delante al acelerar y hacia atrás al frenar, con rebase pequeño al detenerse', () => {
    const l = crearLocomocion(0, 0, 0);
    crucero(l);
    const steady = l.inclinacion.x;
    expect(steady).toBeGreaterThan(0);
    let minimo = 0;
    let rebase = 0;
    for (let i = 0; i < 240; i++) {
      conducir(l, 0, 1, 0, P, DT);
      minimo = Math.min(minimo, l.inclinacion.x);
      if (l.velocidad === 0) rebase = Math.max(rebase, l.inclinacion.x);
    }
    expect(minimo).toBeLessThan(-0.03);
    expect(rebase).toBeLessThan(0.1);
    expect(Math.abs(l.inclinacion.x)).toBeLessThan(1e-3);
  });

  it('la distancia de frenado es ~v²/2a', () => {
    const l = crearLocomocion(0, 0, 0);
    crucero(l);
    const v = l.velocidad;
    const z0 = l.z;
    correr((dt) => conducir(l, 0, 1, 0, P, dt), 2);
    expect(l.velocidad).toBe(0);
    expect(l.z - z0).toBeCloseTo((v * v) / (2 * P.frenado), 1);
  });
});

describe('irHacia', () => {
  it('llega y se detiene sin sobrepasar el destino más de radioLlegada', () => {
    const l = crearLocomocion(0, 0, 0);
    let pasadas = 0;
    let maxZ = 0;
    let llego = false;
    for (let i = 0; i < 60 * 12; i++) {
      llego = irHacia(l, 0, 5, P, DT);
      maxZ = Math.max(maxZ, l.z);
      if (llego) break;
      pasadas++;
    }
    expect(llego).toBe(true);
    expect(pasadas).toBeLessThan(60 * 10);
    expect(Math.hypot(l.x, l.z - 5)).toBeLessThanOrEqual(P.radioLlegada);
    expect(maxZ - 5).toBeLessThanOrEqual(P.radioLlegada);
    correr((dt) => irHacia(l, 0, 5, P, dt), 1);
    expect(l.velocidad).toBe(0);
  });

  it('con el destino en su sitio no se mueve y reporta que llegó', () => {
    const l = crearLocomocion(1, 1, 0.5);
    expect(irHacia(l, 1, 1, P, DT)).toBe(true);
    expect([l.x, l.z, l.rumbo]).toEqual([1, 1, 0.5]);
  });

  it('gira por el camino corto y nunca más rápido que giroMax', () => {
    const l = crearLocomocion(0, 0, 3);
    const dx = Math.sin(-3) * 10;
    const dz = Math.cos(-3) * 10;
    let anterior = l.rumbo;
    let primero = true;
    for (let i = 0; i < 60; i++) {
      irHacia(l, dx, dz, P, DT);
      const paso = envolverAngulo(l.rumbo - anterior);
      expect(Math.abs(paso)).toBeLessThanOrEqual(P.giroMax * DT + 1e-9);
      if (primero) expect(paso).toBeGreaterThan(0); // sube hacia π en vez de bajar por 0
      primero = false;
      anterior = l.rumbo;
    }
    expect(Math.abs(envolverAngulo(l.rumbo - -3))).toBeLessThan(0.05);
  });

  it('con el rumbo muy desviado avanza despacio para girar con radio', () => {
    const l = crearLocomocion(0, 0, Math.PI);
    let maximaVel = 0;
    for (let i = 0; i < 2; i++) {
      irHacia(l, 0, 5, P, DT);
      maximaVel = Math.max(maximaVel, l.velocidad);
    }
    expect(maximaVel).toBeLessThanOrEqual(P.fraccionGiroCerrado * P.velMax + 1e-9);
    expect(maximaVel).toBeGreaterThan(0);
  });
});

describe('inclinación al cruzar de un lado a otro', () => {
  it('corriendo, frenar y arrancar en la media vuelta no dobla el cuerpo más del tope', () => {
    const l = crearLocomocion(0, 0, 0);
    l.velocidad = P.velCorrer;
    let maximo = 0;
    for (let i = 0; i < 160; i++) {
      const haciaAtras = Math.floor(i / 40) % 2 === 1;
      conducir(l, 0.02, haciaAtras ? -1 : 1, P.velCorrer / P.velMax, P, DT);
      maximo = Math.max(maximo, Math.abs(l.inclinacion.x));
    }
    // Un resorte subamortiguado puede rebasar un poco su objetivo; nunca debe pasar de ~8°.
    expect(P.inclinacionMax).toBeLessThanOrEqual(0.12);
    expect(maximo).toBeLessThanOrEqual(0.14);
  });
});

describe('alabeo', () => {
  it.each([
    [1.5, 1],
    [-1.5, -1],
  ])('hacia el ángulo %f el alabeo tiene el signo %i de la curva', (angulo, signo) => {
    const l = crearLocomocion(0, 0, 0);
    l.velocidad = P.velMax;
    let alabeo = 0;
    conducir(l, Math.sin(angulo), Math.cos(angulo), 1, P, DT);
    expect(Math.sign(l.giro)).toBe(signo);
    expect(Math.sign(l.aceleracionLat)).toBe(signo);
    for (let i = 0; i < 10; i++) {
      conducir(l, Math.sin(angulo), Math.cos(angulo), 1, P, DT);
      if (Math.abs(l.alabeo.x) > Math.abs(alabeo)) alabeo = l.alabeo.x;
    }
    expect(Math.sign(alabeo)).toBe(signo);
    expect(Math.abs(alabeo)).toBeGreaterThan(0.01);
  });

  it.each([
    ['caminando', P.velMax],
    ['corriendo', P.velCorrer],
  ])('%s, un cambio de dirección de 180° nunca ladea el cuerpo más del tope ni rebota', (_, v) => {
    const l = crearLocomocion(0, 0, 0);
    l.velocidad = v;
    let maximo = 0;
    let cambiosDeSigno = 0;
    let signoAnterior = 0;
    for (let i = 0; i < 120; i++) {
      // Recto, media vuelta a los 10 cuadros y otra a los 50: cruzar de un lado a otro.
      const dirX = i < 10 ? 0 : i < 50 ? 0.02 : -0.02;
      conducir(l, dirX, i >= 10 && i < 50 ? -1 : 1, v / P.velMax, P, DT);
      maximo = Math.max(maximo, Math.abs(l.alabeo.x));
      const signo = Math.abs(l.alabeo.x) > 1e-4 ? Math.sign(l.alabeo.x) : 0;
      if (signo !== 0 && signoAnterior !== 0 && signo !== signoAnterior) cambiosDeSigno++;
      if (signo !== 0) signoAnterior = signo;
    }
    expect(maximo).toBeLessThanOrEqual(P.alabeoMax + 1e-9);
    expect(P.alabeoMax).toBeLessThanOrEqual(0.08);
    // Sin rebase: el ladeo solo cambia de lado cuando cambia la curva (dos medias vueltas), no oscila.
    expect(cambiosDeSigno).toBeLessThanOrEqual(1);
  });

  it('en línea recta el alabeo es 0', () => {
    const l = crearLocomocion(0, 0, 0);
    crucero(l);
    expect(Math.abs(l.alabeo.x)).toBeLessThan(1e-6);
  });
});

describe('independencia de la tasa de cuadros', () => {
  it('conducir en recto: mismo recorrido (±3 cm en 3 s) con dt 1/30 y 1/144', () => {
    const a = crearLocomocion(0, 0, 0);
    const b = crearLocomocion(0, 0, 0);
    correr((dt) => conducir(a, 0, 1, 1, P, dt), 3, 1 / 30);
    correr((dt) => conducir(b, 0, 1, 1, P, dt), 3, 1 / 144);
    expect(Math.abs(a.z - b.z)).toBeLessThan(0.03);
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.03);
  });

  it('irHacia con giro: mismo recorrido (±3 cm en 3 s) con dt 1/30 y 1/144', () => {
    const a = crearLocomocion(0, 0, 0);
    const b = crearLocomocion(0, 0, 0);
    correr((dt) => irHacia(a, 2, 2, P, dt), 3, 1 / 30);
    correr((dt) => irHacia(b, 2, 2, P, dt), 3, 1 / 144);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.03);
  });
});

describe('fase y pisadas', () => {
  it('con velocidad cero la fase se congela', () => {
    const l = crearLocomocion(0, 0, 0);
    crucero(l);
    correr((dt) => conducir(l, 0, 1, 0, P, dt), 2);
    expect(l.velocidad).toBe(0);
    const fase = l.fase;
    const pisadas = l.ultimaPisada;
    correr((dt) => conducir(l, 0, 1, 0, P, dt), 2);
    expect(l.fase).toBe(fase);
    expect(l.ultimaPisada).toBe(pisadas);
  });

  it('cuenta una pisada por medio ciclo y nunca más de una por cuadro a 60 Hz', () => {
    const l = crearLocomocion(0, 0, 0);
    let previa = 0;
    for (let i = 0; i < 60 * 5; i++) {
      conducir(l, 0, 1, 1, P, DT);
      expect(l.ultimaPisada - previa).toBeLessThanOrEqual(1);
      previa = l.ultimaPisada;
    }
    // ~4,2 pisadas por segundo caminando (cadencia 2,1 ciclos/s): unas 21 en 5 s
    expect(l.ultimaPisada).toBeGreaterThan(17);
    expect(l.ultimaPisada).toBeLessThan(25);
  });
});

describe('velocidades de juego', () => {
  const hasta = (l: ReturnType<typeof crearLocomocion>, meta: number, mag: number) => {
    let t = 0;
    while (Math.abs(l.velocidad - meta) > 0.01 && t < 2) {
      conducir(l, 0, 1, mag, P, DT);
      t += DT;
    }
    return t;
  };

  it('camina a velocidad plena en ≤ 0,15 s y corre en ≤ 0,3 s (con Shift)', () => {
    const l = crearLocomocion(0, 0, 0);
    expect(hasta(l, P.velMax, 1)).toBeLessThanOrEqual(0.15 + 1e-9);
    l.correr = true;
    expect(hasta(l, P.velCorrer, 1)).toBeLessThanOrEqual(0.3);
  });

  it('frena caminando en ≤ 0,15 s y corriendo derrapa un poco más', () => {
    const l = crearLocomocion(0, 0, 0);
    hasta(l, P.velMax, 1);
    expect(hasta(l, 0, 0)).toBeLessThanOrEqual(0.15);
    l.correr = true;
    hasta(l, P.velCorrer, 1);
    const z0 = l.z;
    const t = hasta(l, 0, 0);
    expect(t).toBeLessThanOrEqual(0.4);
    expect(l.z - z0).toBeGreaterThan(0.4); // derrape visible
  });

  it('irHacia corriendo no se pasa del destino', () => {
    const l = crearLocomocion(0, 0, 0);
    l.correr = true;
    let llego = false;
    let maxZ = 0;
    for (let i = 0; i < 600 && !llego; i++) {
      llego = irHacia(l, 0, 6, P, DT);
      maxZ = Math.max(maxZ, l.z);
    }
    expect(llego).toBe(true);
    expect(maxZ).toBeLessThan(6 + P.radioLlegada);
  });
});

describe('robustez', () => {
  it('sin NaN con dt = 0 y dt = 0,1, y dt = 0 no mueve nada', () => {
    const l = crearLocomocion(0, 0, 0);
    for (let i = 0; i < 20; i++) {
      conducir(l, 0.3, 1, 1, P, 0.1);
      irHacia(l, 3, -2, P, 0.1);
      expect(finito(l)).toBe(true);
    }
    const antes = JSON.stringify(l);
    conducir(l, 1, 0, 1, P, 0);
    irHacia(l, 3, -2, P, 0);
    expect(finito(l)).toBe(true);
    expect(JSON.stringify(l)).toBe(antes);
  });

  it('magnitud fuera de rango se limita a 0..1', () => {
    const l = crearLocomocion(0, 0, 0);
    correr((dt) => conducir(l, 0, 1, 5, P, dt), 3);
    expect(l.velocidad).toBeLessThanOrEqual(P.velMax + 1e-9);
    const q = crearLocomocion(0, 0, 0);
    correr((dt) => conducir(q, 0, 1, -1, P, dt), 1);
    expect(q.velocidad).toBe(0);
  });
});
