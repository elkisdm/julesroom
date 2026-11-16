import { describe, expect, it } from 'vitest';
import { suelosDeObjetos } from './solidos';
import {
  crearHistoria,
  deshacer,
  hacer,
  huella,
  migrarDefinicion,
  tipoObjeto,
} from '@oficina/motor';
import type { ObjetoColocado, Giro, SalaGuardada } from '@oficina/motor';
import { ejemploEquipo } from '@oficina/motor';

const obj = (tipo: string, x: number, z: number, giro: Giro = 0): ObjetoColocado => ({
  id: `obj-${tipo}-${x}-${z}`,
  tipo,
  x,
  z,
  giro,
});

/** Sólo los sólidos (lo que bloquea sin poder pisarse). */
const solidosDeObjetos = (objetos: ObjetoColocado[], yPiso: number) =>
  suelosDeObjetos(objetos, yPiso).solidos;

const base = { ...ejemploEquipo, plano: { plantilla: 'trading' } };
const salaBase = (): SalaGuardada => migrarDefinicion(base);
const conObjetos = (s: SalaGuardada, objetos: ObjetoColocado[]): SalaGuardada => ({
  ...s,
  mundo: { ...s.mundo, objetos },
});

describe('solidosDeObjetos', () => {
  it('un objeto con volumen genera un sólido cuya huella coincide con la pieza girada', () => {
    const o = obj('planta-grande', 3, 5, 0);
    const solidos = solidosDeObjetos([o], 0);
    expect(solidos).toHaveLength(1);
    const s = solidos[0]!;
    const h = huella(o);
    expect(s.x0).toBe(h.x0);
    expect(s.x1).toBe(h.x1);
    expect(s.z0).toBe(h.z0);
    expect(s.z1).toBe(h.z1);
    expect(s.y0).toBe(0);
    expect(s.y1).toBe(tipoObjeto('planta-grande')!.alto);
    expect(s.tipo).toBe('mueble');
  });

  it('con giro impar, la huella intercambia ancho y fondo', () => {
    const o = obj('escritorio', 2, 3, 1);
    const solidos = solidosDeObjetos([o], 0);
    expect(solidos).toHaveLength(1);
    const s = solidos[0]!;
    const h = huella(o);
    expect(s.x0).toBe(h.x0);
    expect(s.x1).toBe(h.x1);
    expect(s.z0).toBe(h.z0);
    expect(s.z1).toBe(h.z1);
    const anchoSolido = s.x1 - s.x0;
    const fondoSolido = s.z1 - s.z0;
    const t = tipoObjeto('escritorio')!;
    expect(anchoSolido).toBeCloseTo(t.fondo);
    expect(fondoSolido).toBeCloseTo(t.ancho);
  });

  it('un objeto bajo (mesa, sofá) se sube: genera una superficie en su tapa y no un sólido', () => {
    const mesa = obj('mesa-redonda', 3, 3);
    const { solidos, superficies } = suelosDeObjetos([mesa], 0.5);
    expect(solidos).toHaveLength(0);
    const s = superficies[0]!;
    expect(s.forma === 'caja' && s.y).toBeCloseTo(0.5 + tipoObjeto('mesa-redonda')!.alto, 9);
    const girado = suelosDeObjetos([obj('sofa-tres', 2, 3, 1)], 0).superficies[0]!;
    const h = huella(obj('sofa-tres', 2, 3, 1));
    expect(girado.forma === 'caja' && [girado.x0, girado.x1, girado.z0, girado.z1]).toEqual([
      h.x0,
      h.x1,
      h.z0,
      h.z1,
    ]);
  });

  it('un escritorio (puesto de trabajo) no se pisa por defecto: bloquea aunque esté al alcance', () => {
    const { solidos, superficies } = suelosDeObjetos([obj('escritorio', 1, 1)], 0);
    expect(superficies).toHaveLength(0);
    expect(solidos[0]!.infranqueable).toBe(true);
  });

  it('un objeto más alto que el alcance del salto es un sólido infranqueable', () => {
    const [s] = solidosDeObjetos([obj('planta-grande', 1, 1)], 0);
    expect(s!.infranqueable).toBe(true);
  });

  it('al quitar un objeto, su sólido desaparece', () => {
    const lista = [obj('planta-grande', 1, 1), obj('escritorio', 3, 3)];
    expect(solidosDeObjetos(lista, 0)).toHaveLength(2);
    const sinPrimero = lista.slice(1);
    const solidos = solidosDeObjetos(sinPrimero, 0);
    expect(solidos).toHaveLength(1);
    expect(solidos[0]!.id).toContain('escritorio');
  });

  it('una pieza marcada como pisable (alfombra) no genera sólido', () => {
    const o = obj('alfombra', 2, 2);
    expect(tipoObjeto('alfombra')!.pisable).toBe(true);
    const solidos = solidosDeObjetos([o], 0);
    expect(solidos).toHaveLength(0);
  });

  it('un cuadro ocupa espacio al colocar pero no bloquea al caminar', () => {
    const o = obj('cuadro', 4, 4);
    expect(tipoObjeto('cuadro')!.pisable).not.toBe(true);
    expect(tipoObjeto('cuadro')!.noBloqueaPaso).toBe(true);
    const solidos = solidosDeObjetos([o], 0);
    expect(solidos).toHaveLength(0);
  });

  it('respeta el yPiso para y0 e y1', () => {
    const o = obj('escritorio', 0, 0);
    const solidos = solidosDeObjetos([o], 2.5);
    const s = solidos[0]!;
    expect(s.y0).toBe(2.5);
    expect(s.y1).toBe(2.5 + tipoObjeto('escritorio')!.alto);
  });

  it('lista vacía devuelve lista vacía', () => {
    expect(solidosDeObjetos([], 0)).toEqual([]);
  });

  it('ignora tipos desconocidos que no están en el catálogo', () => {
    const o = obj('tipo-inexistente', 0, 0);
    expect(solidosDeObjetos([o], 0)).toEqual([]);
  });

  it('mezcla bloqueantes y pisables: ni la alfombra ni el cuadro generan nada, y el sillón se sube', () => {
    const lista = [
      obj('planta-grande', 1, 1),
      obj('alfombra', 2, 2),
      obj('escritorio', 3, 3),
      obj('sillon', 5, 5),
      obj('cuadro', 4, 4),
    ];
    const { solidos, superficies } = suelosDeObjetos(lista, 0);
    expect(solidos).toHaveLength(2);
    expect(solidos.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('planta-grande'),
        expect.stringContaining('escritorio'),
      ]),
    );
    expect(superficies.map((s) => s.id)).toEqual([expect.stringContaining('sillon')]);
  });
});

