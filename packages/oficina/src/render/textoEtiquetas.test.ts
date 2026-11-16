import { describe, expect, it } from 'vitest';
import {
  apilarEtiquetas,
  disponerTexto,
  elegirEtiquetas,
  escalaEtiqueta,
  etiquetaEnRadio,
  otraPlanta,
  yDibujada,
  type RectEtiqueta,
} from './textoEtiquetas';

const uno = () => 1;
const cand = (
  id: string,
  distancia: number,
  extra: Partial<{ seleccionado: boolean; hablando: boolean }> = {},
) => ({
  id,
  distancia,
  seleccionado: false,
  hablando: false,
  ...extra,
});

describe('disponerTexto', () => {
  it('centra el texto en x=0 de forma simétrica', () => {
    const r = disponerTexto('ab', uno, 1);
    expect(r.ancho).toBe(2);
    expect(r.caracteres.map((k) => k.x)).toEqual([-1, 0]);
  });

  it('escala por el tamaño', () => {
    const r = disponerTexto('ab', uno, 2);
    expect(r.ancho).toBe(4);
    expect(r.caracteres.map((k) => k.x)).toEqual([-2, 0]);
  });

  it('usa el avance de ? y luego 0.5 em para caracteres desconocidos', () => {
    const conInterrogante = (c: string) => (c === '?' ? 0.8 : c === 'a' ? 1 : NaN);
    expect(disponerTexto('aZ', conInterrogante, 1).ancho).toBeCloseTo(1.8);
    expect(disponerTexto('Z', () => NaN, 1).ancho).toBe(0.5);
  });

  it('texto vacío da ancho cero', () => {
    expect(disponerTexto('', uno, 1)).toEqual({ caracteres: [], ancho: 0 });
  });
});

describe('elegirEtiquetas', () => {
  it('incluye siempre seleccionados y hablando aunque max sea 0', () => {
    const r = elegirEtiquetas(
      [cand('a', 5, { seleccionado: true }), cand('b', 9, { hablando: true }), cand('c', 1)],
      0,
      new Set(),
      4,
    );
    expect(r).toEqual(['a', 'b']);
  });

  it('rellena hasta max por cercanía', () => {
    const r = elegirEtiquetas([cand('a', 3), cand('b', 1), cand('c', 2)], 2, new Set(), 4);
    expect(r).toEqual(['b', 'c']);
  });

  it('conserva un previo dentro de max+margen y no deja entrar a un nuevo en ese rango', () => {
    const cs = [cand('a', 1), cand('b', 2), cand('c', 3), cand('d', 4)];
    expect(elegirEtiquetas(cs, 2, new Set(['c']), 2)).toEqual(['a', 'c']);
    expect(elegirEtiquetas(cs, 2, new Set(['d']), 2)).toEqual(['a', 'd']);
    expect(elegirEtiquetas(cs, 2, new Set(), 2)).toEqual(['a', 'b']);
  });

  it('un previo fuera de max+margen pierde su etiqueta', () => {
    const cs = [cand('a', 1), cand('b', 2), cand('c', 3), cand('d', 4)];
    expect(elegirEtiquetas(cs, 1, new Set(['d']), 2)).toEqual(['a']);
  });

  it('es estable ante empates y sin parpadeo entre cuadros', () => {
    const cs = [cand('a', 2), cand('b', 2), cand('c', 2)];
    const f1 = elegirEtiquetas(cs, 2, new Set(), 1);
    const f2 = elegirEtiquetas([...cs].reverse(), 2, new Set(f1), 1);
    expect(f2.slice().sort()).toEqual(f1.slice().sort());
  });
});

describe('escalaEtiqueta', () => {
  const fov = Math.PI / 2;
  it('crece en la lejanía para mantener el mínimo en píxeles', () => {
    const e = escalaEtiqueta(100, 0.2, 12, fov, 1000);
    const px = (0.2 * e * 1000) / (2 * 100 * Math.tan(fov / 2));
    expect(px).toBeCloseTo(12);
  });
  it('vale 1 en cercanía', () => {
    expect(escalaEtiqueta(1, 0.2, 12, fov, 1000)).toBe(1);
  });
});

