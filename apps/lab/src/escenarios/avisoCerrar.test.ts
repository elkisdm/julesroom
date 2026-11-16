/**
 * Con el panel de una acción ya abierto, el aviso (escritorio y botón táctil) dice «cerrar»:
 * la misma E que lo abrió lo cierra (`alternarPanel`).
 */
import { describe, expect, it } from 'vitest';
import { accionesDe, escenarioTrading } from '@oficina/motor';
import type { AccionAbrir } from '@oficina/motor';
import { textoAviso } from './aviso';
import { alternarPanel, estadoInicial, panelAbierto } from './paneles/abrir';

const acciones = accionesDe(escenarioTrading);
const cripto = acciones.find((x) => x.id === 'abrir:mesa:cripto') as AccionAbrir;
const forex = acciones.find((x) => x.id === 'abrir:mesa:forex') as AccionAbrir;

describe('aviso con el panel abierto', () => {
  it('panelAbierto: solo el panel de ese interés, y deja de estarlo al alternarlo', () => {
    const abierto = alternarPanel(estadoInicial, cripto.interes);
    expect(panelAbierto(abierto, cripto.interes)).toBe(true);
    expect(panelAbierto(abierto, forex.interes)).toBe(false);
    expect(panelAbierto(estadoInicial, cripto.interes)).toBe(false);
    expect(panelAbierto(alternarPanel(abierto, cripto.interes), cripto.interes)).toBe(false);
  });

  it('con su panel abierto dice «cerrar» y el nombre; cerrado, «abrir»', () => {
    expect(textoAviso(cripto, false, true)).toEqual({ verbo: 'cerrar', objeto: 'Mesa Cripto' });
    expect(textoAviso(cripto, false, false)).toEqual({ verbo: 'abrir', objeto: 'Mesa Cripto' });
  });

  it('«abierto» no cambia los avisos que no abren paneles', () => {
    const asiento = acciones.find((x) => x.tipo === 'sentarse')!;
    expect(textoAviso(asiento, false, true)).toEqual({ verbo: 'sentarse', objeto: null });
    expect(textoAviso(cripto, true, true)).toEqual({ verbo: 'levantarse', objeto: null });
  });
});
