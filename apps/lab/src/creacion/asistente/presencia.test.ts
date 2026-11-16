import { expect, it } from 'vitest';
import { crearSaludos, miradaCercana, apartarseDePantalla } from './presencia';
const p = { x: 0, y: 0, z: 0 };
it('no saluda al censo inicial; recibe llegadas con máximo un saludo cada 20 segundos', () => {
  const saludos = crearSaludos();
  const ana = { id: 'a', nombre: 'Ana' },
    beto = { id: 'b', nombre: 'Beto' },
    carla = { id: 'c', nombre: 'Carla' };
  expect(saludos([ana], 0)).toBeNull();
  expect(saludos([ana, beto], 100)).toBe('Hola, Beto. Qué gusto verte.');
  expect(saludos([ana, beto, carla], 500)).toBeNull();
  expect(saludos([ana, beto, carla], 20100)).toBeNull();
  expect(saludos([ana, beto, carla, { id: 'd', nombre: 'Dani' }], 20100)).toContain('Dani');
});
it('las salidas no saludan y una reconexión respeta el mismo límite', () => {
  const saludos = crearSaludos();
  saludos([], 0);
  expect(saludos([{ id: 'a', nombre: 'Ana' }], 0)).toContain('Ana');
  expect(saludos([], 500)).toBeNull();
  expect(saludos([{ id: 'a', nombre: 'Ana' }], 1000)).toBeNull();
});
it('mira a la persona más cercana de su piso y olvida a quien se aleja', () => {
  expect(
    miradaCercana(p, [
      { ...p, x: 4 },
      { ...p, z: 2 },
    ]),
  ).toEqual({ ...p, z: 2 });
  expect(
    miradaCercana(p, [
      { ...p, x: 9 },
      { ...p, y: 5 },
    ]),
  ).toBeNull();
});
it('se aparta lateralmente solo cuando tapa el tramo entre persona y pantalla', () => {
  const yo = { ...p, z: 6 };
  const jules = { ...p, z: 3 };
  const salida = apartarseDePantalla(jules, yo, [p], () => true);
  expect(salida).not.toBeNull();
  expect(Math.abs(salida!.x)).toBeGreaterThan(1);
  expect(apartarseDePantalla({ ...jules, x: 3 }, yo, [p], () => true)).toBeNull();
  expect(apartarseDePantalla({ ...jules, z: 8 }, yo, [p], () => true)).toBeNull();
  expect(apartarseDePantalla(jules, yo, [p], () => false)).toBeNull();
});
it('prueba ambos costados y no cambia de piso al ceder espacio', () => {
  const salida = apartarseDePantalla({ ...p, z: 3 }, { ...p, z: 6 }, [p], (q) => q.x > 0);
  expect(salida!.x).toBeGreaterThan(0);
  expect(salida!.y).toBe(0);
});
