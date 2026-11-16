import { describe, expect, it } from 'vitest';
import { escenarioOficina, escenarioTrading } from '../index';
import { evaluarColocacion, zonasAlcanzables } from './colocacion';
import type { ObjetoColocado } from './formato';
import { huella } from './rejilla';

const o = (
  id: string,
  tipo: string,
  x: number,
  z: number,
  giro: 0 | 1 | 2 | 3 = 0,
): ObjetoColocado => ({
  id,
  tipo,
  x,
  z,
  giro,
});
const lo = escenarioTrading.colision(escenarioTrading.entradas[0]!.y);
const ctx = (objetos: ObjetoColocado[] = []) => ({ escenario: escenarioTrading, objetos });

/** Un punto del suelo libre de cajas, lugares y entradas, hallado a ojo con el propio evaluador. */
function puntoLibre(): { x: number; z: number } {
  for (let x = -16; x < 16; x += 0.5)
    for (let z = -12; z < 7; z += 0.5)
      if (evaluarColocacion(o('t', 'planta-grande', x, z), ctx()).estado === 'libre')
        return { x, z };
  throw new Error('sin punto libre');
}

/** Lámparas en anillo alrededor de la entrada: la dejan aislada del resto de la sala. */
function anillo(prefijo: string): ObjetoColocado[] {
  const e = escenarioTrading.entradas[0]!;
  const out: ObjetoColocado[] = [];
  for (let dx = -1.5; dx <= 1.5; dx += 0.5)
    for (let dz = -1.5; dz <= 1; dz += 0.5)
      if (dx === -1.5 || dx === 1.5 || dz === -1.5 || dz === 1)
        out.push(o(`${prefijo}${out.length}`, 'lampara-mesa', e.x + dx, e.z + dz));
  return out;
}

