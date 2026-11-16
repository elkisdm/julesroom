import { describe, expect, it } from 'vitest';
import { cajaDe, NIVEL_Y, plano } from '../mansion/plano';
import {
  crearMapaColision,
  crearMapaDeCajas,
  lineaLibre,
  moverConColision,
  puntoLibre,
} from './colision';
import type { SalidaMovimiento } from './colision';

const R = 0.3;

function salida(): SalidaMovimiento {
  return { x: 0, z: 0 };
}

/** Camina hasta `pasos` veces con el paso dado y devuelve la posición final. */
function caminar(
  mapa: ReturnType<typeof crearMapaColision>,
  x: number,
  z: number,
  dx: number,
  dz: number,
  pasos: number,
  radio = R,
): { x: number; z: number } {
  const s = salida();
  for (let i = 0; i < pasos; i++) {
    moverConColision(mapa, x, z, dx, dz, radio, s);
    x = s.x;
    z = s.z;
  }
  return { x, z };
}

const piso1 = crearMapaColision('piso1');

describe('puntoLibre', () => {
  it('el centro del atrio es transitable (el espejo de agua es plano)', () => {
    expect(puntoLibre(piso1, 0, 0, R)).toBe(true);
    expect(puntoLibre(piso1, 0, -3, R)).toBe(true);
  });

  it('un muro, un mueble y el exterior de la casa no son libres', () => {
    expect(puntoLibre(piso1, -10, 0, R)).toBe(false);
    expect(puntoLibre(piso1, -9.75, 0, R)).toBe(false);
    expect(puntoLibre(piso1, -15.4, -2.2, R)).toBe(false);
    expect(puntoLibre(piso1, 0, 12, R)).toBe(false);
    expect(puntoLibre(piso1, -20, 0, R)).toBe(false);
  });

  it('la piscina de la terraza no es transitable pero el deck sí', () => {
    expect(puntoLibre(piso1, 0, 6.5, R)).toBe(false);
    expect(puntoLibre(piso1, 0, 4.5, R)).toBe(true);
  });

  it('el vano de puerta es libre y el muro a su lado no', () => {
    expect(puntoLibre(piso1, -10, 3, R)).toBe(true);
    expect(puntoLibre(piso1, -10, 0, R)).toBe(false);
  });

  it('todo mueble sólido de la planta bloquea su centro; lo plano o colgado alto no', () => {
    for (const m of plano.muebles) {
      const nivel = plano.ambientes.find((a) => a.id === m.ambiente)?.nivel;
      if (nivel !== 'piso1') continue;
      const c = cajaDe(m);
      const libre = puntoLibre(piso1, (c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, 0.05);
      const solido = m.alto > 0.15 && m.y < 1.7;
      expect(libre, m.id).toBe(!solido);
    }
  });

  it('respeta el nivel: el atrio es un vacío en el piso 2 y la pasarela es libre', () => {
    const piso2 = crearMapaColision('piso2');
    expect(puntoLibre(piso2, 0, 0, R)).toBe(false);
    expect(puntoLibre(piso2, 0, -3.25, R)).toBe(true);
  });

  it('el hueco de la escalera en el piso 3 no es transitable', () => {
    const piso3 = crearMapaColision('piso3');
    expect(puntoLibre(piso3, -3.2, 1, R)).toBe(false);
    expect(puntoLibre(piso3, 0, 0, R)).toBe(true);
  });
});

describe('escaleras del piso 1', () => {
  const R2 = 0.3;
  it('el cuerpo no se acerca a la escalera: queda un margen para los brazos', () => {
    const e = plano.escaleras[0]!.tramos[0]!;
    const borde = e.desde.x - e.ancho / 2;
    expect(puntoLibre(piso1, borde - R2 - 0.1, 0, R2)).toBe(false);
    expect(puntoLibre(piso1, borde - R2 - 0.3, 0, R2)).toBe(true);
  });

  it('caminar hacia la escalera se detiene antes de ella', () => {
    const e = plano.escaleras[0]!.tramos[0]!;
    const borde = e.desde.x - e.ancho / 2;
    const s = salida();
    moverConColision(piso1, 1.5, 0, 3, 0, R2, s);
    expect(s.x).toBeLessThanOrEqual(borde - R2);
    expect(s.x).toBeGreaterThan(1.5);
  });

  it('las escaleras de otros niveles no estorban en el piso 1', () => {
    expect(puntoLibre(piso1, -3.2, 0, R2)).toBe(true);
  });
});

describe('moverConColision', () => {
  it('sin obstáculos avanza lo pedido', () => {
    const s = salida();
    moverConColision(piso1, 0, -2, 0.5, 0.1, R, s);
    expect(s.x).toBeCloseTo(0.5, 9);
    expect(s.z).toBeCloseTo(-1.9, 9);
  });

  it('no atraviesa un muro aunque el paso sea de 1 m', () => {
    const fin = caminar(piso1, -8, -3, -1, 0, 30);
    expect(fin.x).toBeGreaterThanOrEqual(-10 + 0.1 + R - 1e-6);
    expect(fin.x).toBeLessThan(-9.5);
    const fin2 = caminar(piso1, -8, -3, -5, 0, 5);
    expect(fin2.x).toBeGreaterThanOrEqual(-10 + 0.1 + R - 1e-6);
  });

  it('no atraviesa un mueble con un paso grande', () => {
    // Isla de la cocina: x 7..10, z -1.35..-0.25.
    const s = salida();
    moverConColision(piso1, 5, -0.8, 6, 0, R, s);
    expect(s.x).toBeLessThanOrEqual(7 - R + 1e-6);
    expect(puntoLibre(piso1, s.x, s.z, R)).toBe(true);
  });

  it('desliza en diagonal contra una pared', () => {
    const s = salida();
    moverConColision(piso1, -9.5, -3, -0.5, 0.5, R, s);
    expect(s.x).toBeGreaterThanOrEqual(-10 + 0.1 + R - 1e-6);
    expect(s.z).toBeGreaterThan(-3 + 0.4);
  });

  it('pasa por un vano de puerta pero no por el muro de al lado', () => {
    const porVano = caminar(piso1, -8, 3, -0.1, 0, 40);
    expect(porVano.x).toBeLessThan(-11);
    const porMuro = caminar(piso1, -8, -3, -0.1, 0, 40);
    expect(porMuro.x).toBeGreaterThan(-10);
  });

  it('el atrio es transitable en el centro', () => {
    // Hasta el borde de la escalera del lado este (que sí bloquea), el centro del atrio es libre.
    const fin = caminar(piso1, -3, 0, 0.5, 0, 10);
    expect(fin.x).toBeCloseTo(2, 6);
    expect(fin.z).toBeCloseTo(0, 6);
  });

  it('un radio mayor deja de caber por el vano', () => {
    const fin = caminar(piso1, -8, 3, -0.1, 0, 40, 0.7);
    expect(fin.x).toBeGreaterThan(-10);
  });

  it('una caminata aleatoria con pasos de hasta 1 m nunca termina en un lugar no libre', () => {
    let semilla = 12345;
    const azar = () => {
      semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0;
      return semilla / 4294967296;
    };
    const s = salida();
    let x = 0;
    let z = 0;
    for (let i = 0; i < 20_000; i++) {
      moverConColision(piso1, x, z, (azar() - 0.5) * 2, (azar() - 0.5) * 2, R, s);
      x = s.x;
      z = s.z;
      if (!puntoLibre(piso1, x, z, R)) throw new Error(`no libre en ${x}, ${z} (paso ${i})`);
    }
    expect(Number.isFinite(x)).toBe(true);
  });

  it('un movimiento nulo o inválido no produce NaN', () => {
    const s = salida();
    moverConColision(piso1, 1, 1, 0, 0, R, s);
    expect(s).toEqual({ x: 1, z: 1 });
  });
});

describe('lineaLibre', () => {
  it('libre dentro de una sala, bloqueada por un muro y libre por el vano', () => {
    expect(lineaLibre(piso1, -5, -3, -5, 2, R)).toBe(true);
    expect(lineaLibre(piso1, -8, -3, -12, -3, R)).toBe(false);
    expect(lineaLibre(piso1, -8, 3, -12, 3, R)).toBe(true);
  });

  it('un mueble en el camino la bloquea', () => {
    expect(lineaLibre(piso1, 5, -0.8, 12, -0.8, R)).toBe(false);
    expect(lineaLibre(piso1, 5, 1.5, 12, 1.5, R)).toBe(true);
  });

  it('un punto es una línea de largo 0', () => {
    expect(lineaLibre(piso1, 0, 0, 0, 0, R)).toBe(true);
    expect(lineaLibre(piso1, -10, 0, -10, 0, R)).toBe(false);
  });
});

describe('crearMapaDeCajas', () => {
  it('construye un mapa a partir de cajas y límites', () => {
    const limites = { x0: 0, x1: 10, z0: 0, z1: 10 };
    const m = crearMapaDeCajas([{ x0: 4, x1: 6, z0: 4, z1: 6 }], limites);
    expect(puntoLibre(m, 5, 5, R)).toBe(false);
    expect(puntoLibre(m, 1, 1, R)).toBe(true);
    expect(puntoLibre(m, -1, 1, R)).toBe(false);
  });
});

describe('niveles', () => {
  it('todos los niveles construyen su mapa', () => {
    for (const n of Object.keys(NIVEL_Y) as (keyof typeof NIVEL_Y)[]) {
      expect(() => crearMapaColision(n)).not.toThrow();
    }
  });
});
