import { describe, expect, it } from 'vitest';
import { ambienteDe, cajaDe, NIVEL_Y, plano } from '../../../mansion/plano';
import { construirAmbientes } from './construir';
import { DETALLES } from './detalles';
import { DIBUJADOS_APARTE, tiposDibujados } from './muebles';
import { carasDe } from './revestimientos';

const { fusion, cajas } = construirAmbientes();
const TOL = 0.02;

/** Lo único que se sale de su huella a propósito, y cuánto como máximo (m). */
const EXCESO_PLANTA: Record<string, number> = {
  // La puerta redonda de la bóveda está entreabierta hacia la sala.
  boveda: 0.8,
};
const EXCESO_ALTO: Record<string, number> = {
  // El respaldo de la reposera va levantado.
  reposera: 0.35,
};

describe('mobiliario', () => {
  it('cada tipo del plano tiene su dibujo (o lo dibuja otra parte de la casa)', () => {
    const dibujados = new Set(tiposDibujados());
    for (const tipo of new Set(plano.muebles.map((m) => m.tipo))) {
      expect(dibujados.has(tipo) || DIBUJADOS_APARTE.has(tipo), tipo).toBe(true);
    }
  });

  it.each(
    plano.muebles.filter((m) => !DIBUJADOS_APARTE.has(m.tipo)).map((m) => [m.id, m] as const),
  )('%s respeta su huella en planta y en alto', (_, m) => {
    const caja = cajas.get(m.id);
    expect(caja, 'sin geometría').toBeDefined();
    if (!caja) return;
    const c = cajaDe(m);
    const extra = TOL + (EXCESO_PLANTA[m.tipo] ?? 0);
    expect(caja.min.x).toBeGreaterThanOrEqual(c.x0 - extra);
    expect(caja.max.x).toBeLessThanOrEqual(c.x1 + extra);
    expect(caja.min.z).toBeGreaterThanOrEqual(c.z0 - extra);
    expect(caja.max.z).toBeLessThanOrEqual(c.z1 + extra);
    const piso = ambienteDe(m.ambiente).y + m.y;
    expect(caja.min.y).toBeGreaterThanOrEqual(piso - 1e-3);
    expect(caja.max.y).toBeLessThanOrEqual(piso + m.alto + TOL + (EXCESO_ALTO[m.tipo] ?? 0));
  });

  it('lo que va encima de un mueble queda sobre su huella en planta', () => {
    for (const m of plano.muebles) {
      const caja = cajas.get(`${m.id}:encima`);
      if (!caja) continue;
      const c = cajaDe(m);
      expect(caja.min.x, m.id).toBeGreaterThanOrEqual(c.x0 - TOL);
      expect(caja.max.x, m.id).toBeLessThanOrEqual(c.x1 + TOL);
      expect(caja.min.z, m.id).toBeGreaterThanOrEqual(c.z0 - TOL);
      expect(caja.max.z, m.id).toBeLessThanOrEqual(c.z1 + TOL);
    }
  });

  it('cabe en el presupuesto: ≤ 40 draw calls y ≤ 150 000 triángulos', () => {
    const triangulos = fusion.reduce(
      (s, f) => s + f.geometria.getAttribute('position').count / 3,
      0,
    );
    expect(fusion.length).toBeLessThanOrEqual(40);
    expect(triangulos).toBeLessThanOrEqual(150_000);
  });
});

describe('revestimientos', () => {
  const lados = new Set(['norte', 'sur', 'este', 'oeste']);
  const niveles = new Set(Object.keys(NIVEL_Y));
  const etiquetadas = fusion.filter((f) => f.etiqueta !== null);

  it('los de muros exteriores llevan lado y nivel válidos; hay uno por cada muro exterior revestido', () => {
    expect(etiquetadas.length).toBeGreaterThan(0);
    for (const f of etiquetadas) {
      expect(lados.has(f.etiqueta?.lado ?? ''), f.clave).toBe(true);
      expect(niveles.has(f.etiqueta?.nivel ?? ''), f.clave).toBe(true);
    }
    const revestidos = [
      'gimnasio',
      'cocina',
      'finanzas',
      'ventas',
      'desarrollo',
      'contenido',
      'investigacion',
    ];
    for (const id of revestidos) {
      for (const c of carasDe(ambienteDe(id)).filter((c) => c.exterior)) {
        expect(
          etiquetadas.some(
            (f) => f.etiqueta?.lado === c.lado && f.etiqueta?.nivel === c.ambiente.nivel,
          ),
          `${id} ${c.lado}`,
        ).toBe(true);
      }
    }
  });

  it('cada (material, lado, nivel) es una sola malla', () => {
    const llaves = fusion.map(
      (f) => `${f.clave}|${f.etiqueta?.lado ?? ''}|${f.etiqueta?.nivel ?? ''}`,
    );
    expect(new Set(llaves).size).toBe(llaves.length);
  });

  it('las caras de un ambiente salen de sus muros: el living tiene las dos y el vano de la puerta', () => {
    const caras = carasDe(ambienteDe('living'));
    expect(caras.map((c) => c.lado).sort()).toEqual(['este', 'oeste']);
    for (const c of caras) {
      expect(c.exterior).toBe(false);
      expect(c.vano).not.toBeNull();
    }
    const gim = carasDe(ambienteDe('gimnasio')).find((c) => c.lado === 'oeste');
    expect(gim?.exterior).toBe(true);
    expect(gim?.x).toBe(-16);
  });
});

describe('detalles', () => {
  it('no estorban: lejos de lugares, salidas y muebles de su ambiente', () => {
    for (const d of DETALLES) {
      for (const l of plano.lugares.filter((l) => l.ambiente === d.ambiente)) {
        for (const p of [l, l.salida]) {
          expect(Math.hypot(p.x - d.x, p.z - d.z), `${d.ambiente} ${d.x},${d.z}`).toBeGreaterThan(
            d.radio + 0.3,
          );
        }
      }
      for (const m of plano.muebles.filter((m) => m.ambiente === d.ambiente)) {
        const c = cajaDe(m);
        const dx = Math.max(0, c.x0 - d.x, d.x - c.x1);
        const dz = Math.max(0, c.z0 - d.z, d.z - c.z1);
        expect(Math.hypot(dx, dz), `${d.ambiente} con ${m.id}`).toBeGreaterThan(d.radio);
      }
      const a = ambienteDe(d.ambiente);
      expect(d.x - d.radio).toBeGreaterThan(a.x0);
      expect(d.x + d.radio).toBeLessThan(a.x1);
      expect(d.z - d.radio).toBeGreaterThan(a.z0);
      expect(d.z + d.radio).toBeLessThan(a.z1);
    }
  });
});
