import { describe, expect, it, vi, beforeEach } from 'vitest';
import { escenarioTrading } from '@oficina/motor';
import { OPCIONES_PANTALLA, contenidosDePantallas, lienzoDeContenido } from './contenidos';

beforeEach(() => {
  class CanvasMock {
    width = 0;
    height = 0;
    getContext() {
      let rojo = 0;
      return {
        fillStyle: '',
        fillRect() {
          rojo = 255;
        },
        createLinearGradient() {
          return { addColorStop() {} };
        },
        strokeStyle: '',
        lineWidth: 1,
        textAlign: 'left',
        textBaseline: 'alphabetic',
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        fill() {},
        stroke() {},
        setLineDash() {},
        roundRect() {},
        save() {},
        restore() {},
        translate() {},
        get font() {
          return '';
        },
        set font(_: string) {},
        fillText() {},
        measureText(t: string) {
          return { width: t.length * 10 };
        },
        getImageData() {
          return { data: [rojo, 0, 0, 255] };
        },
      };
    }
  }
  vi.stubGlobal('document', {
    createElement: (tag: string) => (tag === 'canvas' ? new CanvasMock() : {}),
  });
});

describe('contenidos de pantalla', () => {
  it('cada opción produce un lienzo en una pantalla sin contenido de fábrica', () => {
    for (const o of OPCIONES_PANTALLA) {
      const c = lienzoDeContenido(o.id);
      expect(c.width).toBeGreaterThan(0);
      expect(c.height).toBeGreaterThan(0);
      const ctx = c.getContext('2d');
      expect(ctx?.getImageData(0, 0, 1, 1).data.some((v) => v > 0)).toBe(true);
    }
  });

  it('mercado cambia una pantalla que no lo trae de fábrica', () => {
    const pantalla = escenarioTrading.pantallas.find((p) => p.contenido !== 'mercado');
    expect(pantalla).toBeDefined();
    const r = contenidosDePantallas(escenarioTrading, { [pantalla!.id]: 'mercado' });
    expect(r[pantalla!.id]).toBeDefined();
  });
});