describe('evaluarColocacion', () => {
  it('libre en un hueco vacío', () => {
    const p = puntoLibre();
    expect(evaluarColocacion(o('n', 'planta-grande', p.x, p.z), ctx())).toMatchObject({
      estado: 'libre',
      motivo: null,
    });
  });

  it('el cuadro respeta muebles, objetos, puestos y entrada aunque no bloquee el paso', () => {
    const c = lo.cajas.find((b) => b.x1 - b.x0 > 0.5 && b.z1 - b.z0 > 0.5)!;
    const p = puntoLibre();
    const puesto = escenarioTrading.planta.lugares[0]!;
    const entrada = escenarioTrading.entradas[0]!;
    for (const punto of [{ x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2 }, puesto, entrada])
      expect(evaluarColocacion(o('cu', 'cuadro', punto.x, punto.z), ctx()).estado).toBe('choca');
    expect(
      evaluarColocacion(o('cu', 'cuadro', p.x, p.z), ctx([o('mesa', 'mesa-redonda', p.x, p.z)])),
    ).toMatchObject({ estado: 'choca', contra: 'mesa' });
    expect(evaluarColocacion(o('cu', 'cuadro', p.x, p.z), ctx()).estado).toBe('libre');
  });

  it('los cuadros no cierran rutas aunque sus huellas rodeen la entrada', () => {
    const cuadros = anillo('cu').map((pieza) => ({ ...pieza, tipo: 'cuadro' }));
    expect(zonasAlcanzables(escenarioTrading, cuadros)).toEqual(
      zonasAlcanzables(escenarioTrading, []),
    );
  });

  it('fuera de los límites', () => {
    const r = evaluarColocacion(o('n', 'planta-grande', lo.limites.x1 + 5, 0), ctx());
    expect(r).toMatchObject({ estado: 'fuera', motivo: 'Fuera de la sala' });
  });

  it('choca con un mueble del escenario', () => {
    const c = lo.cajas.find((b) => b.x1 - b.x0 > 0.5 && b.z1 - b.z0 > 0.5)!;
    const r = evaluarColocacion(
      o('n', 'planta-grande', (c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2),
      ctx(),
    );
    expect(r).toMatchObject({ estado: 'choca', motivo: 'Choca con un mueble' });
  });

  it('choca con otro objeto y lo nombra; ignora al de su propio id; tolera 1 cm de roce', () => {
    const p = puntoLibre();
    const otro = o('a', 'mesa-redonda', p.x, p.z);
    const r = evaluarColocacion(o('n', 'mesa-redonda', p.x + 0.2, p.z), ctx([otro]));
    expect(r).toMatchObject({ estado: 'choca', contra: 'a' });
    expect(r.motivo).toMatch(/^Choca con /);
    expect(evaluarColocacion(o('a', 'mesa-redonda', p.x + 0.2, p.z), ctx([otro])).estado).not.toBe(
      'choca',
    );
    const h = huella(otro);
    const ancho = 0.5;
    const pegado = o('n', 'maceta-baja', h.x1 + 0.2 + ancho / 2 - 0.2 + 0.005, p.z);
    expect(huella(pegado).x0).toBeLessThan(h.x1 + 0.011);
  });

  it('las alfombras no chocan con nada ni nada choca con ellas', () => {
    const p = puntoLibre();
    const alfombra = o('al', 'alfombra', p.x, p.z);
    expect(evaluarColocacion(o('n', 'mesa-redonda', p.x, p.z), ctx([alfombra])).estado).toBe(
      'libre',
    );
    expect(evaluarColocacion(alfombra, ctx([o('m', 'mesa-redonda', p.x, p.z)])).estado).toBe(
      'libre',
    );
    const c = lo.cajas.find(
      (b) =>
        b.x1 - b.x0 > 0.5 &&
        b.x0 > lo.limites.x0 + 3 &&
        b.x1 < lo.limites.x1 - 3 &&
        b.z0 > lo.limites.z0 + 3 &&
        b.z1 < lo.limites.z1 - 3,
    )!;
    expect(
      evaluarColocacion(o('al2', 'alfombra', (c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2), ctx()).estado,
    ).toBe('libre');
  });

  it('no tapa un puesto de trabajo ni la entrada', () => {
    const l = escenarioTrading.planta.lugares[0]!;
    const rl = evaluarColocacion(o('n', 'planta-grande', l.x, l.z), ctx());
    expect(rl.estado).toBe('choca');
    const e = escenarioTrading.entradas[0]!;
    const re = evaluarColocacion(o('n', 'planta-grande', e.x, e.z), ctx());
    expect(re.estado).toBe('choca');
    expect(['Tapa un puesto', 'Tapa la entrada', 'Choca con un mueble']).toContain(re.motivo);
  });

  it('cerrar el paso a una zona da «bloquea» con el nombre de la zona', () => {
    const rodeo = anillo('b');
    const ultimo = rodeo[2]!; // una lámpara del lado norte, no una esquina
    const sinUltimo = rodeo.filter((x) => x !== ultimo && x !== rodeo[3]); // hueco de 1,5 m: se puede pasar
    const r = evaluarColocacion(ultimo, ctx(sinUltimo));
    expect(r.estado).toBe('bloquea');
    expect(r.motivo).toMatch(/^Cierra el paso a /);
  });

  it('zonasAlcanzables con el escenario vacío trae zonas; con la entrada sellada, menos', () => {
    const libre = zonasAlcanzables(escenarioTrading, []);
    expect(libre.size).toBeGreaterThan(3);
    const sello = anillo('s');
    expect(zonasAlcanzables(escenarioTrading, sello).size).toBeLessThan(libre.size);
  });

  it('funciona también en la oficina', () => {
    const r = evaluarColocacion(o('n', 'planta-grande', 99, 99), {
      escenario: escenarioOficina,
      objetos: [],
    });
    expect(r.estado).toBe('fuera');
  });

  it('rendimiento: una evaluación completa (hasta el chequeo de paso) en trading es rápida', () => {
    const objetos: ObjetoColocado[] = [];
    for (let x = -16; x < 16 && objetos.length < 30; x += 1.5)
      for (let z = -12; z < 7 && objetos.length < 30; z += 1.5) {
        const c = o(`p${objetos.length}`, 'maceta-baja', x, z);
        if (evaluarColocacion(c, ctx(objetos)).estado === 'libre') objetos.push(c);
      }
    expect(objetos.length).toBeGreaterThan(10);
    let nuevo = o('n', 'planta-grande', 0, 0);
    for (let x = -16; x < 16; x += 0.5)
      for (let z = -12; z < 7; z += 0.5)
        if (evaluarColocacion(o('n', 'planta-grande', x, z), ctx(objetos)).estado === 'libre')
          nuevo = o('n', 'planta-grande', x, z);
    expect(evaluarColocacion(nuevo, ctx(objetos)).estado).toBe('libre');
    const N = 20;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) evaluarColocacion(nuevo, ctx(objetos));
    const ms = (performance.now() - t0) / N;
    console.info(`evaluarColocacion: ${ms.toFixed(2)} ms por evaluación`);
    expect(ms).toBeLessThan(60);
  });
});
