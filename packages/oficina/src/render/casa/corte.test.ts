import { describe, expect, it } from 'vitest';
import { NIVEL_Y, plano } from '../../mansion/plano';
import {
  actualizarLadosOcultos,
  alturaDeCorte,
  alturaDeCorteSeguir,
  corteSeguirSuave,
  nivelOculto,
  SIN_CORTE,
  sinLadosOcultos,
  sobreElCorte,
  UMBRAL_MOSTRAR,
  UMBRAL_OCULTAR,
} from './corte';

/** Dirección horizontal a la cámara a `grados` del frente (z+), positivo hacia el este. */
const desde = (grados: number): [number, number] => {
  const a = (grados * Math.PI) / 180;
  return [Math.sin(a), Math.cos(a)];
};
const ocultos = (dx: number, dz: number, previo = sinLadosOcultos()) => {
  actualizarLadosOcultos(previo, dx, dz);
  return previo;
};

describe('actualizarLadosOcultos', () => {
  it('de frente solo se oculta el sur: el este, el oeste y el fondo quedan a la vista', () => {
    expect(ocultos(0, 1)).toEqual({ ...sinLadosOcultos(), sur: true });
  });

  it('desde atrás se oculta el norte (el muro cortina)', () => {
    expect(ocultos(0, -1)).toEqual({ ...sinLadosOcultos(), norte: true });
  });

  it('desde el este se oculta el este y desde el oeste el oeste', () => {
    expect(ocultos(1, 0)).toEqual({ ...sinLadosOcultos(), este: true });
    expect(ocultos(-1, 0)).toEqual({ ...sinLadosOcultos(), oeste: true });
  });

  it('en diagonal (noreste) se ocultan los dos costados que quedan delante', () => {
    expect(ocultos(...desde(135))).toEqual({ ...sinLadosOcultos(), norte: true, este: true });
  });

  it('histéresis: entre los dos umbrales mantiene lo que tenía', () => {
    const entre = Math.acos((UMBRAL_OCULTAR + UMBRAL_MOSTRAR) / 2);
    const [dx, dz] = [Math.cos(entre), Math.sin(entre)]; // coseno con el este = el del medio
    expect(ocultos(dx, dz).este).toBe(false);
    expect(ocultos(dx, dz, { ...sinLadosOcultos(), este: true }).este).toBe(true);
  });

  it('un giro lento de la cámara no parpadea: cambia una sola vez en cada sentido', () => {
    const estado = sinLadosOcultos();
    const cambios: boolean[] = [];
    let anterior = false;
    // De 0° a 90° y de vuelta, con micro-temblor de 0,5° encima.
    for (let i = 0; i <= 400; i++) {
      const base = i <= 200 ? i * 0.45 : (400 - i) * 0.45;
      const [dx, dz] = desde(base + (i % 2 === 0 ? 0.5 : -0.5));
      actualizarLadosOcultos(estado, dx, dz);
      if (estado.este !== anterior) {
        cambios.push(estado.este);
        anterior = estado.este;
      }
    }
    expect(cambios).toEqual([true, false]);
  });

  it('informa si hubo cambio', () => {
    const estado = sinLadosOcultos();
    expect(actualizarLadosOcultos(estado, 1, 0)).toBe(true);
    expect(actualizarLadosOcultos(estado, 1, 0)).toBe(false);
  });

  it('justo sobre el punto de mira (cenital) no cambia nada', () => {
    const estado = { ...sinLadosOcultos(), este: true };
    expect(actualizarLadosOcultos(estado, 0, 0)).toBe(false);
    expect(estado.este).toBe(true);
  });
});

describe('alturaDeCorte', () => {
  const ambiente = (id: string) => {
    const a = plano.ambientes.find((x) => x.id === id);
    if (!a) throw new Error(id);
    return a;
  };

  it('sin ambiente o en la terraza (sin techo) no hay corte', () => {
    expect(alturaDeCorte(null)).toBe(SIN_CORTE);
    expect(alturaDeCorte(ambiente('terraza'))).toBe(SIN_CORTE);
  });

  it('en un ambiente corta justo bajo su cielo, para llevarse también los listones', () => {
    const corte = alturaDeCorte(ambiente('ventas'));
    expect(corte).toBeLessThan(3.9 + 3.6);
    expect(corte).toBeGreaterThan(3.9 + 3.6 - 0.2);
  });

  it('el atrio, de doble altura, corta más arriba que el living', () => {
    expect(alturaDeCorte(ambiente('atrio'))).toBeGreaterThan(alturaDeCorte(ambiente('living')));
  });
});

describe('nivelOculto', () => {
  it('dentro del living (piso 1) se ocultan el piso 2, el 3 y la torre; el piso 1 no', () => {
    const corte = alturaDeCorte(plano.ambientes.find((a) => a.id === 'living') ?? null);
    expect(nivelOculto('piso1', corte)).toBe(false);
    expect(nivelOculto('piso2', corte)).toBe(true);
    expect(nivelOculto('piso3', corte)).toBe(true);
    expect(nivelOculto('torre', corte)).toBe(true);
  });

  it('dentro de Ventas (piso 2) se ocultan solo el piso 3 y la torre', () => {
    const corte = alturaDeCorte(plano.ambientes.find((a) => a.id === 'ventas') ?? null);
    expect(nivelOculto('piso2', corte)).toBe(false);
    expect(nivelOculto('piso3', corte)).toBe(true);
    expect(nivelOculto('torre', corte)).toBe(true);
  });

  it('en el atrio (7,5 m) el piso 2 se ve y el 3 no', () => {
    const corte = alturaDeCorte(plano.ambientes.find((a) => a.id === 'atrio') ?? null);
    expect(nivelOculto('piso2', corte)).toBe(false);
    expect(nivelOculto('piso3', corte)).toBe(true);
  });

  it('sin corte nada se oculta', () => {
    for (const n of ['piso1', 'piso2', 'piso3', 'torre'] as const) {
      expect(nivelOculto(n, SIN_CORTE)).toBe(false);
    }
  });
});

