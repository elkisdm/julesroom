import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearLienzo } from './lienzo';
afterEach(() => vi.unstubAllGlobals());
describe('lámina de texto dentro del marco', () => {
  it('acomoda un título largo y cinco líneas sin superposición vertical', async () => {
    const dibujadas: { texto: string; y: number; px: number }[] = [];
    const c = {
      font: '',
      fillStyle: '',
      textAlign: '',
      fillRect() {},
      measureText(s: string) {
        return { width: s.length * (Number(this.font.match(/(\d+)px/)?.[1]) || 38) * 0.8 };
      },
      fillText(texto: string, _x: number, y: number) {
        dibujadas.push({ texto, y, px: Number(this.font.match(/(\d+)px/)?.[1]) });
      },
    };
    const canvas = { width: 0, height: 0, getContext: () => c };
    vi.stubGlobal('document', { fonts: { ready: Promise.resolve() }, createElement: () => canvas });
    await crearLienzo(
      {
        id: 'texto',
        tipo: 'texto',
        titulo: 'W'.repeat(90),
        lineas: Array(5).fill('W'.repeat(100)),
      },
      undefined,
      0,
      1,
    );
    const contenido = dibujadas.filter((l) => l.texto !== '1 / 1');
    for (let i = 1; i < contenido.length; i++)
      expect(contenido[i]!.y - contenido[i - 1]!.y).toBeGreaterThanOrEqual(contenido[i]!.px);
    expect(contenido.at(-1)!.y).toBeLessThan(820);
  });
});
