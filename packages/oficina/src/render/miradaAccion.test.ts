import { expect, it } from 'vitest';
import { crearEstadoCuerpo } from './cuerpo';
import { orientarMiradaAccion } from './miradaAccion';
import { LIMITE_YAW } from '../animacion/mirada';
it('mira a la acción en el espacio local, limita el cuello y suelta al retirarla', () => {
  const c = crearEstadoCuerpo('yo');
  c.loc.rumbo = Math.PI / 2;
  orientarMiradaAccion(c, { x: 2, z: 0 });
  expect(c.objetivoYaw).toBeCloseTo(0);
  expect(c.salidaInteres.peso).toBe(1);
  orientarMiradaAccion(c, { x: 0, z: 2 });
  expect(c.objetivoYaw).toBeCloseTo(-LIMITE_YAW);
  orientarMiradaAccion(c, null);
  expect(c.salidaInteres.peso).toBe(0);
});
