import { describe, expect, it } from 'vitest';
import { MAX_PUNTUALES, paletaLuz } from './luz';
import type { PaletaLuz, RGB } from './luz';

/** Todos los números de la paleta, en orden estable, para comparar horas vecinas. */
function numeros(valor: unknown): number[] {
  if (typeof valor === 'number') return [valor];
  if (Array.isArray(valor)) return valor.flatMap(numeros);
  if (valor && typeof valor === 'object') return Object.values(valor).flatMap(numeros);
  return [];
}

const calidez = (c: RGB) => c.r - c.b;

describe('paletaLuz', () => {
  it('nunca usa más de 4 luces puntuales reales', () => {
    for (let h = 0; h < 24; h += 0.25) {
      expect(paletaLuz(h).interior.puntuales.length).toBeLessThanOrEqual(MAX_PUNTUALES);
    }
    expect(MAX_PUNTUALES).toBe(4);
  });

  it('es continua: sin saltos entre horas vecinas y 0 h = 24 h', () => {
    let anterior = numeros(paletaLuz(0));
    let peor = 0;
    for (let h = 0.01; h <= 24.0001; h += 0.01) {
      const actual = numeros(paletaLuz(h));
      expect(actual.length).toBe(anterior.length);
      actual.forEach((v, i) => {
        peor = Math.max(peor, Math.abs(v - (anterior[i] as number)));
      });
      anterior = actual;
    }
    // En 36 s de reloj ningún color, intensidad ni dirección cambia más de 0,05.
    expect(peor).toBeLessThan(0.05);
    const cero = numeros(paletaLuz(0));
    numeros(paletaLuz(24)).forEach((v, i) => expect(v).toBeCloseTo(cero[i] as number, 6));
  });

  it('de noche la casa es más cálida por dentro que de día', () => {
    const noche = paletaLuz(23);
    const dia = paletaLuz(13);
    expect(noche.interior.led).toBeGreaterThan(dia.interior.led);
    expect(noche.interior.charcos).toBeGreaterThan(dia.interior.charcos);
    const total = (p: PaletaLuz) => p.interior.puntuales.reduce((s, l) => s + l.intensidad, 0);
    expect(total(noche)).toBeGreaterThan(total(dia));
    // Por dentro ámbar; por fuera, luna fría.
    expect(calidez(noche.interior.color)).toBeGreaterThan(0.3);
    expect(calidez(noche.luna.color)).toBeLessThan(0);
    // La luz interior pesa más que el cielo de noche que de día.
    const relacion = (p: PaletaLuz) => total(p) / (p.hemisferio.intensidad + 0.01);
    expect(relacion(noche)).toBeGreaterThan(relacion(dia) * 5);
  });

  it('al atardecer (19 h) la luz es dorada y el sol está bajo', () => {
    const tarde = paletaLuz(19);
    const mediodia = paletaLuz(13);
    expect(tarde.dorado).toBeGreaterThan(0.7);
    expect(mediodia.dorado).toBeLessThan(0.05);
    const { r, g, b } = tarde.sol.color;
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(calidez(tarde.cielo.horizonte)).toBeGreaterThan(calidez(mediodia.cielo.horizonte));
    expect(tarde.sol.direccion.y).toBeGreaterThan(0);
    expect(tarde.sol.direccion.y).toBeLessThan(0.4);
    // Sale por el este (+x) y se pone por el oeste (-x).
    expect(tarde.sol.direccion.x).toBeLessThan(0);
    expect(paletaLuz(8).sol.direccion.x).toBeGreaterThan(0);
  });

  it('a mediodía el sol está alto, hacia el norte (-z), y no hay estrellas', () => {
    const p = paletaLuz(13.3);
    expect(p.sol.direccion.y).toBeGreaterThan(0.9);
    expect(p.sol.direccion.z).toBeLessThan(0);
    expect(p.estrellas).toBe(0);
    expect(p.luna.intensidad).toBe(0);
  });

  it('la mañana es más fresca que el atardecer', () => {
    const fria = (c: RGB) => c.b - c.r;
    expect(paletaLuz(7.5).manana).toBeGreaterThan(0.7);
    expect(fria(paletaLuz(7.5).cielo.horizonte)).toBeGreaterThan(
      fria(paletaLuz(19).cielo.horizonte),
    );
  });

  it('de noche hay estrellas y luna, y el sol está bajo el horizonte y apagado', () => {
    const p = paletaLuz(23);
    expect(p.estrellas).toBeGreaterThan(0.8);
    expect(p.luna.intensidad).toBeGreaterThan(0);
    expect(p.sol.direccion.y).toBeLessThan(0);
    expect(p.sol.intensidad).toBe(0);
  });

  it('las direcciones del sol y la luna son unitarias', () => {
    for (const h of [0, 6, 9.5, 13, 19, 21]) {
      const { sol, luna } = paletaLuz(h);
      for (const d of [sol.direccion, luna.direccion]) {
        expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
      }
    }
  });

  /** Peso del sol frente al relleno (cielo + reflejos): cuánto se marca la sombra. */
  const contraste = (p: PaletaLuz) => p.sol.intensidad / (p.hemisferio.intensidad + p.entorno);

  it('a mediodía las sombras pesan: el sol vale al menos 2,5 veces el relleno', () => {
    // Antes de este pulido era 1,47 (2,5 / (0,9 + 0,8)) y el día se veía lavado.
    expect(contraste(paletaLuz(13))).toBeGreaterThan(2.5);
    expect(contraste(paletaLuz(10))).toBeGreaterThan(2.5);
  });

  it('el atardecer es dorado intenso: sol saturado y con mucho más contraste que el mediodía', () => {
    const tarde = paletaLuz(19);
    expect(tarde.sol.color.r - tarde.sol.color.b).toBeGreaterThan(0.6);
    expect(contraste(tarde)).toBeGreaterThan(1.5 * contraste(paletaLuz(13)));
  });

  it('la mañana tiene un relleno frío: las sombras se leen azuladas', () => {
    const { cielo } = paletaLuz(7.5).hemisferio;
    expect(cielo.b - cielo.r).toBeGreaterThan(0.15);
  });

  it('de noche el interior es más cálido que todo el exterior', () => {
    const p = paletaLuz(23);
    const interior = calidez(p.interior.color);
    for (const exterior of [p.cielo.cenit, p.cielo.horizonte, p.hemisferio.cielo, p.luna.color]) {
      expect(calidez(exterior)).toBeLessThan(0);
      expect(interior).toBeGreaterThan(calidez(exterior) + 0.5);
    }
  });
});
