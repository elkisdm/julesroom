import { describe, expect, it, vi } from 'vitest';
import { planVoz, PARAMETROS_VOZ } from '@oficina/presencia';
import type { FuenteLiveKit } from '@oficina/presencia';
import { sinVoz, fuenteSinVoz, PARAMETROS_SIN_VOZ } from './sinVoz';
describe('sala sin voz', () => {
  it('solo se activa con la variable explícita y excluye toda distancia de suscripción', () => {
    expect(sinVoz({})).toBe(false);
    expect(sinVoz({ VITE_SALA_SIN_VOZ: '1' })).toBe(true);
    const yo = { x: 0, y: 0, z: 0 };
    const otros = [
      { ...yo, id: 'junto-a-ti' },
      { x: 3, y: 0, z: 0, id: 'cerca' },
    ];
    expect(
      planVoz(yo, otros, new Set(), { ...PARAMETROS_VOZ, ...PARAMETROS_SIN_VOZ }).suscritos.size,
    ).toBe(0);
    expect(planVoz(yo, otros, new Set()).suscritos.size).toBe(2);
  });
  it('no permite capturar audio y conserva los métodos de presencia y datos', async () => {
    const activarMicrofono = vi.fn();
    const enviarDatos = vi.fn();
    const publicarPropio = vi.fn();
    const fuente = {
      activarMicrofono,
      enviarDatos,
      publicarPropio,
      hablandoIds: new Set(['otro']),
    } as unknown as FuenteLiveKit;
    const muda = fuenteSinVoz(fuente);
    await muda.activarMicrofono();
    expect(activarMicrofono).not.toHaveBeenCalled();
    expect(muda.hablandoIds.size).toBe(0);
    expect(muda.enviarDatos).toBe(enviarDatos);
    expect(muda.publicarPropio).toBe(publicarPropio);
  });
});
