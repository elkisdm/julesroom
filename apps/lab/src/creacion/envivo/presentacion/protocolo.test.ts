import { describe, expect, it } from 'vitest';
import {
  leerPresentacion,
  trocearImagen,
  reunirImagen,
  PARAMETROS_PRESENTACION,
} from './protocolo';
const estado = {
  tipo: 'd3/estado',
  revision: 1,
  pantalla: { x: 0, y: 0, z: 3, giro: 0, ancho: 6 },
  actual: 0,
  laminas: [{ id: 'texto', tipo: 'texto', titulo: 'Hola', lineas: ['Uno'] }],
};
describe('frontera D3', () => {
  it('admite estado solo del dueño autenticado, aunque el invitado diga ser dueño', () => {
    expect(leerPresentacion(JSON.stringify(estado), 'dueno', 'dueno')).toEqual(estado);
    expect(
      leerPresentacion(JSON.stringify({ ...estado, dueno: 'dueno' }), 'invitado', 'dueno'),
    ).toBeNull();
  });
  it('rechaza índices, NaN, líneas, cantidades y tamaños fuera de límite', () => {
    for (const p of [
      { ...estado, actual: 1 },
      { ...estado, pantalla: { ...estado.pantalla, ancho: null } },
      { ...estado, laminas: Array(41).fill(estado.laminas[0]) },
      { ...estado, laminas: [{ ...estado.laminas[0], lineas: Array(6).fill('x') }] },
    ])
      expect(leerPresentacion(JSON.stringify(p), 'dueno', 'dueno')).toBeNull();
    expect(leerPresentacion(' '.repeat(15001), 'dueno', 'dueno')).toBeNull();
  });
  it('trocea bajo el máximo fiable, recompone fuera de orden y tolera duplicados', () => {
    const imagen = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(270000);
    const trozos = trocearImagen('imagen', imagen);
    expect(trozos.length).toBeGreaterThan(1);
    for (const t of trozos) {
      expect(new TextEncoder().encode(JSON.stringify(t)).length).toBeLessThanOrEqual(15000);
      expect(leerPresentacion(JSON.stringify(t), 'dueno', 'dueno')).toEqual(t);
    }
    expect(reunirImagen([...trozos].reverse())).toBe(imagen);
    expect(reunirImagen([...trozos, trozos[0]!])).toBe(imagen);
    expect(reunirImagen(trozos.slice(1))).toBeNull();
  });
  it('las peticiones y acuses no conceden autoridad y el puntero está acotado', () => {
    expect(
      leerPresentacion(JSON.stringify({ tipo: 'd3/pedir', id: 'imagen' }), 'invitado', 'dueno'),
    ).not.toBeNull();
    expect(
      leerPresentacion(
        JSON.stringify({ tipo: 'd3/laser', x: 2, y: 0, lamina: 'texto' }),
        'dueno',
        'dueno',
      ),
    ).toBeNull();
    expect(PARAMETROS_PRESENTACION.maxLaminas).toBe(40);
  });
});
