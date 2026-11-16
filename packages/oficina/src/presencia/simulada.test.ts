import { PARAMETROS_LOCOMOCION } from '../animacion/locomocion';
import { describe, expect, it, vi } from 'vitest';
import { accionesDe } from '../escenarios/acciones';
import { puntoDeReunion } from '../escenarios/reuniones';
import { escenarioTrading } from '../escenarios/trading';
import type { AccionSentarse } from '../escenarios/tipos';
import { azarSemilla } from '../test-utils';
import {
  crearFuenteSimulada,
  LIMITES_SIMULADOS,
  NOMBRES_EJEMPLO,
  PARAMETROS_SEPARACION_AVATAR,
  PARAMETROS_SEPARACION_ENTRE,
  puntoLibreEn,
} from './simulada';

const dentro = (x: number, z: number) =>
  Math.abs(x) <= LIMITES_SIMULADOS.semilado && Math.abs(z) <= LIMITES_SIMULADOS.semilado;

describe('fuente de presencia simulada', () => {
  it('crea la cantidad pedida con ids únicos y atuendo completo', () => {
    const f = crearFuenteSimulada({ cantidad: 3, semilla: 1 });
    const ps = f.personas();
    expect(ps).toHaveLength(3);
    expect(new Set(ps.map((p) => p.id)).size).toBe(3);
    for (const p of ps) {
      expect(p.nombre).not.toBe('');
      expect(p.atuendo.skin).not.toBe('');
      expect(p.atuendo.acc).toBeInstanceOf(Array);
    }
  });

  it('cantidad 0 es una sala vacía', () => {
    expect(crearFuenteSimulada({ cantidad: 0, semilla: 1 }).personas()).toEqual([]);
  });

  it('con la misma semilla el recorrido es idéntico; con otra, distinto', () => {
    const a = crearFuenteSimulada({ cantidad: 2, semilla: 7 });
    const b = crearFuenteSimulada({ cantidad: 2, semilla: 7 });
    const c = crearFuenteSimulada({ cantidad: 2, semilla: 8 });
    for (let i = 0; i < 100; i++) {
      a.avanzar(0.1);
      b.avanzar(0.1);
      c.avanzar(0.1);
    }
    expect(a.personas()).toEqual(b.personas());
    expect(a.personas()).not.toEqual(c.personas());
  });

  it('se mueven, se quedan dentro de los límites y el rumbo sigue la dirección del paso', () => {
    const f = crearFuenteSimulada({ cantidad: 5, semilla: 3 });
    const antes = f.personas().map((p) => ({ x: p.x, z: p.z }));
    let se_movio = false;
    for (let i = 0; i < 600; i++) {
      const previas = f.personas().map((p) => ({ x: p.x, z: p.z }));
      f.avanzar(0.05);
      f.personas().forEach((p, k) => {
        expect(dentro(p.x, p.z)).toBe(true);
        const q = previas[k];
        const dx = p.x - (q?.x ?? 0);
        const dz = p.z - (q?.z ?? 0);
        if (Math.hypot(dx, dz) > 1e-3) {
          const dif = Math.atan2(
            Math.sin(p.rumbo - Math.atan2(dx, dz)),
            Math.cos(p.rumbo - Math.atan2(dx, dz)),
          );
          expect(Math.abs(dif)).toBeLessThan(0.6);
        }
      });
    }
    f.personas().forEach((p, k) => {
      if (Math.hypot(p.x - (antes[k]?.x ?? 0), p.z - (antes[k]?.z ?? 0)) > 0.5) se_movio = true;
    });
    expect(se_movio).toBe(true);
  });

  it('velocidad de paseo acotada (nadie se teletransporta)', () => {
    const f = crearFuenteSimulada({ cantidad: 4, semilla: 5 });
    for (let i = 0; i < 200; i++) {
      const previas = f.personas().map((p) => ({ x: p.x, z: p.z }));
      f.avanzar(0.1);
      f.personas().forEach((p, k) => {
        // a lo más la velocidad de carrera (los tramos largos se corren)
        expect(
          Math.hypot(p.x - (previas[k]?.x ?? 0), p.z - (previas[k]?.z ?? 0)),
        ).toBeLessThanOrEqual(0.1 * PARAMETROS_LOCOMOCION.velCorrer + 1e-9);
      });
    }
  });

  it('agregar y quitar avisan a los suscritos; darse de baja corta el aviso', () => {
    const f = crearFuenteSimulada({ cantidad: 1, semilla: 1 });
    const aviso = vi.fn();
    const baja = f.suscribir(aviso);
    f.agregar({ id: 'nuevo', nombre: 'Nuevo' });
    expect(f.personas().some((p) => p.id === 'nuevo')).toBe(true);
    expect(aviso).toHaveBeenCalledTimes(1);
    f.quitar('nuevo');
    expect(f.personas().some((p) => p.id === 'nuevo')).toBe(false);
    expect(aviso).toHaveBeenCalledTimes(2);
    f.quitar('no-existe');
    expect(aviso).toHaveBeenCalledTimes(2);
    baja();
    f.agregar({ id: 'otro', nombre: 'Otro' });
    expect(aviso).toHaveBeenCalledTimes(2);
  });

  it('agregar un id existente lanza', () => {
    const f = crearFuenteSimulada({ cantidad: 1, semilla: 1 });
    const id = f.personas()[0]?.id ?? '';
    expect(() => f.agregar({ id, nombre: 'Repetido' })).toThrow(/ya existe/);
  });

  it('avanzar no avisa: las posiciones se leen cada cuadro, sin renderizar React', () => {
    const f = crearFuenteSimulada({ cantidad: 2, semilla: 1 });
    const aviso = vi.fn();
    f.suscribir(aviso);
    f.avanzar(0.1);
    expect(aviso).not.toHaveBeenCalled();
  });
});