describe('apilarEtiquetas', () => {
  const rect = (
    id: string,
    x: number,
    y: number,
    distancia: number,
    extra: Partial<RectEtiqueta> = {},
  ): RectEtiqueta => ({ id, x, y, ancho: 60, alto: 14, distancia, forzada: false, ...extra });
  const apilar = (
    rects: RectEtiqueta[],
    previos: ReadonlyMap<string, number> = new Map(),
    maxNiveles = 3,
  ) => {
    const salida = new Map<string, number>();
    apilarEtiquetas(rects, { maxNiveles, ventaja: 0.5 }, previos, salida);
    return salida;
  };
  /** Rectángulos finales (centro x, base y − nivel × alto) de lo que se muestra. */
  const finales = (rects: RectEtiqueta[], niveles: Map<string, number>) =>
    rects
      .filter((r) => niveles.has(r.id))
      .map((r) => ({
        id: r.id,
        x: r.x,
        y: r.y - niveles.get(r.id)! * r.alto,
        w: r.ancho,
        h: r.alto,
      }));
  const hayChoque = (f: ReturnType<typeof finales>) =>
    f.some((a, i) =>
      f.some(
        (b, j) =>
          i < j && Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2,
      ),
    );

  it('dos etiquetas que no se tocan quedan en el nivel 0', () => {
    const n = apilar([rect('a', 0, 100, 5), rect('b', 200, 100, 6)]);
    expect([...n.entries()]).toEqual([
      ['a', 0],
      ['b', 0],
    ]);
  });

  it('sube la de atrás (la más lejana) cuando se solapan', () => {
    const n = apilar([rect('lejos', 10, 100, 9), rect('cerca', 0, 100, 3)]);
    expect(n.get('cerca')).toBe(0);
    expect(n.get('lejos')).toBe(1);
  });

  it('un grupo apretado queda sin solapes y la más lejana por encima del tope se descarta', () => {
    const rects = Array.from({ length: 8 }, (_, i) => rect(`p${i}`, i * 3, 100, 2 + i));
    const n = apilar(rects, new Map(), 3);
    expect(hayChoque(finales(rects, n))).toBe(false);
    expect(n.has('p0')).toBe(true);
    expect(n.has('p7')).toBe(false);
    expect(Math.max(...n.values())).toBeLessThanOrEqual(3);
  });

  it('el seleccionado o el que habla nunca se descarta ni se sube sobre uno normal', () => {
    const rects = [
      ...Array.from({ length: 6 }, (_, i) => rect(`p${i}`, i, 100, 1 + i)),
      rect('sel', 2, 100, 40, { forzada: true }),
    ];
    const n = apilar(rects, new Map(), 2);
    expect(n.get('sel')).toBe(0);
    expect(hayChoque(finales(rects, n))).toBe(false);
  });

  it('dos forzadas solapadas se apilan entre sí sin descartarse', () => {
    const rects = [
      rect('a', 0, 100, 5, { forzada: true }),
      rect('b', 5, 100, 6, { forzada: true }),
    ];
    const n = apilar(rects, new Map(), 0);
    expect(n.size).toBe(2);
    expect(hayChoque(finales(rects, n))).toBe(false);
  });

  it('es estable: casi empatadas en distancia, quien iba arriba sigue arriba', () => {
    const previos = new Map([
      ['a', 1],
      ['b', 0],
    ]);
    // `a` es algo más cercana que `b`, pero antes iba arriba: no se intercambian.
    const n = apilar([rect('a', 0, 100, 5.2), rect('b', 8, 100, 5.4)], previos);
    expect(n.get('a')).toBe(1);
    expect(n.get('b')).toBe(0);
  });

  it('sin ventaja suficiente el más cercano gana igual (la histéresis es acotada)', () => {
    const previos = new Map([['a', 1]]);
    const n = apilar([rect('a', 0, 100, 9), rect('b', 8, 100, 2)], previos);
    expect(n.get('b')).toBe(0);
    expect(n.get('a')).toBe(1);
  });

  it('vacía la salida anterior', () => {
    const salida = new Map<string, number>([['viejo', 2]]);
    apilarEtiquetas([rect('a', 0, 0, 1)], { maxNiveles: 3, ventaja: 0.5 }, new Map(), salida);
    expect([...salida.keys()]).toEqual(['a']);
  });
});

