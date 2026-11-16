import { describe, expect, it } from 'vitest';
import { FOV_VERTICAL } from '../camara';
import type { Punto3 } from '../camara';
import { CENTRO_CUERPO, puntoDePie, SEMIANCHO_CUERPO } from './posicion';

const cabeza: Punto3 = { x: 4, y: 1.6, z: -2 };
const piso = 0;
const camaras: Punto3[] = [
  { x: 34, y: 27, z: 28 },
  { x: 4 + 28, y: 27, z: -2 + 8 },
  { x: -26, y: 20, z: -30 },
  { x: 4, y: 3, z: 3 },
  { x: 4, y: 20, z: -1.9 },
];
const aspectos = [16 / 9, 9 / 16, 1];

const resta = (a: Punto3, b: Punto3): Punto3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const largo = (v: Punto3) => Math.hypot(v.x, v.y, v.z);
const angulo = (a: Punto3, b: Punto3) => {
  const cos = (a.x * b.x + a.y * b.y + a.z * b.z) / (largo(a) * largo(b));
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
};

/** Posición horizontal en pantalla (0 izquierda .. 1 derecha) de `p` mirando la cámara a `objetivo`. */
function pantallaX(camara: Punto3, objetivo: Punto3, p: Punto3, aspecto: number): number {
  const f = resta(objetivo, camara);
  const lf = largo(f);
  const rl = Math.hypot(f.x, f.z);
  const rx = -f.z / rl;
  const rz = f.x / rl;
  const rel = resta(p, camara);
  const profundo = (rel.x * f.x + rel.y * f.y + rel.z * f.z) / lf;
  const tanH = Math.tan((FOV_VERTICAL * Math.PI) / 360) * aspecto;
  return ((rel.x * rx + rel.z * rz) / profundo / tanH + 1) / 2;
}

/** NDC x (-1 izquierda .. 1 derecha) de un punto, con la cámara mirando a `objetivo`. */
const ndcX = (camara: Punto3, objetivo: Punto3, p: Punto3, aspecto: number) =>
  pantallaX(camara, objetivo, p, aspecto) * 2 - 1;

describe('puntoDePie', () => {
  it.each(camaras)('su silueta entera cabe en NDC x [-0,94, 0,94] (cámara %#)', (camara) => {
    const f = resta(cabeza, camara);
    const horizontal = Math.hypot(f.x, f.z);
    const derecha = { x: -f.z / horizontal, z: f.x / horizontal };
    for (const aspecto of aspectos) {
      const c = puntoDePie(cabeza, camara, FOV_VERTICAL, aspecto, piso, { x: 0, y: 0, z: 0 });
      for (const lado of [-1, 1]) {
        for (const y of [piso, piso + 1.8]) {
          const esquina = {
            x: c.x + derecha.x * SEMIANCHO_CUERPO * lado,
            y,
            z: c.z + derecha.z * SEMIANCHO_CUERPO * lado,
          };
          const x = ndcX(camara, cabeza, esquina, aspecto);
          expect(x).toBeGreaterThanOrEqual(-0.94);
          expect(x).toBeLessThanOrEqual(0.94);
        }
      }
    }
  });

  it.each(camaras)('queda en el piso y en el tercio derecho (cámara %#)', (camara) => {
    for (const aspecto of aspectos) {
      const p = puntoDePie(cabeza, camara, FOV_VERTICAL, aspecto, piso, { x: 0, y: 0, z: 0 });
      expect(p.y).toBeCloseTo(piso + CENTRO_CUERPO, 9);
      const x = pantallaX(camara, cabeza, p, aspecto);
      expect(x).toBeGreaterThan(2 / 3);
    }
  });

  it.each(camaras)('no tapa la cabeza del enfocado: fuera del cono (cámara %#)', (camara) => {
    for (const aspecto of aspectos) {
      const centro = puntoDePie(cabeza, camara, FOV_VERTICAL, aspecto, piso, { x: 0, y: 0, z: 0 });
      const cabezaAsistente = { ...centro, y: piso + 1.75 };
      const haciaCabeza = resta(cabeza, camara);
      const minimo = aspecto < 1 ? 5 : 10;
      expect(angulo(haciaCabeza, resta(centro, camara))).toBeGreaterThan(minimo);
      expect(angulo(haciaCabeza, resta(cabezaAsistente, camara))).toBeGreaterThan(minimo);
    }
  });

  it('usa la altura del piso que se le da (otro nivel de la casa)', () => {
    const p = puntoDePie(cabeza, camaras[0]!, FOV_VERTICAL, 16 / 9, 3.9, { x: 0, y: 0, z: 0 });
    expect(p.y).toBeCloseTo(3.9 + CENTRO_CUERPO, 9);
  });
});
