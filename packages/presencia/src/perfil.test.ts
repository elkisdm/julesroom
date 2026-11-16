import { describe, it, expect } from 'vitest';
import { leerPerfil } from './perfil';
const a = {
  skin: '#123456',
  face: 'feliz',
  hair: 'corto',
  hairColor: '#123456',
  top: 'camisa',
  topColor: '#123456',
  print: '',
  bottom: 'jeans',
  bottomColor: '#123456',
  shoes: '#123456',
  acc: [],
};
describe('perfil remoto no confiable', () => {
  it('valida forma y cotas antes de entregarlo al render', () => {
    expect(leerPerfil(JSON.stringify({ n: 'Ana', a, e: 'sala', s: null }))).toMatchObject({
      n: 'Ana',
    });
    for (const v of [
      { n: 'Ana', a: {}, e: 'sala' },
      { n: 'x'.repeat(100), a, e: 'sala' },
      { n: 'Ana', a: { ...a, acc: [{}] }, e: 'sala' },
      null,
    ])
      expect(leerPerfil(JSON.stringify(v))).toBeNull();
  });
});
