import { describe, expect, it } from 'vitest';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Mueble } from '../../mansion/plano';
import type { Item } from './trading/Instancias';
import { colocacion, crearUbicador } from './ubicar';

const PI = Math.PI;

const mueble = (id: string, x: number, z: number, extra: Partial<Mueble> = {}): Mueble => ({
  id,
  tipo: 'sofa',
  ambiente: 'a',
  x,
  z,
  y: 0,
  ancho: 2,
  fondo: 1,
  alto: 0.8,
  giro: 0,
  conjunto: id,
  ...extra,
});

const tarima = mueble('tarima', 0, 0, { ancho: 6, fondo: 4, tipo: 'tarima' });
const atril = mueble('atril', 1, 1, { ancho: 0.6, fondo: 0.5, tipo: 'atril' });
const sofa = mueble('sofa', 10, 0);
const PLANTILLA = [tarima, atril, sofa];

/** Las 8 esquinas de la caja unitaria del ítem en el mundo, redondeadas y ordenadas. */
function esquinas(it: Item, previa = new Matrix4()): string[] {
  const m = new Matrix4().compose(
    new Vector3(...it.p),
    new Quaternion().setFromEuler(new Euler(it.rx ?? 0, it.r ?? 0, it.rz ?? 0)),
    new Vector3(...(it.e ?? [1, 1, 1])),
  );
  const total = previa.clone().multiply(m);
  const lista: string[] = [];
  for (const x of [-0.5, 0.5])
    for (const y of [-0.5, 0.5])
      for (const z of [-0.5, 0.5]) {
        const v = new Vector3(x, y, z).applyMatrix4(total);
        lista.push([v.x, v.y, v.z].map((n) => (Math.abs(n) < 1e-9 ? 0 : n).toFixed(6)).join(','));
      }
  return lista.sort();
}

/** La matriz que lleva lo de la pieza `antes` a donde está `despues` (girar en y alrededor de su centro). */
function movida(antes: Mueble, despues: Mueble): Matrix4 {
  return new Matrix4()
    .makeTranslation(despues.x, 0, despues.z)
    .multiply(new Matrix4().makeRotationY(despues.giro - antes.giro))
    .multiply(new Matrix4().makeTranslation(-antes.x, 0, -antes.z));
}

