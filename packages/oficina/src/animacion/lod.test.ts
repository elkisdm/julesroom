import { describe, expect, it } from 'vitest';
import {
  crearLod,
  crearPresupuesto,
  decidirLod,
  iniciarCuadroLod,
  PARAMETROS_LOD,
  registrarCuadro,
} from './lod';
import type { EntradaLod, EstadoLod, PlanLod } from './lod';

const DT = 1 / 60;

function plan(): PlanLod {
  return { intervalo: 0, pausada: false, actualizar: false, dt: 0 };
}

function entrada(distancia: number, extra: Partial<EntradaLod> = {}): EntradaLod {
  return { distancia, enPantalla: true, seleccionado: false, habla: false, ...extra };
}

/** Avanza un cuadro y decide para cada persona; devuelve los planes copiados (la prueba puede asignar). */
function cuadro(
  e: EstadoLod,
  n: number,
  f: number,
  entradas: (i: number) => EntradaLod,
  dt = DT,
): PlanLod[] {
  iniciarCuadroLod(e, dt);
  const s = plan();
  const salida: PlanLod[] = [];
  for (let i = 0; i < n; i++) {
    decidirLod(e, i, entradas(i), f, s);
    salida.push({ ...s });
  }
  return salida;
}

describe('niveles por distancia', () => {
  it('los cercanos se actualizan en cada cuadro', () => {
    const e = crearLod(PARAMETROS_LOD, 16);
    for (let f = 0; f < 30; f++) {
      for (const p of cuadro(e, 8, f, () => entrada(5))) {
        expect(p.intervalo).toBe(1);
        expect(p.actualizar).toBe(true);
        expect(p.pausada).toBe(false);
      }
    }
  });

  it('cada rango de distancia tiene su intervalo (14 / 30 / 55 m)', () => {
    const e = crearLod(PARAMETROS_LOD, 8);
    const [a, b, c, d] = cuadro(e, 4, 0, (i) => entrada([10, 20, 40, 80][i] as number));
    expect([a?.intervalo, b?.intervalo, c?.intervalo, d?.intervalo]).toEqual([1, 2, 3, 4]);
  });

  it('los lejanos se actualizan cada N cuadros escalonados: nunca todos en el mismo', () => {
    for (const [dist, N] of [
      [20, 2],
      [40, 3],
      [80, 4],
    ] as const) {
      const e = crearLod(PARAMETROS_LOD, 16);
      const cuentas = new Array<number>(12).fill(0);
      for (let f = 0; f < 12; f++) {
        const planes = cuadro(e, 12, f, () => entrada(dist));
        const n = planes.filter((p) => p.actualizar).length;
        expect(n).toBeLessThan(12);
        expect(n).toBeGreaterThan(0);
        planes.forEach((p, i) => {
          if (p.actualizar) cuentas[i] = (cuentas[i] as number) + 1;
        });
      }
      for (const c of cuentas) expect(c).toBe(12 / N);
    }
  });

  it('seleccionado o hablando: siempre cada cuadro, aunque esté lejos o fuera de pantalla', () => {
    const e = crearLod(PARAMETROS_LOD, 4);
    for (let f = 0; f < 40; f++) {
      const [a, b, c] = cuadro(e, 3, f, (i) =>
        i === 0
          ? entrada(100, { seleccionado: true })
          : i === 1
            ? entrada(100, { habla: true, enPantalla: false })
            : entrada(100),
      );
      expect(a?.intervalo).toBe(1);
      expect(a?.actualizar).toBe(true);
      expect(b?.intervalo).toBe(1);
      expect(b?.actualizar).toBe(true);
      expect(b?.pausada).toBe(false);
      expect(c?.intervalo).toBe(4);
    }
  });
});