describe('zona de paseo de un escenario', () => {
  const caja = { x0: 10, x1: 14, z0: -2, z1: 2 };

  it('puntoLibreEn da puntos dentro de la caja', () => {
    const azar = azarSemilla(3);
    for (let i = 0; i < 200; i++) {
      const p = puntoLibreEn(caja)(azar, i);
      expect(p.x).toBeGreaterThanOrEqual(caja.x0);
      expect(p.x).toBeLessThanOrEqual(caja.x1);
      expect(p.z).toBeGreaterThanOrEqual(caja.z0);
      expect(p.z).toBeLessThanOrEqual(caja.z1);
    }
  });

  it('con puntoLibre e y, nadie sale de la zona y todos van a esa altura', () => {
    const f = crearFuenteSimulada({
      cantidad: 5,
      semilla: 2,
      puntoLibre: puntoLibreEn(caja),
      y: 3.9,
    });
    for (let i = 0; i < 300; i++) {
      f.avanzar(0.1);
      for (const p of f.personas()) {
        expect(p.x).toBeGreaterThanOrEqual(caja.x0 - 1e-9);
        expect(p.x).toBeLessThanOrEqual(caja.x1 + 1e-9);
        expect(p.z).toBeGreaterThanOrEqual(caja.z0 - 1e-9);
        expect(p.z).toBeLessThanOrEqual(caja.z1 + 1e-9);
        expect(p.y).toBe(3.9);
      }
    }
  });

  it('sin la opción sigue paseando por el atrio, a nivel del piso 1', () => {
    const f = crearFuenteSimulada({ cantidad: 2, semilla: 4 });
    expect(f.personas().every((p) => p.y === 0 && dentro(p.x, p.z))).toBe(true);
  });

  it('con un punto de reunión, la persona se queda largo rato al llegar y mira al centro del grupo', () => {
    const centro = { x: 5, z: 5 };
    const f = crearFuenteSimulada({
      cantidad: 1,
      semilla: 4,
      puntoLibre: (azar) => ({ x: centro.x + 1 + azar(), z: centro.z + azar(), mirar: centro }),
    });
    const p = f.personas()[0]!;
    let movio = false;
    let quieto = 0;
    for (let t = 0; t < 600 && quieto < 2; t++) {
      const antes = { x: p.x, z: p.z };
      f.avanzar(0.1);
      const d = Math.hypot(p.x - antes.x, p.z - antes.z);
      if (d > 1e-9) movio = true;
      else if (movio) quieto++;
    }
    expect(quieto).toBe(2); // llegó y se quedó
    expect(p.rumbo).toBeCloseTo(Math.atan2(centro.x - p.x, centro.z - p.z), 6);
    const llegada = { x: p.x, z: p.z };
    for (let t = 0; t < 40; t++) f.avanzar(0.1); // 4 s más: sigue en pausa (≥ 5 s en total)
    expect(Math.hypot(p.x - llegada.x, p.z - llegada.z)).toBeLessThan(1e-9);
  });

  it('puntoLibre recibe el índice de la persona', () => {
    const indices: number[] = [];
    crearFuenteSimulada({
      cantidad: 3,
      semilla: 1,
      puntoLibre: (_azar, indice) => {
        indices.push(indice);
        return { x: 0, z: 0 };
      },
    });
    expect(new Set(indices)).toEqual(new Set([0, 1, 2]));
  });
});

