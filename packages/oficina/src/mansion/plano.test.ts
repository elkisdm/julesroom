import { describe, expect, it } from 'vitest';
import { departamentosBase } from '../render/layout';
import { ambienteDe, cajaDe, ESPESOR_LOSA, lugaresDe, NIVEL_Y, plano, sueloBajo } from './plano';
import type { Ambiente } from './plano';

const EPS = 1e-6;
const dentroDe = (a: Ambiente, x: number, z: number, margen = 0) =>
  x >= a.x0 + margen - EPS &&
  x <= a.x1 - margen + EPS &&
  z >= a.z0 + margen - EPS &&
  z <= a.z1 - margen + EPS;

/** Distancia entre dos cajas en planta (0 si se tocan o se solapan). */
function distanciaCajas(a: ReturnType<typeof cajaDe>, b: ReturnType<typeof cajaDe>): number {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
  return Math.hypot(dx, dz);
}

describe('ambientes', () => {
  it('los del mismo nivel no se solapan', () => {
    const lista = plano.ambientes;
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i] as Ambiente;
        const b = lista[j] as Ambiente;
        if (a.nivel !== b.nivel) continue;
        const solapa =
          a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS;
        expect(solapa, `${a.id} con ${b.id}`).toBe(false);
      }
    }
  });

  it('los niveles están separados por 3,9 m: 3,6 de altura libre y la losa de 0,3', () => {
    const alturas = Object.values(NIVEL_Y);
    for (let i = 1; i < alturas.length; i++) {
      expect((alturas[i] ?? 0) - (alturas[i - 1] ?? 0)).toBeCloseTo(3.6 + ESPESOR_LOSA, 9);
    }
  });

  it('sueloBajo da el piso que queda debajo de un punto en el aire', () => {
    expect(sueloBajo(3.2)).toBe(0);
    expect(sueloBajo(NIVEL_Y.piso2 + 1.45)).toBe(NIVEL_Y.piso2);
    expect(sueloBajo(NIVEL_Y.torre + 3)).toBe(NIVEL_Y.torre);
    expect(sueloBajo(0.2)).toBe(0);
  });

  it('cada ambiente está a la altura de su nivel', () => {
    for (const a of plano.ambientes) expect(a.y).toBe(NIVEL_Y[a.nivel]);
  });

  it('todo departamento base tiene al menos un ambiente', () => {
    for (const d of departamentosBase) {
      expect(
        plano.ambientes.some((a) => a.departamento === d.id),
        d.id,
      ).toBe(true);
    }
  });

  it('el atrio es de doble altura y la cocina no es de ningún departamento', () => {
    expect(ambienteDe('atrio').alto).toBeGreaterThan(7);
    expect(ambienteDe('cocina').departamento).toBeNull();
  });

  it('ambienteDe falla con un id desconocido', () => {
    expect(() => ambienteDe('sotano')).toThrow(/sotano/);
  });
});

