/**
 * Unión de la selección de mundo (pasos/mundos) con la pestaña «Estilo» de construir: la variante
 * tiene UNA sola fuente, `sala.mundo.variante`. Lo que se elige al escoger el mundo es lo que
 * queda guardado y lo que la pestaña marca, y viceversa.
 */
import { describe, expect, it } from 'vitest';
import { escenarioPorId, parsearSala, serializarSala } from '@oficina/motor';
import { elegirVariante, varianteActiva } from './construir/variantes';
import { estiloMundo } from './pasos/mundos';
import { PLANTILLAS, atuendoInicial, conPlantilla, salaNueva } from './plantillas';

const datos = {
  nombre: 'Sala Norte',
  equipo: 'Mesa',
  tuNombre: 'Elkis',
  atuendo: atuendoInicial(1),
};
const trading = escenarioPorId('trading');
const segunda = trading.variantes[1]!.id;

/** Lo que marca cada lado a partir de la misma sala. */
const marcada = (s: ReturnType<typeof salaNueva>) => {
  const e = escenarioPorId(s.plano.plantilla);
  return {
    seleccion: estiloMundo(e.variantes, s.mundo.variante).elegida?.id,
    estilo: varianteActiva(e, s.mundo.variante),
  };
};

describe('una sola fuente de la variante', () => {
  it('lo elegido en la selección de mundo queda guardado y la pestaña Estilo lo marca', () => {
    const enCreacion = elegirVariante(salaNueva('trading', datos), segunda);
    const r = parsearSala(serializarSala(enCreacion));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sala.mundo.variante).toBe(segunda);
    expect(marcada(r.sala)).toEqual({ seleccion: segunda, estilo: segunda });
  });

  it('lo elegido en la pestaña Estilo es lo que muestra la selección de mundo', () => {
    const primera = trading.variantes[0]!.id;
    const s = elegirVariante(elegirVariante(salaNueva('trading', datos), segunda), primera);
    expect(marcada(s)).toEqual({ seleccion: primera, estilo: primera });
  });

  it('ambos lados resuelven igual cualquier id: propio, ajeno, inexistente o ausente', () => {
    const ajenos = PLANTILLAS.flatMap((p) => escenarioPorId(p.id).variantes.map((v) => v.id));
    for (const p of PLANTILLAS) {
      for (const id of [undefined, '', 'inexistente', ...ajenos]) {
        const s = salaNueva(p.id, datos);
        const { seleccion, estilo } = marcada({ ...s, mundo: { ...s.mundo, variante: id } });
        expect(seleccion, `${p.id} · ${String(id)}`).toBe(estilo);
      }
    }
  });

  it('ir a otro mundo y volver conserva la variante elegida', () => {
    const elegida = elegirVariante(salaNueva('trading', datos), segunda);
    const enOficina = conPlantilla(elegida, 'oficina');
    expect(marcada(enOficina).estilo).toBe(escenarioPorId('oficina').variantes[0]!.id);
    const deVuelta = conPlantilla(enOficina, 'trading');
    expect(marcada(deVuelta)).toEqual({ seleccion: segunda, estilo: segunda });
  });
});