describe('sólidos y flujo de deshacer en la historia de la sala', () => {
  it('deshacer una colocación restituye el sólido previo (sin objeto → sin sólido)', () => {
    const inicial = salaBase();
    const h0 = crearHistoria(inicial);
    expect(solidosDeObjetos(h0.presente.mundo.objetos, 0)).toHaveLength(0);

    const conPlanta = conObjetos(inicial, [obj('planta-grande', 1, 1)]);
    const h1 = hacer(h0, conPlanta, 50);
    expect(solidosDeObjetos(h1.presente.mundo.objetos, 0)).toHaveLength(1);

    const h2 = deshacer(h1);
    expect(solidosDeObjetos(h2.presente.mundo.objetos, 0)).toHaveLength(0);
  });

  it('deshacer una eliminación restituye el sólido', () => {
    const planta = obj('escritorio', 2, 2);
    const conEscritorio = conObjetos(salaBase(), [planta]);
    const h0 = crearHistoria(conEscritorio);
    expect(solidosDeObjetos(h0.presente.mundo.objetos, 0)).toHaveLength(1);

    const vacia = conObjetos(conEscritorio, []);
    const h1 = hacer(h0, vacia, 50);
    expect(solidosDeObjetos(h1.presente.mundo.objetos, 0)).toHaveLength(0);

    const h2 = deshacer(h1);
    expect(solidosDeObjetos(h2.presente.mundo.objetos, 0)).toHaveLength(1);
    expect(solidosDeObjetos(h2.presente.mundo.objetos, 0)[0]!.id).toContain('escritorio');
  });
});
