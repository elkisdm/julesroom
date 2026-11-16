import { describe, it, expect } from 'vitest';
import { OBJETOS_NUEVOS, tipoObjeto, huella } from '@oficina/motor';
import { suelosDeObjetos } from './solidos';
import { accionesDeObjetos } from './asientosObjetos';
import { piezaDe, PIEZA_GENERICA, claveInstancia } from './piezas';
import { Matrix4, Vector3 } from 'three';
import { matrizDeParte } from './matrizParte';
const objeto = (tipo: string, giro: 0 | 1 | 2 | 3 = 0) => ({ id: 'uno', tipo, x: 3, z: 5, giro });
describe('física y dibujo del catálogo ampliado', () => {
  it('cada pieza nueva tiene miniatura propia, nunca reserva', () => {
    for (const t of OBJETOS_NUEVOS) expect(piezaDe(t.tipo)).not.toBe(PIEZA_GENERICA);
  });
  it('tarima y escalones generan superficies a su altura; la planta bloquea', () => {
    const r = suelosDeObjetos([objeto('tarima')], 2);
    expect(r.superficies).toHaveLength(1);
    expect(r.superficies[0]).toMatchObject({ y: 2.3 });
    const s = suelosDeObjetos([objeto('escalones')], 0);
    expect(s.superficies).toHaveLength(3);
    expect(s.superficies.map((x) => ('y' in x ? x.y : 0))).toEqual([0.18, 0.36, 0.54]);
    expect(suelosDeObjetos([objeto('monstera')], 0).solidos).toHaveLength(1);
  });
  it('arco conserva el hueco central y el dintel elevado, también girado', () => {
    const r = suelosDeObjetos([objeto('arco-modular', 1)], 0);
    expect(r.solidos).toHaveLength(5);
    expect(r.solidos.filter((s) => s.y0 === 0)).toHaveLength(2);
    expect(r.solidos.filter((s) => s.y0 > 2)).toHaveLength(3);
    expect(r.solidos.filter((s) => s.y0 === 0).every((s) => s.z1 < 5 || s.z0 > 5)).toBe(true);
  });
  it('cada hoja de puerta abierta tiene su volumen propio', () => {
    const r = suelosDeObjetos([objeto('puertas-dobles')], 0);
    expect(r.solidos).toHaveLength(5);
    expect(
      r.solidos.some((s) => s.x0 <= 3 + 0.4 * 2.2 && s.x1 >= 3 + 0.4 * 2.2 && s.y0 === 0),
    ).toBe(true);
  });
  it('todos los asientos tienen acción con aproximación fuera de la huella', () => {
    for (const t of OBJETOS_NUEVOS.filter((t) => t.sentable))
      for (const giro of [0, 1, 2, 3] as const) {
        const a = accionesDeObjetos([objeto(t.tipo, giro)], 2);
        expect(a.length, t.tipo).toBe(t.asientos!.length);
        for (const s of a) {
          expect(s.asiento.y).toBeGreaterThan(2);
          expect(s.asiento.aproximacion.y).toBe(2);
          const h = huella(objeto(t.tipo, giro)),
            p = s.asiento.aproximacion;
          expect(p.x < h.x0 || p.x > h.x1 || p.z < h.z0 || p.z > h.z1, t.tipo).toBe(true);
          expect(s.asiento.yaw).toBeCloseTo((giro * Math.PI) / 2);
        }
      }
    expect(accionesDeObjetos([objeto('nada'), objeto('monstera')], 0)).toEqual([]);
  });
  it('los asientos anteriores usan la altura real de sus cojines y todas sus plazas', () => {
    expect(accionesDeObjetos([objeto('sofa-tres')], 0)).toHaveLength(3);
    for (const [tipo, alto] of [
      ['sofa-tres', 0.35],
      ['sillon', 0.35],
      ['puff', 0.41],
      ['banco', 0.42625],
    ] as const)
      expect(accionesDeObjetos([objeto(tipo)], 0)[0]!.asiento.y).toBeCloseTo(alto);
  });
  it('repisa y sombrilla conservan el volumen a su altura real', () => {
    const repisa = suelosDeObjetos([objeto('repisa-modular')], 0);
    expect(repisa.solidos[0]).toMatchObject({ y0: 1.1, y1: 1.75 });
    const sombrilla = suelosDeObjetos([objeto('sombrilla')], 0);
    expect(sombrilla.solidos).toHaveLength(2);
    expect(tipoObjeto('sombrilla')!.colisiones).toHaveLength(3);
    expect(sombrilla.solidos[0]!.y0).toBeCloseTo(0.12);
    expect(sombrilla.solidos[1]!.y0).toBeGreaterThan(2);
    expect(sombrilla.solidos[1]!.infranqueable).not.toBe(true);
    expect(tipoObjeto('banco-parque')!.pisable).toBe(false);
  });
  it('colgantes usan su elevación y el vidrio tiene lote separado', () => {
    const t = tipoObjeto('colgante')!;
    const p = piezaDe(t.tipo)[0]!;
    const m = matrizDeParte(objeto(t.tipo), 1, p, new Matrix4());
    expect(new Vector3().setFromMatrixPosition(m).y).toBeCloseTo(
      1 + t.elevacion! + p.c[1] * t.alto,
    );
    expect(claveInstancia({ ...p, opacidad: 0.2 })).not.toBe(claveInstancia(p));
  });
});
