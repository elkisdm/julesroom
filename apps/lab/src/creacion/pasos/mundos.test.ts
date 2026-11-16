import { describe, expect, it } from 'vitest';
import { escenarioPorId } from '@oficina/motor';
import { paletaLuz } from '@oficina/motor';
import { PLANTILLAS } from '../plantillas';
import {
  navegarMundo,
  accionDeTecla,
  datosMundo,
  estiloMundo,
  direccionDeslizamiento,
  cuadroVuelo,
  cuadroExploracion,
  giroPorArrastre,
} from './mundos';

describe('selección de mundos', () => {
  it('recorre todas las plantillas en orden y da la vuelta', () => {
    for (const [i, p] of PLANTILLAS.entries()) {
      expect(navegarMundo(p.id, 1)).toBe(PLANTILLAS[(i + 1) % PLANTILLAS.length]?.id);
      expect(navegarMundo(p.id, -1)).toBe(
        PLANTILLAS[(i + PLANTILLAS.length - 1) % PLANTILLAS.length]?.id,
      );
    }
    expect(navegarMundo('inexistente', 1)).toBe(PLANTILLAS[1]?.id);
  });
  it('traduce flechas, Enter y Escape, sin apropiarse de modificadores', () => {
    expect(
      ['ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'a'].map((k) => accionDeTecla(k)),
    ).toEqual(['anterior', 'siguiente', 'confirmar', 'volver', null]);
    expect(accionDeTecla('Enter', true)).toBeNull();
  });
  it('distingue deslizamientos horizontales de toques y scroll vertical', () => {
    expect(direccionDeslizamiento(100, 20, 5)).toBe(1);
    expect(direccionDeslizamiento(20, 100, 5)).toBe(-1);
    expect(direccionDeslizamiento(20, 40, 0)).toBe(0);
    expect(direccionDeslizamiento(20, 100, 120)).toBe(0);
  });
  for (const p of PLANTILLAS)
    it(`deriva los datos reales de ${p.id}`, () => {
      const e = escenarioPorId(p.id);
      expect(datosMundo(e)).toEqual({
        nombre: e.nombre,
        puestos: e.planta.lugares.filter((l) => l.departamento !== null && !l.extra).length,
        zonas: e.vistas.zonas.length,
        plantas: e.planta.niveles.length,
      });
      const cambiado = {
        ...e,
        planta: { ...e.planta, niveles: [...e.planta.niveles, 999], lugares: [] },
        vistas: { ...e.vistas, zonas: [] },
      };
      expect(datosMundo(cambiado)).toMatchObject({
        puestos: 0,
        zonas: 0,
        plantas: e.planta.niveles.length + 1,
      });
    });
  it('oculta estilos únicos, resuelve ids inválidos y usa muestras de paleta reales', () => {
    const v = escenarioPorId('trading').variantes;
    expect(estiloMundo([], 'x')).toEqual({ visible: false, elegida: undefined, colores: [] });
    expect(estiloMundo(v.slice(0, 1), 'x').visible).toBe(false);
    const r = estiloMundo(v, 'invalida');
    expect(r.elegida).toBe(v[0]);
    expect(r.visible).toBe(v.length > 1);
    expect(estiloMundo(v, v[1]?.id).elegida).toBe(v[1] ?? v[0]);
    const conMateriales = v.find((v) => v.paleta.materiales);
    if (conMateriales)
      for (const c of estiloMundo(v, conMateriales.id).colores)
        expect([
          conMateriales.paleta.fondo,
          ...Object.values(conMateriales.paleta.materiales ?? {}),
        ]).toContain(c);
  });
  it('muestra colores calculados por la luz cuando la variante solo declara hora', () => {
    const v = escenarioPorId('mansion').variantes;
    const dia = estiloMundo(v, 'dia').colores;
    const noche = estiloMundo(v, 'noche').colores;
    expect(dia).toHaveLength(3);
    expect(noche).toHaveLength(3);
    expect(dia).not.toEqual(noche);
    const luz = paletaLuz(v[0]!.paleta.hora);
    expect(dia).toEqual(
      [luz.cielo.cenit, luz.sol.color, luz.interior.color].map(
        (c) => `rgb(${Math.round(c.r * 255)} ${Math.round(c.g * 255)} ${Math.round(c.b * 255)})`,
      ),
    );
  });
  it('acota el giro del arrastre para mantener visible el frente de la sala', () => {
    expect(giroPorArrastre(0, 100, 100)).toBe(0);
    expect(giroPorArrastre(0, 100, 0)).toBeGreaterThan(0);
    expect(giroPorArrastre(0, 0, 100)).toBeLessThan(0);
    expect(giroPorArrastre(0, 10000, 0)).toBe(0.45);
    expect(giroPorArrastre(0, 0, 10000)).toBe(-0.45);
  });
  it('gira la vista alrededor del escenario sin cambiar su distancia ni su objetivo', () => {
    const c = cuadroVuelo(escenarioPorId('oficina').vistas, 1440, 640, 1, false);
    const girado = cuadroExploracion(c, 0.2);
    expect(girado.objetivo).toEqual(c.objetivo);
    expect(girado.posicion.x).not.toBe(c.posicion.x);
    const distancia = (p: typeof c) =>
      Math.hypot(
        p.posicion.x - p.objetivo.x,
        p.posicion.y - p.objetivo.y,
        p.posicion.z - p.objetivo.z,
      );
    expect(distancia(girado)).toBeCloseTo(distancia(c));
    expect(cuadroExploracion(c, 0)).toEqual(c);
  });
  it('el vuelo parte de un lateral y acaba exactamente en el encuadre; reduce motion no viaja', () => {
    const vistas = escenarioPorId('trading').vistas;
    const fin = cuadroVuelo(vistas, 1440, 650, 1, false);
    const inicio = cuadroVuelo(vistas, 1440, 650, 0, false);
    expect(inicio.posicion.x).not.toBe(fin.posicion.x);
    expect(cuadroVuelo(vistas, 1440, 650, 0, true)).toEqual(fin);
    expect(cuadroVuelo(vistas, 1440, 650, 2, false)).toEqual(fin);
    for (const [w, h] of [
      [1440, 650],
      [390, 420],
      [320, 300],
    ]) {
      const c = cuadroVuelo(vistas, w!, h!, 1, false);
      expect(c.posicion.y).toBeGreaterThan(c.objetivo.y);
      expect(Number.isFinite(c.distancia)).toBe(true);
    }
  });
});
