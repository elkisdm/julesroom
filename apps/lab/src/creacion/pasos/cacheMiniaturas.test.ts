import { describe, it, expect } from 'vitest';
import { claveMiniatura, claveConjunto } from './cacheMiniaturas';
import { categorias } from './estadoPersonaje';
import { atuendoInicial } from '../plantillas';
describe('caché de miniaturas', () => {
  it('cambiar el top activo no regenera la misma muestra, pero cambiar piel sí', () => {
    const a = atuendoInicial(1);
    const cat = categorias[0]!;
    expect(claveMiniatura(cat, 'blazer', a)).toBe(
      claveMiniatura(cat, 'blazer', { ...a, top: 'camisa' }),
    );
    expect(claveMiniatura(cat, 'blazer', a)).not.toBe(
      claveMiniatura(cat, 'blazer', { ...a, skin: '#123456' }),
    );
  });
  it('los conjuntos no dependen de las prendas anteriores, sí de la identidad', () => {
    const a = atuendoInicial(1);
    expect(claveConjunto('lino', a)).toBe(
      claveConjunto('lino', { ...a, top: 'fundador', acc: ['mochila'] }),
    );
    expect(claveConjunto('lino', a)).not.toBe(claveConjunto('lino', { ...a, hair: 'rapado' }));
  });
});