describe('fuera de pantalla', () => {
  it('queda pausada salvo un tope por cuadro, y a todas les toca de a poco', () => {
    const e = crearLod(PARAMETROS_LOD, 32);
    const n = 20;
    const vistas = new Array<number>(n).fill(0);
    for (let f = 0; f < 40; f++) {
      const planes = cuadro(e, n, f, () => entrada(10, { enPantalla: false }));
      const activas = planes.filter((p) => !p.pausada);
      expect(activas.length).toBeLessThanOrEqual(PARAMETROS_LOD.maxFueraDePantalla);
      expect(activas.every((p) => p.actualizar)).toBe(true);
      expect(planes.filter((p) => p.pausada).every((p) => !p.actualizar)).toBe(true);
      planes.forEach((p, i) => {
        if (p.actualizar) vistas[i] = (vistas[i] as number) + 1;
      });
    }
    for (const v of vistas) expect(v).toBeGreaterThanOrEqual(2);
  });

  it('el tope es un parámetro', () => {
    const e = crearLod({ ...PARAMETROS_LOD, maxFueraDePantalla: 1 }, 32);
    for (let f = 0; f < 30; f++) {
      const planes = cuadro(e, 20, f, () => entrada(10, { enPantalla: false }));
      expect(planes.filter((p) => !p.pausada).length).toBeLessThanOrEqual(1);
    }
  });

  it('al volver a pantalla retoma su intervalo y el dt acumula el tiempo pausado', () => {
    const e = crearLod(PARAMETROS_LOD, 4);
    let pausado = 0;
    let visible = false;
    for (let f = 0; f < 20; f++) {
      const [p] = cuadro(e, 1, f, () => entrada(5, { enPantalla: visible }));
      if (p && p.actualizar && !visible) pausado += p.dt;
    }
    visible = true;
    const [p] = cuadro(e, 1, 20, () => entrada(5, { enPantalla: true }));
    expect(p?.actualizar).toBe(true);
    expect(p?.intervalo).toBe(1);
    expect(p?.dt).toBeGreaterThan(0);
    expect(pausado + (p?.dt ?? 0)).toBeCloseTo(21 * DT, 9);
  });
});

describe('histéresis', () => {
  it('no cambia de nivel antes de ~30 cuadros', () => {
    const e = crearLod(PARAMETROS_LOD, 4);
    const intervalos: number[] = [];
    for (let f = 0; f < 80; f++) {
      const [p] = cuadro(e, 1, f, () => entrada(f < 5 ? 5 : 20));
      intervalos.push(p?.intervalo ?? 0);
    }
    for (let f = 0; f < PARAMETROS_LOD.cuadrosMinimos; f++) expect(intervalos[f]).toBe(1);
    expect(intervalos[79]).toBe(2);
  });

  it('sin parpadeo en el borde: ±10 % del umbral no cambia el nivel', () => {
    const e = crearLod(PARAMETROS_LOD, 4);
    let cambios = 0;
    let previo = -1;
    for (let f = 0; f < 600; f++) {
      const d = 14 + (f % 2 === 0 ? 1.3 : -1.3);
      const [p] = cuadro(e, 1, f, () => entrada(d));
      if (previo !== -1 && p?.intervalo !== previo) cambios++;
      previo = p?.intervalo ?? 0;
    }
    expect(cambios).toBe(0);
  });

  it('cruzar de verdad el umbral cambia y no vuelve atrás por ruido', () => {
    const e = crearLod(PARAMETROS_LOD, 4);
    let cambios = 0;
    let previo = -1;
    for (let f = 0; f < 600; f++) {
      // Se aleja de 10 a 20 m con ruido de ±1,3 m.
      const base = 10 + (10 * f) / 600;
      const d = base + (f % 2 === 0 ? 1.3 : -1.3);
      const [p] = cuadro(e, 1, f, () => entrada(d));
      if (previo !== -1 && p?.intervalo !== previo) cambios++;
      previo = p?.intervalo ?? 0;
    }
    expect(cambios).toBe(1);
    expect(previo).toBe(2);
  });
});

