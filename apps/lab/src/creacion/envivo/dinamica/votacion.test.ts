import { escenarioTrading } from '@oficina/motor';
import { espacioD2 } from '@oficina/motor';
import { describe, it, expect } from 'vitest';
import { leerVotacionD2, contarVotos, resultadoVotos, crearZonas } from './votacion';
describe('votar con los pies', () => {
  it('cuenta una sola zona por persona y excluye otra planta y fuera de zona', () => {
    const zonas = [
      { x: 0, y: 0, z: 0, rotulo: 'Sí' },
      { x: 4, y: 0, z: 0, rotulo: 'No' },
    ];
    expect(
      contarVotos(zonas, [
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 0 },
        { x: 0, y: 4, z: 0 },
        { x: 20, y: 0, z: 0 },
      ]),
    ).toEqual([1, 1]);
  });
  it('informa empate y ausencia de votos sin inventar ganador', () => {
    expect(resultadoVotos([0, 0])).toEqual([]);
    expect(resultadoVotos([2, 2, 1])).toEqual([0, 1]);
    expect(resultadoVotos([1, 3])).toEqual([1]);
  });
  it('solo acepta estado firmado por el dueño y valida textos, cantidad y posiciones', () => {
    const m = {
      tipo: 'd2-votacion',
      revision: 1,
      id: 'uno',
      pregunta: '¿Qué elegimos?',
      opciones: [
        { x: 0, y: 0, z: 0, rotulo: 'A' },
        { x: 4, y: 0, z: 0, rotulo: 'B' },
      ],
      cerrada: false,
      conteos: [0, 0],
    };
    expect(leerVotacionD2(JSON.stringify(m), 'host', 'host')).toEqual(m);
    expect(leerVotacionD2(JSON.stringify(m), 'invitado', 'host')).toBeNull();
    expect(
      leerVotacionD2(JSON.stringify({ ...m, opciones: [m.opciones[0]] }), 'host', 'host'),
    ).toBeNull();
    expect(leerVotacionD2(JSON.stringify({ ...m, conteos: [-1, 0] }), 'host', 'host')).toBeNull();
  });
  it('coloca zonas completas y separadas frente al anfitrión o falla sin espacio', () => {
    const p = { x: 0, y: 0, z: 0, rumbo: 0 };
    const zonas = crearZonas(p, ['A', 'B', 'C', 'D'], () => true);
    expect(zonas).toHaveLength(4);
    expect(zonas.every((z) => z.z > 0)).toBe(true);
    for (let i = 1; i < zonas.length; i++)
      expect(
        Math.hypot(zonas[i]!.x - zonas[i - 1]!.x, zonas[i]!.z - zonas[i - 1]!.z),
      ).toBeGreaterThan(3);
    expect(crearZonas(p, ['A', 'B'], () => false)).toEqual([]);
  });
  it('encuentra zonas en el pasillo real aunque el anfitrión mire en diagonal', () => {
    const zonas = crearZonas(
      { x: 4, y: 0, z: 5, rumbo: -1.3 },
      ['A', 'B'],
      espacioD2(escenarioTrading, 0),
    );
    expect(zonas).toHaveLength(2);
  });
});
