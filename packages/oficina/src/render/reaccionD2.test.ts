import { describe, it, expect } from 'vitest';
import { crearRigPrueba } from './rigPrueba';
import { saludarD2, posarSaludoD2, quitarSaludoD2 } from './reaccionD2';
describe('saludo de personas humanas', () => {
  it('usa el brazo derecho del saludo existente sin alterar el otro', () => {
    const { rig } = crearRigPrueba();
    const antes = rig.brazos[0].hombro.rotation.z;
    saludarD2('a', 3000);
    posarSaludoD2('a', rig, 1000, false);
    expect(rig.brazos[1].hombro.rotation.z).toBeGreaterThan(2);
    expect(rig.brazos[0].hombro.rotation.z).toBe(antes);
    quitarSaludoD2('a');
  });
  it('no vuelve a aplicar una reacción caducada y mantiene el saludo quieto con movimiento reducido', () => {
    const { rig } = crearRigPrueba();
    saludarD2('a', 3000);
    posarSaludoD2('a', rig, 1000, true);
    const angulo = rig.brazos[1].hombro.rotation.z;
    posarSaludoD2('a', rig, 1500, true);
    expect(rig.brazos[1].hombro.rotation.z).toBe(angulo);
    rig.brazos[1].hombro.rotation.z = 0;
    posarSaludoD2('a', rig, 4000, false);
    expect(rig.brazos[1].hombro.rotation.z).toBe(0);
  });
});
