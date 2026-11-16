import v8 from 'node:v8';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { azarSemilla } from '../test-utils';
import { perfilDeRol } from './personalidad';
import {
  GESTOS_VIDA,
  avanzarVida,
  crearAjusteVida,
  crearVida,
  derivarTemperamento,
  semillaDe,
} from './vida';
import type { AjusteVida } from './vida';

const DT = 1 / 60;

function correlacion(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = (a[i] ?? 0) - ma;
    const db = (b[i] ?? 0) - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  return sab / Math.sqrt(saa * sbb);
}

function simular(id: string, segundos: number, quieto = true, semAzar = 1): AjusteVida[] {
  const v = crearVida(semillaDe(id));
  const azar = azarSemilla(semAzar);
  const s = crearAjusteVida();
  const salida: AjusteVida[] = [];
  for (let i = 0, t = 0; i < segundos * 60; i++, t += DT) {
    avanzarVida(v, DT, quieto, t, azar, s);
    salida.push({ ...s });
  }
  return salida;
}

describe('semillaDe y temperamento', () => {
  it('es estable y distingue identidades', () => {
    expect(semillaDe('ana')).toBe(semillaDe('ana'));
    expect(semillaDe('ana')).not.toBe(semillaDe('ana2'));
    expect(Number.isInteger(semillaDe('x'))).toBe(true);
  });

  it('las frecuencias caen en los rangos pedidos', () => {
    for (let i = 0; i < 200; i++) {
      const t = derivarTemperamento(semillaDe(`p${i}`));
      expect(t.frecRespiracion).toBeGreaterThanOrEqual(0.2);
      expect(t.frecRespiracion).toBeLessThanOrEqual(0.32);
      expect(t.periodoPeso).toBeGreaterThanOrEqual(6);
      expect(t.periodoPeso).toBeLessThanOrEqual(14);
      expect(t.intervaloParpadeo).toBeGreaterThanOrEqual(2);
      expect(t.intervaloParpadeo).toBeLessThanOrEqual(6);
    }
  });
});

describe('respiración', () => {
  it('dos semillas distintas no coinciden en fase tras 30 s', () => {
    const a = simular('ana', 30).map((x) => x.respiracion);
    const b = simular('bruno', 30).map((x) => x.respiracion);
    expect(derivarTemperamento(semillaDe('ana')).frecRespiracion).not.toBeCloseTo(
      derivarTemperamento(semillaDe('bruno')).frecRespiracion,
      3,
    );
    expect(Math.abs(correlacion(a, b))).toBeLessThan(0.5);
  });

  it('entre muchos vecinos casi nadie queda sincronizado', () => {
    const base = simular('v0', 30).map((x) => x.respiracion);
    let sincronizados = 0;
    for (let i = 1; i < 30; i++) {
      const otra = simular(`v${i}`, 30).map((x) => x.respiracion);
      if (correlacion(base, otra) > 0.8) sincronizados++;
    }
    expect(sincronizados).toBeLessThanOrEqual(1);
  });

  it('inhalar es más corto que exhalar y queda en [0, 1]', () => {
    const r = simular('ana', 40).map((x) => x.respiracion);
    expect(Math.min(...r)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...r)).toBeLessThanOrEqual(1);
    let subiendo = 0;
    let bajando = 0;
    for (let i = 1; i < r.length; i++) {
      const d = (r[i] ?? 0) - (r[i - 1] ?? 0);
      if (d > 1e-9) subiendo++;
      else if (d < -1e-9) bajando++;
    }
    expect(subiendo).toBeLessThan(bajando);
  });
});

describe('determinismo', () => {
  it('misma semilla y mismo azar dan la misma secuencia', () => {
    expect(simular('ana', 20)).toEqual(simular('ana', 20));
  });
  it('sin NaN con dt irregular entre 0 y 0,1', () => {
    const v = crearVida(semillaDe('ana'));
    const azar = azarSemilla(3);
    const s = crearAjusteVida();
    const dts = [0, 0.1, 0.001, 0.016, 0.05, 0.1, 0];
    for (let i = 0, t = 0; i < 5000; i++) {
      const dt = dts[i % dts.length] ?? 0;
      t += dt;
      avanzarVida(v, dt, i % 700 < 500, t, azar, s);
      for (const k of Object.keys(s) as (keyof AjusteVida)[]) {
        expect(Number.isFinite(Number(s[k]))).toBe(true);
      }
    }
  });
});

describe('cambio de peso', () => {
  it('es continuo a 60 Hz y cambia de pie con el tiempo', () => {
    const s = simular('ana', 60);
    let maxSalto = 0;
    let max = -Infinity;
    let min = Infinity;
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1] as AjusteVida;
      const b = s[i] as AjusteVida;
      maxSalto = Math.max(maxSalto, Math.abs(b.pesoCadera - a.pesoCadera));
      maxSalto = Math.max(maxSalto, Math.abs(b.alabeoPelvis - a.alabeoPelvis) * 0.2);
      max = Math.max(max, b.pesoCadera);
      min = Math.min(min, b.pesoCadera);
    }
    expect(maxSalto).toBeLessThan(0.003);
    expect(max).toBeGreaterThan(0.005);
    expect(min).toBeLessThan(-0.005);
  });

  it('la rodilla del pie libre se relaja y la del apoyo no', () => {
    for (const x of simular('ana', 30)) {
      expect(x.rodillaIzq).toBeGreaterThanOrEqual(0);
      expect(x.rodillaDer).toBeGreaterThanOrEqual(0);
      if (x.pesoCadera > 0.01) expect(x.rodillaIzq).toBeGreaterThan(x.rodillaDer);
      if (x.pesoCadera < -0.01) expect(x.rodillaDer).toBeGreaterThan(x.rodillaIzq);
    }
  });

  it('vuelve al centro cuando la persona se mueve', () => {
    const v = crearVida(semillaDe('ana'));
    const azar = azarSemilla(1);
    const s = crearAjusteVida();
    let t = 0;
    for (let i = 0; i < 60 * 30; i++, t += DT) avanzarVida(v, DT, true, t, azar, s);
    for (let i = 0; i < 60 * 3; i++, t += DT) avanzarVida(v, DT, false, t, azar, s);
    expect(Math.abs(s.pesoCadera)).toBeLessThan(0.002);
  });
});

