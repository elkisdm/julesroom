import { describe, expect, it } from 'vitest';
import {
  avanzarForma,
  crearForma,
  DISTANCIA_LLEGADA,
  DISTANCIA_SALTO,
  DURACION_TRANSICION,
  esOrbeEnVuelo,
} from './maquina';

const DT = 1 / 60;
const correr = (e: ReturnType<typeof crearForma>, distancia: number, segundos: number) => {
  for (let t = 0; t < segundos; t += DT) avanzarForma(e, distancia, DT, false);
};

describe('máquina de forma del asistente', () => {
  it('empieza como personaje y se queda en reposo si el destino está cerca', () => {
    const e = crearForma();
    correr(e, DISTANCIA_SALTO - 0.1, 2);
    expect(e).toEqual({ fase: 'personaje', forma: 1 });
  });

  it('si el destino queda lejos se vuelve orbe en ~0,4 s y viaja', () => {
    const e = crearForma();
    correr(e, DISTANCIA_SALTO + 3, DURACION_TRANSICION + 0.1);
    expect(e.fase).toBe('viajando');
    expect(e.forma).toBe(0);
    expect(esOrbeEnVuelo(e)).toBe(true);
  });

  it('durante la desmaterialización la forma baja de forma gradual', () => {
    const e = crearForma();
    correr(e, DISTANCIA_SALTO + 3, DURACION_TRANSICION / 2);
    expect(e.fase).toBe('desmaterializando');
    expect(e.forma).toBeGreaterThan(0.3);
    expect(e.forma).toBeLessThan(0.7);
  });

  it('sigue como orbe mientras no llega y se materializa al llegar', () => {
    const e = crearForma();
    correr(e, 10, 1);
    correr(e, DISTANCIA_LLEGADA + 0.3, 1);
    expect(e.fase).toBe('viajando');
    correr(e, DISTANCIA_LLEGADA - 0.1, DURACION_TRANSICION / 2);
    expect(e.fase).toBe('materializando');
    expect(e.forma).toBeGreaterThan(0.3);
    expect(e.forma).toBeLessThan(0.7);
    correr(e, DISTANCIA_LLEGADA - 0.1, DURACION_TRANSICION);
    expect(e).toEqual({ fase: 'personaje', forma: 1 });
  });

  it('si el destino se aleja mientras se materializa, vuelve a ser orbe', () => {
    const e = crearForma();
    correr(e, 10, 1);
    correr(e, 0.1, DURACION_TRANSICION / 2);
    expect(e.fase).toBe('materializando');
    correr(e, 10, DURACION_TRANSICION * 2);
    expect(e.fase).toBe('viajando');
  });

  it('con movimiento reducido no hay viaje: pide colocarla en su lugar y queda de pie', () => {
    const e = crearForma();
    expect(avanzarForma(e, 10, DT, true)).toBe(true);
    expect(e).toEqual({ fase: 'personaje', forma: 1 });
    expect(avanzarForma(e, 0.5, DT, true)).toBe(false);
  });
});