describe('lugares de trabajo', () => {
  it.each(departamentosBase.map((d) => d.id))('%s tiene al menos 6 lugares', (id) => {
    expect(lugaresDe(id).length).toBeGreaterThanOrEqual(6);
  });

  it('los primeros 6 de cada departamento son de base y el resto de pie', () => {
    for (const d of departamentosBase) {
      const lista = lugaresDe(d.id);
      expect(
        lista.slice(6).every((l) => !l.asiento),
        d.id,
      ).toBe(true);
    }
  });

  it('todo lugar está dentro de su ambiente y a la altura de su nivel', () => {
    for (const l of plano.lugares) {
      const a = ambienteDe(l.ambiente);
      expect(dentroDe(a, l.x, l.z, 0.3), `${l.ambiente} ${l.x},${l.z}`).toBe(true);
      expect(l.y).toBe(a.y);
    }
  });

  it('el lugar de un departamento está en un ambiente de ese departamento', () => {
    for (const d of departamentosBase) {
      for (const l of lugaresDe(d.id)) expect(ambienteDe(l.ambiente).departamento).toBe(d.id);
    }
  });

  it('un id desconocido cae en los lugares del atrio', () => {
    const lista = lugaresDe('inexistente');
    expect(lista.length).toBeGreaterThanOrEqual(6);
    expect(lista.every((l) => l.ambiente === 'atrio')).toBe(true);
  });

  it('un lugar sentado está dentro de su silla; uno de pie, a más de 0,3 m de todo mueble', () => {
    for (const l of plano.lugares) {
      const propios = plano.muebles.filter((m) => m.ambiente === l.ambiente);
      if (l.asiento) {
        const silla = propios.find((m) => m.id === l.silla);
        expect(silla, `silla de ${l.ambiente} ${l.x},${l.z}`).toBeDefined();
        const c = cajaDe(silla as (typeof propios)[number]);
        expect(l.x >= c.x0 && l.x <= c.x1 && l.z >= c.z0 && l.z <= c.z1).toBe(true);
      } else {
        expect(l.silla).toBeNull();
        for (const m of propios) {
          const c = cajaDe(m);
          const punto = { x0: l.x, x1: l.x, z0: l.z, z1: l.z };
          expect(
            distanciaCajas(punto, c),
            `${l.ambiente} ${l.x},${l.z} con ${m.id}`,
          ).toBeGreaterThan(0.3);
        }
      }
    }
  });

  it('no hay dos lugares en el mismo punto', () => {
    const vistos = new Set(plano.lugares.map((l) => `${l.ambiente}|${l.x}|${l.z}`));
    expect(vistos.size).toBe(plano.lugares.length);
  });

  it('cada lugar mira hacia un punto de su ambiente y la salida es un punto libre', () => {
    for (const l of plano.lugares) {
      expect(Math.hypot(l.mira.x - l.x, l.mira.z - l.z)).toBeGreaterThan(0.2);
      expect(Math.hypot(l.salida.x - l.x, l.salida.z - l.z)).toBeGreaterThan(0.3);
      for (const m of plano.muebles.filter((m) => m.ambiente === l.ambiente)) {
        expect(
          distanciaCajas(
            { x0: l.salida.x, x1: l.salida.x, z0: l.salida.z, z1: l.salida.z },
            cajaDe(m),
          ),
        ).toBeGreaterThanOrEqual(0.3 - EPS);
      }
    }
  });

  it('desde la cámara (mira hacia -z) se ve la cara o el perfil, nunca solo la espalda', () => {
    for (const l of plano.lugares) {
      // yaw con el convenio atan2(x, z): 0 = hacia +z (hacia la cámara), ±π/2 = de perfil.
      expect(Math.cos(l.yaw), `${l.ambiente} ${l.x},${l.z}`).toBeGreaterThanOrEqual(-EPS);
    }
  });
});