describe('sobreElCorte', () => {
  it('una persona de un piso de arriba se oculta; la del piso del ambiente no', () => {
    const corte = alturaDeCorte(plano.ambientes.find((a) => a.id === 'ventas') ?? null);
    expect(sobreElCorte(3.9, corte)).toBe(false);
    expect(sobreElCorte(7.8, corte)).toBe(true);
  });
});

describe('alturaDeCorteSeguir', () => {
  it('corta bajo el cielo del piso de quien se sigue', () => {
    expect(alturaDeCorteSeguir(0)).toBeCloseTo(3.5, 6);
    expect(alturaDeCorteSeguir(3.9)).toBeCloseTo(7.4, 6);
    expect(alturaDeCorteSeguir(7.8)).toBeCloseTo(11.3, 6);
  });

  it('en la torre, el último nivel, no hay corte', () => {
    expect(alturaDeCorteSeguir(11.7)).toBe(SIN_CORTE);
  });

  it('en la escalera nunca queda bajo los pies de la persona', () => {
    for (let y = 0; y < 11.7; y += 0.05) expect(alturaDeCorteSeguir(y)).toBeGreaterThan(y);
  });

  it('subiendo por el hueco de la losa de arriba, esa losa queda oculta (no tapa a la persona)', () => {
    // Caracol: los pies a 9,6 m (cabeza a 11,5) suben por el hueco de la losa de la torre (base 11,4).
    expect(nivelOculto('torre', alturaDeCorteSeguir(9.6))).toBe(true);
    expect(nivelOculto('piso2', alturaDeCorteSeguir(2.2))).toBe(true);
  });
});

describe('corteSeguirSuave', () => {
  const DT = 1 / 60;

  /** Sube (o baja) de `y0` a `y1` a `v` m/s y devuelve el corte de cada cuadro, partiendo del corte exacto. */
  function recorrido(y0: number, y1: number, v: number): { y: number; corte: number }[] {
    const sentido = Math.sign(y1 - y0);
    const filas: { y: number; corte: number }[] = [];
    let y = y0;
    let corte = alturaDeCorteSeguir(y0);
    while ((y1 - y) * sentido > 0) {
      y += sentido * v * DT;
      corte = corteSeguirSuave(corte, y, DT);
      filas.push({ y, corte });
    }
    return filas;
  }

  it('el corte exacto salta de golpe al pasar de planta; el suave lo hace en muchos cuadros', () => {
    const filas = recorrido(3.0, 5.0, 0.8);
    let salto = 0;
    let saltoExacto = 0;
    for (let i = 1; i < filas.length; i++) {
      const a = filas[i - 1] as { y: number; corte: number };
      const b = filas[i] as { y: number; corte: number };
      salto = Math.max(salto, Math.abs(b.corte - a.corte));
      saltoExacto = Math.max(
        saltoExacto,
        Math.abs(alturaDeCorteSeguir(b.y) - alturaDeCorteSeguir(a.y)),
      );
    }
    expect(saltoExacto).toBeGreaterThan(1.5);
    expect(salto).toBeLessThan(0.15);
  });

  it.each([
    ['subiendo del piso 1 al 2', 0, 4.2, 0.8],
    ['bajando del piso 3 al 2', 7.8, 3.5, 1.2],
    ['subiendo corriendo del 2 al 3', 3.9, 8.2, 2.2],
  ])('%s: nunca queda bajo los pies y termina en el corte del piso nuevo', (_n, y0, y1, v) => {
    const filas = recorrido(y0, y1, v);
    for (const { y, corte } of filas) expect(corte).toBeGreaterThan(y);
    let corte = (filas.at(-1) as { corte: number }).corte;
    for (let i = 0; i < 240; i++) corte = corteSeguirSuave(corte, y1, DT);
    expect(corte).toBeCloseTo(alturaDeCorteSeguir(y1), 6);
  });

  it('sin corte (torre) o sin corte previo, cambia de golpe', () => {
    expect(corteSeguirSuave(7.4, 11.7, DT)).toBe(SIN_CORTE);
    expect(corteSeguirSuave(SIN_CORTE, 0, DT)).toBeCloseTo(3.5, 6);
    expect(corteSeguirSuave(Number.NaN, 3.9, DT)).toBeCloseTo(7.4, 6);
  });

  it.each([
    ['bajando a paso de juego', 1.2],
    ['bajando corriendo', 2.2],
  ])('%s: la losa de arriba se oculta en cuanto el corte exacto la oculta, sin retraso', (_n, v) => {
    const filas = recorrido(NIVEL_Y.piso2 + 0.5, 1.5, v);
    const ocultaExacta = filas.filter(({ y }) => nivelOculto('piso2', alturaDeCorteSeguir(y)));
    expect(ocultaExacta.length).toBeGreaterThan(10);
    for (const { y, corte } of ocultaExacta) {
      expect(nivelOculto('piso2', corte)).toBe(true);
      expect(corte).toBeGreaterThan(y); // y nunca bajo los pies
    }
  });

  it('bajar no suaviza; subir sí (un solo sentido de cambio brusco)', () => {
    expect(corteSeguirSuave(7.4, 3.0, DT)).toBeCloseTo(alturaDeCorteSeguir(3.0), 6);
    expect(corteSeguirSuave(3.5, 3.95, DT)).toBeLessThan(alturaDeCorteSeguir(3.95) - 1);
  });
});