describe('personas simuladas que se sientan', () => {
  const sala = escenarioTrading;
  const asientos = accionesDe(sala).filter((a): a is AccionSentarse => a.tipo === 'sentarse');
  const crear = (opciones: Partial<Parameters<typeof crearFuenteSimulada>[0]> = {}) =>
    crearFuenteSimulada({
      cantidad: 12,
      semilla: 4,
      puntoLibre: (azar, i) => puntoDeReunion(sala, i, azar),
      asientos,
      probabilidadSentarse: 1,
      ...opciones,
    });
  const correr = (f: ReturnType<typeof crear>, segundos: number, alPaso?: () => void) => {
    for (let t = 0; t < segundos * 10; t++) {
      f.avanzar(0.1);
      alPaso?.();
    }
  };

  it('sin asientos nadie lleva estado ni asiento', () => {
    const f = crear({ asientos: [] });
    correr(f, 120);
    for (const p of f.personas()) {
      expect(p.estado).toBeUndefined();
      expect(p.asiento).toBeUndefined();
    }
  });

  it('con asientos, alguien se sienta: estado, asiento, altura y posición del asiento', () => {
    const f = crear();
    let visto = 0;
    correr(f, 200, () => {
      for (const p of f.personas()) {
        if (p.estado !== 'sentado') continue;
        const a = asientos.find((s) => s.id === p.asiento);
        expect(a, `asiento ${p.asiento}`).toBeDefined();
        expect(p.y).toBeCloseTo(a!.asiento.y, 6);
        if (Math.hypot(p.x - a!.asiento.x, p.z - a!.asiento.z) < 1e-6) {
          visto++;
          expect(p.rumbo).toBeCloseTo(a!.asiento.yaw, 6);
        }
      }
    });
    expect(visto).toBeGreaterThan(0);
  });

  it('no hay dos personas en el mismo asiento a la vez', () => {
    const f = crear({ cantidad: 30 });
    correr(f, 200, () => {
      const ids = f
        .personas()
        .filter((p) => p.estado === 'sentado')
        .map((p) => p.asiento);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('se levantan: vuelven a estar de pie, a la altura del piso, y siguen su camino', () => {
    const f = crear({ cantidad: 6 });
    const estuvoSentada = new Set<string>();
    const levantadas = new Set<string>();
    correr(f, 400, () => {
      for (const p of f.personas()) {
        if (p.estado === 'sentado') estuvoSentada.add(p.id);
        else if (estuvoSentada.has(p.id)) {
          levantadas.add(p.id);
          expect(p.y).toBeCloseTo(0, 6);
          expect(p.asiento).toBeUndefined();
        }
      }
    });
    expect(levantadas.size).toBeGreaterThan(0);
  });

  it('solo usa asientos a los que se llega por su piso: la butaca de la grada alta (aproximación a 0,3 m) no se ofrece', () => {
    const f = crear({ cantidad: 30 });
    const usados = new Set<string>();
    correr(f, 300, () => f.personas().forEach((p) => p.asiento && usados.add(p.asiento)));
    expect(usados.size).toBeGreaterThan(0);
    expect([...usados].some((id) => id.startsWith('sentarse:butaca-3'))).toBe(false);
  });

  it('un asiento de otra altura (taburete) en su mismo piso sí se ofrece: la altura del asiento no decide', () => {
    const base = asientos[0] as AccionSentarse;
    const taburete: AccionSentarse = {
      ...base,
      id: 'sentarse:taburete',
      asiento: { ...base.asiento, y: base.asiento.aproximacion.y + 0.3 },
    };
    const f = crear({ asientos: [taburete], cantidad: 30 });
    const usados = new Set<string>();
    correr(f, 300, () => f.personas().forEach((p) => p.asiento && usados.add(p.asiento)));
    expect(usados.has('sentarse:taburete')).toBe(true);
    expect(f.personas().every((p) => p.estado !== 'sentado' || p.y === taburete.asiento.y)).toBe(
      true,
    );
  });

  it('es determinista con la misma semilla', () => {
    const a = crear();
    const b = crear();
    correr(a, 150);
    correr(b, 150);
    expect(a.personas()).toEqual(b.personas());
  });

  it('un asiento ocupado por quien usa la sala no lo toma ninguna simulada', () => {
    const f = crear({ cantidad: 30 });
    f.ocupar('sentarse:butaca-1-2');
    const usados = new Set<string>();
    correr(f, 300, () => f.personas().forEach((p) => p.asiento && usados.add(p.asiento)));
    expect(usados.size).toBeGreaterThan(0);
    expect(usados.has('sentarse:butaca-1-2')).toBe(false);
  });

  it('quitar a quien está sentada libera su asiento', () => {
    const f = crear({ cantidad: 1 });
    let id: string | undefined;
    correr(f, 300, () => {
      if (!id && f.personas()[0]?.estado === 'sentado') id = f.personas()[0]?.asiento;
    });
    expect(id).toBeDefined();
    f.quitar('sim-1');
    f.agregar({ id: 'otra', nombre: 'Otra' });
    expect(f.personas()).toHaveLength(1);
  });
});

describe('separación del avatar propio', () => {
  const AVATAR = { x: 2.6, y: 0, z: 0 };
  /** Menor distancia (m) entre el avatar y cualquier persona simulada tras 3 min de paseo. */
  function distanciaMinima(evitar: boolean, y = 0): number {
    const f = crearFuenteSimulada({ cantidad: 30, semilla: 3 });
    if (evitar) f.evitar({ ...AVATAR, y });
    let min = Infinity;
    for (let i = 0; i < 3600; i++) {
      f.avanzar(0.05);
      for (const p of f.personas()) min = Math.min(min, Math.hypot(p.x - AVATAR.x, p.z - AVATAR.z));
    }
    return min;
  }

  it('sin avisarle dónde está, las simuladas lo atraviesan (la prueba es válida)', () => {
    expect(distanciaMinima(false)).toBeLessThan(PARAMETROS_SEPARACION_AVATAR.radio - 0.3);
  });

  it('avisándole, ninguna entra en su radio personal (salvo la holgura de un paso)', () => {
    expect(distanciaMinima(true)).toBeGreaterThan(PARAMETROS_SEPARACION_AVATAR.radio - 0.05);
  });

  it('quien está en otro piso no se aparta', () => {
    expect(distanciaMinima(true, 5)).toBeLessThan(PARAMETROS_SEPARACION_AVATAR.radio - 0.3);
  });

  it('evitar(null) deja de apartarlas', () => {
    const f = crearFuenteSimulada({ cantidad: 30, semilla: 3 });
    f.evitar({ ...AVATAR });
    f.evitar(null);
    let min = Infinity;
    for (let i = 0; i < 3600; i++) {
      f.avanzar(0.05);
      for (const p of f.personas()) min = Math.min(min, Math.hypot(p.x - AVATAR.x, p.z - AVATAR.z));
    }
    expect(min).toBeLessThan(PARAMETROS_SEPARACION_AVATAR.radio - 0.3);
  });

  it('nadie se desplaza de golpe: el empujón respeta la rapidez máxima', () => {
    const f = crearFuenteSimulada({ cantidad: 30, semilla: 3 });
    f.evitar({ ...AVATAR });
    let previas = f.personas().map((p) => ({ x: p.x, z: p.z }));
    for (let i = 0; i < 1200; i++) {
      f.avanzar(0.05);
      f.personas().forEach((p, k) => {
        const q = previas[k] as { x: number; z: number };
        // andar (≤ velCorrer) deslizándose por el borde (≤ 1,5 pasos) + el empujón de quien es alcanzado
        const tope =
          (1.5 * PARAMETROS_LOCOMOCION.velCorrer + PARAMETROS_SEPARACION_AVATAR.velocidadMax) *
          0.05;
        expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeLessThanOrEqual(tope);
      });
      previas = f.personas().map((p) => ({ x: p.x, z: p.z }));
    }
  });

  it('si el avatar le cae encima, se aparta de a poco (velocidadMax) y sin dirección conocida sale por detrás', () => {
    const f = crearFuenteSimulada({ cantidad: 1, semilla: 3 });
    const p = f.personas()[0]!;
    f.evitar({ x: p.x, y: 0, z: p.z });
    const x0 = p.x;
    const z0 = p.z;
    f.avanzar(0.05);
    const movido = Math.hypot(p.x - x0, p.z - z0);
    expect(movido).toBeGreaterThan(0);
    expect(movido).toBeLessThanOrEqual(
      PARAMETROS_LOCOMOCION.velCorrer * 0.05 +
        PARAMETROS_SEPARACION_AVATAR.velocidadMax * 0.05 +
        1e-6,
    );
  });
});

describe('nombres y separación entre simuladas', () => {
  it('usan nombres de ejemplo variados, no «Persona N»', () => {
    const f = crearFuenteSimulada({ cantidad: 8, semilla: 2 });
    const nombres = f.personas().map((p) => p.nombre);
    expect(nombres.every((n) => !/^Persona \d+$/.test(n))).toBe(true);
    expect(
      nombres.some((n) => NOMBRES_EJEMPLO.includes(n as (typeof NOMBRES_EJEMPLO)[number])),
    ).toBe(true);
  });

  it('tras un rato simulado ninguna pareja queda bajo la distancia mínima', () => {
    const f = crearFuenteSimulada({
      cantidad: 25,
      semilla: 5,
      puntoLibre: (azar, i) => puntoDeReunion(escenarioTrading, i, azar),
    });
    const min = PARAMETROS_SEPARACION_ENTRE.radio - 0.02;
    for (let i = 0; i < 4800; i++) f.avanzar(0.05);
    const ps = f.personas();
    for (let a = 0; a < ps.length; a++) {
      for (let b = a + 1; b < ps.length; b++) {
        if (Math.abs(ps[a]!.y - ps[b]!.y) > PARAMETROS_SEPARACION_ENTRE.alturaPiso) continue;
        expect(Math.hypot(ps[a]!.x - ps[b]!.x, ps[a]!.z - ps[b]!.z)).toBeGreaterThanOrEqual(min);
      }
    }
  });
});