describe('muebles', () => {
  it('están dentro de su ambiente', () => {
    for (const m of plano.muebles) {
      const a = ambienteDe(m.ambiente);
      const c = cajaDe(m);
      expect(
        c.x0 >= a.x0 - EPS && c.x1 <= a.x1 + EPS && c.z0 >= a.z0 - EPS && c.z1 <= a.z1 + EPS,
        m.id,
      ).toBe(true);
    }
  });

  it('no se solapan salvo dentro de un mismo conjunto', () => {
    const lista = plano.muebles;
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i];
        const b = lista[j];
        if (!a || !b || a.ambiente !== b.ambiente || a.conjunto === b.conjunto) continue;
        expect(distanciaCajas(cajaDe(a), cajaDe(b)), `${a.id} con ${b.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('entre conjuntos distintos hay pasillos de al menos 0,9 m', () => {
    const lista = plano.muebles;
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i];
        const b = lista[j];
        if (!a || !b || a.ambiente !== b.ambiente || a.conjunto === b.conjunto) continue;
        expect(distanciaCajas(cajaDe(a), cajaDe(b)), `${a.id} con ${b.id}`).toBeGreaterThanOrEqual(
          0.9 - EPS,
        );
      }
    }
  });

  it('los ids son únicos y las huellas usan giros múltiplos de 90 grados', () => {
    expect(new Set(plano.muebles.map((m) => m.id)).size).toBe(plano.muebles.length);
    for (const m of plano.muebles) {
      expect(Math.abs(Math.sin(m.giro * 2)), m.id).toBeLessThan(1e-9);
    }
  });

  it('ninguno cae dentro de la lámina de agua de la piscina', () => {
    const { piscina } = plano;
    for (const m of plano.muebles) {
      const c = cajaDe(m);
      const dentro =
        c.x0 < piscina.x1 - EPS &&
        c.x1 > piscina.x0 + EPS &&
        c.z0 < piscina.z1 - EPS &&
        c.z1 > piscina.z0 + EPS;
      expect(dentro, m.id).toBe(false);
    }
  });

  it('hay una barra de café en la cocina y un aro de luz en Contenido', () => {
    expect(plano.muebles.some((m) => m.tipo === 'barra-cafe' && m.ambiente === 'cocina')).toBe(
      true,
    );
    expect(plano.muebles.some((m) => m.tipo === 'aro-luz' && m.ambiente === 'contenido')).toBe(
      true,
    );
    expect(plano.luz).not.toBeNull();
  });
});

describe('café', () => {
  it('hay puntos de pausa en la cocina, frente a la barra y a menos de 1,2 m dentro de un grupo', () => {
    const cocina = ambienteDe('cocina');
    const barra = plano.muebles.find((m) => m.tipo === 'barra-cafe');
    if (!barra) throw new Error('sin barra');
    expect(plano.cafe.length).toBeGreaterThanOrEqual(12);
    for (const p of plano.cafe) {
      expect(dentroDe(cocina, p.x, p.z, 0.3)).toBe(true);
      expect(distanciaCajas({ x0: p.x, x1: p.x, z0: p.z, z1: p.z }, cajaDe(barra))).toBeLessThan(
        1.2,
      );
    }
    for (let g = 0; g < 3; g++) {
      const grupo = plano.cafe.slice(g * 4, g * 4 + 4);
      for (const a of grupo) {
        for (const b of grupo) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1.2);
      }
    }
  });
});

describe('escaleras y muros', () => {
  it('las escaleras conectan los cuatro niveles sin pasarse de 40 grados', () => {
    const alturas = new Set<number>();
    for (const e of plano.escaleras) {
      for (const t of e.tramos) {
        alturas.add(t.desde.y);
        alturas.add(t.hasta.y);
        const corrida = Math.hypot(t.hasta.x - t.desde.x, t.hasta.z - t.desde.z);
        const pendiente = Math.atan2(t.hasta.y - t.desde.y, corrida);
        expect(pendiente, e.id).toBeGreaterThan(0);
        expect((pendiente * 180) / Math.PI, e.id).toBeLessThan(40);
      }
    }
    for (const y of Object.values(NIVEL_Y)) expect(alturas.has(y), `y=${y}`).toBe(true);
  });

  it('los tramos de cada escalera se encadenan', () => {
    for (const e of plano.escaleras) {
      for (let i = 1; i < e.tramos.length; i++) {
        const a = e.tramos[i - 1];
        const b = e.tramos[i];
        expect(a?.hasta, e.id).toEqual(b?.desde);
      }
    }
  });

  it('cada pared entre ambientes contiguos del mismo piso tiene un vano de 1,2 m', () => {
    const conVano = plano.muros.filter((m) => m.tipo === 'muro' && m.vano !== null);
    expect(conVano.length).toBeGreaterThanOrEqual(7);
    for (const m of conVano) expect(m.vano?.ancho).toBe(1.2);
  });
});