describe('dt acumulado', () => {
  it('suma exactamente los cuadros saltados', () => {
    const e = crearLod(PARAMETROS_LOD, 8);
    const dts = Array.from({ length: 90 }, (_, i) => 0.008 + 0.0001 * ((i * 7) % 13));
    const sumas = new Array<number>(6).fill(0);
    const ultimaVez = new Array<number>(6).fill(-1);
    let transcurrido = 0;
    const ultimoT = new Array<number>(6).fill(0);
    dts.forEach((dt, f) => {
      transcurrido += dt;
      const planes = cuadro(e, 6, f, (i) => entrada([5, 20, 20, 40, 40, 80][i] as number), dt);
      planes.forEach((p, i) => {
        if (!p.actualizar) return;
        sumas[i] = (sumas[i] as number) + p.dt;
        ultimaVez[i] = f;
        ultimoT[i] = transcurrido;
      });
    });
    // Cada persona acumuló todo el tiempo hasta su última actualización real.
    for (let i = 0; i < 6; i++) expect(sumas[i]).toBeCloseTo(ultimoT[i] as number, 9);
    // Y, con intervalo estable, cada dt vale la suma de los últimos N cuadros.
    const e2 = crearLod(PARAMETROS_LOD, 4);
    const dt2 = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09];
    const obtenidos: number[] = [];
    dt2.forEach((dt, f) => {
      const [p] = cuadro(e2, 1, f, () => entrada(40), dt);
      if (p?.actualizar) obtenidos.push(p.dt);
    });
    // Intervalo 3, indice 0: actualiza en los cuadros 0, 3, 6.
    expect(obtenidos).toHaveLength(3);
    expect(obtenidos[0]).toBeCloseTo(0.01, 12);
    expect(obtenidos[1]).toBeCloseTo(0.02 + 0.03 + 0.04, 12);
    expect(obtenidos[2]).toBeCloseTo(0.05 + 0.06 + 0.07, 12);
  });
});

describe('presupuesto', () => {
  it('sube los intervalos si el promedio supera el presupuesto y se recupera con holgura', () => {
    const pres = crearPresupuesto(2);
    const e = crearLod(PARAMETROS_LOD, 8, pres);
    expect(pres.escala).toBe(0);
    for (let f = 0; f < 200; f++) registrarCuadro(pres, 3);
    expect(pres.escala).toBeGreaterThanOrEqual(1);
    const [cercano, seleccionado] = cuadro(e, 2, 0, (i) =>
      i === 0 ? entrada(5) : entrada(5, { seleccionado: true }),
    );
    expect(cercano?.intervalo).toBe(PARAMETROS_LOD.intervalos[pres.escala]);
    expect(seleccionado?.intervalo).toBe(1);
    const escalaAlta = pres.escala;

    // Dentro de la banda de histéresis (entre 75 % y 100 %): no cambia.
    for (let f = 0; f < 300; f++) registrarCuadro(pres, 1.8);
    expect(pres.escala).toBe(escalaAlta);

    // Con holgura (< 75 %) baja hasta 0.
    for (let f = 0; f < 600; f++) registrarCuadro(pres, 0.5);
    expect(pres.escala).toBe(0);
    const [normal] = cuadro(e, 1, 1000, () => entrada(5));
    expect(normal?.intervalo).toBe(1);
  });

  it('la escala tiene tope y no oscila dentro de un cuadro', () => {
    const pres = crearPresupuesto(1);
    for (let f = 0; f < 5000; f++) registrarCuadro(pres, 50);
    expect(pres.escala).toBeLessThanOrEqual(3);
    expect(pres.escala).toBeGreaterThan(0);
  });

  it('un presupuesto holgado nunca sube la escala', () => {
    const pres = crearPresupuesto(10);
    for (let f = 0; f < 1000; f++) registrarCuadro(pres, 2);
    expect(pres.escala).toBe(0);
  });
});

describe('robustez', () => {
  it('un índice fuera de capacidad se actualiza siempre', () => {
    const e = crearLod(PARAMETROS_LOD, 2);
    iniciarCuadroLod(e, DT);
    const s = plan();
    decidirLod(e, 99, entrada(80), 0, s);
    expect(s.actualizar).toBe(true);
    expect(s.intervalo).toBe(1);
  });

  it('no asigna memoria en el bucle por cuadro', () => {
    const gc = (globalThis as { gc?: () => void }).gc;
    const pres = crearPresupuesto(2);
    const e = crearLod(PARAMETROS_LOD, 128, pres);
    const s = plan();
    const ent = entrada(30);
    const bucle = (k: number) => {
      for (let f = 0; f < k; f++) {
        iniciarCuadroLod(e, DT);
        for (let i = 0; i < 100; i++) {
          ent.distancia = 5 + ((i * 3 + f) % 80);
          ent.enPantalla = i % 5 !== 0;
          decidirLod(e, i, ent, f, s);
        }
        registrarCuadro(pres, 1 + (f % 7) * 0.5);
      }
    };
    bucle(200);
    gc?.();
    const antes = process.memoryUsage().heapUsed;
    bucle(2000);
    gc?.();
    const despues = process.memoryUsage().heapUsed;
    if (gc) expect(despues - antes).toBeLessThan(2 * 1024 * 1024);
  });
});