describe('apilarEtiquetas con el borde superior y la separación (caso real de «seguirme»)', () => {
  const TOPE = 45; // 5 % del alto de 900 px: donde el sombreador clava lo que pasa del borde
  const opciones = { maxNiveles: 3, ventaja: 0.5, separacion: 0.15, tope: TOPE };
  const r = (
    id: string,
    x: number,
    y: number,
    ancho: number,
    alto: number,
    distancia: number,
  ): RectEtiqueta => ({ id, x, y, ancho, alto, distancia, forzada: false });
  const sinChoques = (rects: RectEtiqueta[], niveles: Map<string, number>) => {
    const f = rects
      .filter((q) => niveles.has(q.id))
      .map((q) => ({ q, y: yDibujada(q, niveles.get(q.id)!, opciones) }));
    for (let i = 0; i < f.length; i++) {
      for (let j = i + 1; j < f.length; j++) {
        const a = f[i]!;
        const b = f[j]!;
        const sepY = ((a.q.alto + b.q.alto) / 2) * 1.15 - 1e-6;
        if (
          Math.abs(a.q.x - b.q.x) < (a.q.ancho + b.q.ancho) / 2 &&
          Math.abs(a.y - b.y) < sepY
        ) {
          return false;
        }
      }
    }
    return true;
  };

  it('«Persona 7» (y 42) y «Agente 24» (por encima del borde, y −149) no se montan', () => {
    const rects = [
      r('persona7', 871, 42, 62, 18, 3),
      r('agente24', 908, -149, 57, 16, 5),
      r('persona8', 860, 51, 63, 18, 4),
    ];
    const n = new Map<string, number>();
    apilarEtiquetas(rects, opciones, new Map(), n);
    expect(sinChoques(rects, n)).toBe(true);
    expect(n.has('agente24')).toBe(true);
  });

  it('las que pasan del borde se clavan en él y se apilan hacia abajo', () => {
    const rects = [r('a', 100, -149, 57, 16, 5), r('b', 110, -140, 57, 16, 6)];
    const n = new Map<string, number>();
    apilarEtiquetas(rects, opciones, new Map(), n);
    expect(rects.every((q) => q.abajo)).toBe(true);
    expect(yDibujada(rects[0]!, n.get('a')!, opciones)).toBeGreaterThanOrEqual(TOPE);
    expect(yDibujada(rects[1]!, n.get('b')!, opciones)).toBeGreaterThanOrEqual(TOPE);
    expect(sinChoques(rects, n)).toBe(true);
  });

  it('deja ~15 % del alto de línea entre dos etiquetas apiladas', () => {
    const rects = [r('a', 0, 400, 60, 20, 3), r('b', 5, 400, 60, 20, 4)];
    const n = new Map<string, number>();
    apilarEtiquetas(rects, opciones, new Map(), n);
    const a = yDibujada(rects[0]!, n.get('a')!, opciones);
    const b = yDibujada(rects[1]!, n.get('b')!, opciones);
    expect(Math.abs(a - b)).toBeCloseTo(23, 5);
  });

  it('un grupo denso cerca del borde y de las mesas termina sin ningún choque', () => {
    const rects = Array.from({ length: 12 }, (_, i) =>
      r(`p${i}`, 800 + i * 9, i % 2 ? -100 : 60, 60, 18, 2 + i * 0.3),
    );
    rects[0]!.forzada = true;
    const n = new Map<string, number>();
    apilarEtiquetas(rects, opciones, new Map(), n);
    expect(sinChoques(rects, n)).toBe(true);
  });
});

describe('etiquetaEnRadio', () => {
  it('cercano al avatar sí; lejano no', () => {
    expect(etiquetaEnRadio(3, 4.5, false)).toBe(true);
    expect(etiquetaEnRadio(4.5, 4.5, false)).toBe(true);
    expect(etiquetaEnRadio(9, 4.5, false)).toBe(false);
  });

  it('el seleccionado o quien habla se muestran a cualquier distancia', () => {
    expect(etiquetaEnRadio(30, 4.5, true)).toBe(true);
  });
});

describe('otraPlanta', () => {
  it('quien está a una altura de planta o más (arriba o abajo) es de otra planta', () => {
    expect(otraPlanta(3.9, 1.5, false)).toBe(true);
    expect(otraPlanta(-3.9, 1.5, false)).toBe(true);
    expect(otraPlanta(1.5, 1.5, false)).toBe(true);
  });

  it('en la misma planta (escalón o salto incluidos) no', () => {
    expect(otraPlanta(0, 1.5, false)).toBe(false);
    expect(otraPlanta(-0.4, 1.5, false)).toBe(false);
    expect(otraPlanta(1.2, 1.5, false)).toBe(false);
  });

  it('el seleccionado o quien habla se muestra aunque esté en otra planta', () => {
    expect(otraPlanta(3.9, 1.5, true)).toBe(false);
  });
});
