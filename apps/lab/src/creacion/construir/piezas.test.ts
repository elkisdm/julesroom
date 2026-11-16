import { describe, expect, it } from 'vitest';
import { CATALOGO_OBJETOS } from '@oficina/motor';
import {
  PARAMETROS_INSTANCIAS_OBJETOS,
  claveInstancia,
  indiceInstanciaAObjeto,
  llamadasInstanciadas,
  llamadasSinInstanciar,
  objetosPruebaMezclados,
  piezaDe,
} from './piezas';

describe('instancias de objetos colocados', () => {
  const tipos = CATALOGO_OBJETOS.map((t) => t.tipo);
  const muestra = objetosPruebaMezclados(tipos, PARAMETROS_INSTANCIAS_OBJETOS.cantidadPrueba);

  it('60 objetos mezclados bajan de ~300 mallas sueltas a pocas llamadas por tipo', () => {
    const sin = llamadasSinInstanciar(muestra);
    const con = llamadasInstanciadas(muestra);
    expect(sin).toBeGreaterThan(200);
    expect(con).toBeLessThan(sin / 3);
    expect(con).toBeLessThanOrEqual(PARAMETROS_INSTANCIAS_OBJETOS.topeLlamadas);
  });

  it('el índice de instancia devuelve el objeto correcto', () => {
    const clave = claveInstancia(piezaDe(muestra[0]!.tipo)[0]!);
    const id = indiceInstanciaAObjeto(muestra, clave, 0);
    expect(id).toBe(muestra[0]!.id);
  });
});
