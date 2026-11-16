/**
 * Unión de F (paso «Nombre») con G (composición del vestidor): Nombre y Tú comparten la misma
 * escena (vestidor montado, fondo sin ocupantes, sin deriva) y la misma etiqueta sobre la cabeza,
 * para que pasar de uno a otro no tenga salto.
 */
import { describe, expect, it } from 'vitest';
import { conVestidor } from './estadoPersonaje';
import { etiquetaVestidor, nombreSobreCabeza, PARAMETROS_VESTIDOR as P } from './encuadreVestidor';

describe('escena compartida de Nombre y Tú', () => {
  it('solo los pasos nombre y personaje usan la composición del vestidor', () => {
    expect(conVestidor('nombre')).toBe(true);
    expect(conVestidor('personaje')).toBe(true);
    for (const paso of ['llegada', 'sala', 'agentes', 'invitar', 'dentro'] as const) {
      expect(conVestidor(paso), paso).toBe(false);
    }
  });
});

describe('etiqueta del nombre en el vestidor', () => {
  const pies = { x: 4.5, y: 0, z: 6.8 };

  it('con la cabeza del rig, la etiqueta va sobre ella (con y sin gorro)', () => {
    const cabeza = { x: 4.52, y: 1.71, z: 6.79 };
    expect(etiquetaVestidor(cabeza, pies, false)).toEqual(nombreSobreCabeza(cabeza, false));
    expect(etiquetaVestidor(cabeza, pies, true)).toEqual(nombreSobreCabeza(cabeza, true));
  });

  it('antes del primer cuadro (sin cabeza), cae sobre los pies a la altura del nombre', () => {
    expect(etiquetaVestidor(undefined, pies, false)).toEqual({ ...pies, y: P.alturaNombre });
  });
});