describe('crearUbicador', () => {
  const enSofa: Item = { p: [10.4, 0.3, 0.2], e: [1, 0.5, 0.2] };
  const suelto: Item = { p: [20, 0, 20], e: [1, 1, 1] };

  it('con los muebles de la plantilla devuelve las mismas listas (el dibujo de hoy, intacto)', () => {
    const items = [enSofa, suelto];
    expect(crearUbicador(PLANTILLA, PLANTILLA)(items)).toBe(items);
    // Otra lista con los mismos muebles en su sitio: tampoco cambia nada.
    expect(
      crearUbicador(
        PLANTILLA,
        PLANTILLA.map((m) => ({ ...m })),
      )(items),
    ).toBe(items);
  });

  it('lo que está sobre una pieza movida se traslada con ella; lo demás queda igual (mismo objeto)', () => {
    const ubicar = crearUbicador(PLANTILLA, [tarima, atril, { ...sofa, x: 12, z: 3 }]);
    const [a, b] = ubicar([enSofa, suelto]);
    expect(a!.p[0]).toBeCloseTo(12.4, 9);
    expect(a!.p[1]).toBe(0.3);
    expect(a!.p[2]).toBeCloseTo(3.2, 9);
    expect(a!.e).toEqual(enSofa.e);
    expect(b).toBe(suelto);
  });

  it('lo de una pieza quitada desaparece', () => {
    const ubicar = crearUbicador(PLANTILLA, [tarima, atril]);
    expect(ubicar([enSofa, suelto])).toEqual([suelto]);
  });

  it('el dueño de un ítem es el mueble más chico que lo contiene (el atril sobre la tarima)', () => {
    const sobreAtril: Item = { p: [1, 1.2, 1], e: [0.5, 1, 0.4] };
    const sobreTarima: Item = { p: [-2, 0.1, -1], e: [1, 0.2, 1] };
    const ubicar = crearUbicador(PLANTILLA, [tarima, { ...atril, x: 2 }, sofa]);
    const [a, t] = ubicar([sobreAtril, sobreTarima]);
    expect(a!.p[0]).toBeCloseTo(2, 9);
    expect(t).toBe(sobreTarima);
  });

  it('con margen se lleva lo que asoma fuera de la huella (hojas de una planta); sin margen, no', () => {
    const hoja: Item = { p: [11.3, 1.5, 0], e: [0.5, 0.3, 0.5] };
    const movido = [tarima, atril, { ...sofa, z: 5 }];
    expect(crearUbicador(PLANTILLA, movido)([hoja])[0]).toBe(hoja);
    expect(crearUbicador(PLANTILLA, movido)([hoja], { margen: 0.6 })[0]!.p[2]).toBeCloseTo(5, 9);
  });

  for (const [giro, nombre] of [
    [PI / 2, 'un cuarto de vuelta'],
    [-PI / 2, 'un cuarto de vuelta al otro lado'],
    [PI, 'media vuelta'],
  ] as const) {
    it(`girar ${nombre} deja cada caja donde la deja la rotación real de la pieza`, () => {
      const despues = { ...sofa, x: 4, z: -6, giro };
      const ubicar = crearUbicador(PLANTILLA, [tarima, atril, despues]);
      const casos: Item[] = [
        enSofa,
        { p: [10.42, 0.62, 0], e: [0.16, 0.8, 1] }, // respaldo
        { p: [10, 0.84, -0.26], e: [0.46, 0.58, 0.06], rx: 0.1 }, // respaldo inclinado
        { p: [9.8, 1, 0.1], e: [0.6, 0.4, 0.3], r: 0.7 }, // girado en y
        { p: [10.1, 1.2, -0.1], e: [0.5, 0.3, 0.4], r: 0.5, rx: -0.3 }, // hoja: girada e inclinada
      ];
      const nuevos = ubicar(casos);
      casos.forEach((c, i) => {
        expect(esquinas(nuevos[i]!), JSON.stringify(c)).toEqual(esquinas(c, movida(sofa, despues)));
      });
      // En los cuartos de vuelta, una caja sin giro propio sigue sin giro: solo se cruzan ancho y fondo.
      expect(nuevos[0]!.r ?? 0).toBe(0);
    });
  }
});

describe('colocacion (grupos que no son ítems, como una bicicleta)', () => {
  it('es null si la pieza no se movió; si se movió, el grupo que la lleva a su sitio', () => {
    expect(colocacion(sofa, { ...sofa })).toBeNull();
    const despues = { ...sofa, x: 4, z: -6, giro: PI / 2 };
    const c = colocacion(sofa, despues)!;
    const m = new Matrix4().compose(
      new Vector3(c.x, 0, c.z),
      new Quaternion().setFromEuler(new Euler(0, c.giro, 0)),
      new Vector3(1, 1, 1),
    );
    const p = new Vector3(10.4, 0.3, 0.2).applyMatrix4(m);
    const esperado = new Vector3(10.4, 0.3, 0.2).applyMatrix4(movida(sofa, despues));
    expect(p.distanceTo(esperado)).toBeLessThan(1e-9);
  });
});

describe('grupo', () => {
  it('con la plantilla intacta no traslada', () => {
    expect(crearUbicador(PLANTILLA, PLANTILLA).grupo(sofa.x, sofa.z)).toBeNull();
  });

  it('el centro de una pieza movida trae el grupo; un punto suelto no; la quitada se oculta', () => {
    const movida = crearUbicador(PLANTILLA, [tarima, atril, { ...sofa, x: 12, z: 3 }]);
    expect(movida.grupo(sofa.x, sofa.z)).toEqual({ x: 2, z: 3, giro: 0 });
    expect(movida.grupo(20, 20)).toBeNull();
    const quitada = crearUbicador(PLANTILLA, [tarima, atril]);
    expect(quitada.grupo(sofa.x, sofa.z)).toBe('quitado');
  });
});