describe('deriva de cabeza', () => {
  it('dos personas no se mueven a la vez y no pasan de unos grados', () => {
    const a = simular('ana', 30).map((x) => x.cabezaYaw);
    const b = simular('bruno', 30).map((x) => x.cabezaYaw);
    expect(Math.abs(correlacion(a, b))).toBeLessThan(0.6);
    expect(Math.max(...a.map(Math.abs))).toBeLessThan((10 * Math.PI) / 180);
    expect(Math.max(...a.map(Math.abs))).toBeGreaterThan(0.01);
  });
});

describe('parpadeo', () => {
  it('parpadea con intervalos de 2 a 6 s y a veces en doble', () => {
    const s = simular('ana', 600);
    const inicios: number[] = [];
    for (let i = 1; i < s.length; i++) {
      if ((s[i] as AjusteVida).parpadeo && !(s[i - 1] as AjusteVida).parpadeo) inicios.push(i * DT);
    }
    const largos: number[] = [];
    let dobles = 0;
    for (let i = 1; i < inicios.length; i++) {
      const g = (inicios[i] as number) - (inicios[i - 1] as number);
      if (g < 1) dobles++;
      else largos.push(g);
    }
    expect(inicios.length).toBeGreaterThan(80);
    expect(dobles).toBeGreaterThan(0);
    expect(dobles).toBeLessThan(inicios.length / 3);
    expect(Math.min(...largos)).toBeGreaterThanOrEqual(1.7);
    expect(Math.max(...largos)).toBeLessThanOrEqual(6.3);
  });

  it('cada parpadeo dura cerca de 120 ms', () => {
    const s = simular('ana', 120);
    let racha = 0;
    const duraciones: number[] = [];
    for (const x of s) {
      if (x.parpadeo) racha++;
      else if (racha > 0) {
        duraciones.push(racha * DT);
        racha = 0;
      }
    }
    for (const d of duraciones) {
      expect(d).toBeGreaterThan(0.08);
      expect(d).toBeLessThan(0.2);
    }
  });
});

describe('gestos', () => {
  it('no hay gestos mientras no está quieto', () => {
    for (const x of simular('ana', 300, false)) {
      expect(x.gestoVariante).toBe(-1);
      expect(x.gestoProgreso).toBe(0);
    }
  });

  it('quieto: hace gestos con progreso 0..1 y variantes válidas', () => {
    const s = simular('ana', 300);
    const vistas = new Set<number>();
    let max = 0;
    for (const x of s) {
      if (x.gestoVariante >= 0) {
        vistas.add(x.gestoVariante);
        expect(x.gestoVariante).toBeLessThan(GESTOS_VIDA.length);
        expect(x.gestoProgreso).toBeGreaterThanOrEqual(0);
        expect(x.gestoProgreso).toBeLessThanOrEqual(1);
        max = Math.max(max, x.gestoProgreso);
      }
    }
    expect(vistas.size).toBeGreaterThan(1);
    expect(max).toBeGreaterThan(0.95);
  });

  it('el perfil pondera qué gesto aparece', () => {
    const contador = (rol: string) => {
      const v = crearVida(semillaDe('ana'), perfilDeRol(rol));
      const azar = azarSemilla(5);
      const s = crearAjusteVida();
      const cuenta = new Map<number, number>();
      let previo = -1;
      for (let i = 0, t = 0; i < 60 * 3000; i++, t += DT) {
        avanzarVida(v, DT, true, t, azar, s);
        if (s.gestoVariante >= 0 && previo < 0) {
          cuenta.set(s.gestoVariante, (cuenta.get(s.gestoVariante) ?? 0) + 1);
        }
        previo = s.gestoVariante;
      }
      return cuenta;
    };
    const iRasca = GESTOS_VIDA.indexOf('rascarse_cabeza');
    const iTelefono = GESTOS_VIDA.indexOf('telefono');
    const ventas = contador('Ejecutivo de ventas');
    const contenido = contador('Guionista');
    expect(ventas.get(iTelefono) ?? 0).toBeGreaterThan(ventas.get(iRasca) ?? 0);
    expect(contenido.get(iRasca) ?? 0).toBeGreaterThan(contenido.get(iTelefono) ?? 0);
  });
});

describe('sin asignación', () => {
  it('50 000 llamadas no hacen crecer el heap más de 2 MB', () => {
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc') as () => void;
    const v = crearVida(semillaDe('ana'));
    const azar = azarSemilla(9);
    const s = crearAjusteVida();
    let t = 0;
    for (let i = 0; i < 5000; i++, t += DT) avanzarVida(v, DT, i % 900 < 600, t, azar, s);
    gc();
    const antes = process.memoryUsage().heapUsed;
    for (let i = 0; i < 50_000; i++, t += DT) avanzarVida(v, DT, i % 900 < 600, t, azar, s);
    gc();
    expect(process.memoryUsage().heapUsed - antes).toBeLessThan(2 * 1024 * 1024);
  });
});
